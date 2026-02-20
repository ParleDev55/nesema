"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Search, Plus, X, ChevronDown, Heart, Info, ExternalLink, AlertTriangle } from "lucide-react";
import type { FoodItem, FoodCategory } from "@/app/api/foods/search/route";

// ─── Category config ──────────────────────────────────────────────────────────

const CAT_OPTIONS = [
  { key: "all", label: "All" },
  { key: "protein", label: "Protein" },
  { key: "carbs", label: "Carbs" },
  { key: "veg", label: "Veg" },
  { key: "fruit", label: "Fruit" },
  { key: "fats", label: "Fats" },
  { key: "dairy-free", label: "Dairy-free" },
  { key: "plant-based", label: "Plant-based" },
  { key: "other", label: "Other" },
  { key: "favourites", label: "♥ Saved" },
];

const CAT_DOT: Record<string, string> = {
  protein: "bg-[#4A7FA0]",
  carbs: "bg-[#C27D30]",
  veg: "bg-[#4E7A5F]",
  fruit: "bg-[#E07A5F]",
  fats: "bg-[#7B6FA8]",
  "dairy-free": "bg-[#B5704A]",
  "plant-based": "bg-[#5C9E78]",
  other: "bg-[#9C9087]",
};

// ─── Plan types ──────────────────────────────────────────────────────────────

type MealSection = "breakfast" | "lunch" | "dinner" | "snacks";
type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

type MealItem = {
  id: string;
  foodId: string;
  name: string;
  grams: number;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  // Per 100g — stored so we can recalculate when grams change without needing the original food object
  kcalPer100: number;
  proteinPer100: number;
  carbsPer100: number;
  fatPer100: number;
};

type DayPlan = Record<MealSection, MealItem[]>;
type WeekPlan = Record<DayKey, DayPlan>;

const DAYS: DayKey[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const DAY_LABELS: Record<DayKey, string> = {
  mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat", sun: "Sun",
};
const DAY_FULL: Record<DayKey, string> = {
  mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday",
  fri: "Friday", sat: "Saturday", sun: "Sunday",
};
const MEALS: MealSection[] = ["breakfast", "lunch", "dinner", "snacks"];
const MEAL_LABELS: Record<MealSection, string> = {
  breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", snacks: "Snacks",
};

function emptyDay(): DayPlan {
  return { breakfast: [], lunch: [], dinner: [], snacks: [] };
}
function emptyWeek(): WeekPlan {
  return {
    mon: emptyDay(), tue: emptyDay(), wed: emptyDay(), thu: emptyDay(),
    fri: emptyDay(), sat: emptyDay(), sun: emptyDay(),
  };
}
function calcMacros(food: FoodItem, grams: number) {
  return {
    grams,
    kcal: Math.round((food.kcal * grams) / 100),
    protein: Math.round((food.protein * grams) / 100 * 10) / 10,
    carbs: Math.round((food.carbs * grams) / 100 * 10) / 10,
    fat: Math.round((food.fat * grams) / 100 * 10) / 10,
  };
}
function recalcMacros(item: MealItem, grams: number) {
  const g = Math.max(1, grams);
  return {
    grams: g,
    kcal: Math.round((item.kcalPer100 * g) / 100),
    protein: Math.round((item.proteinPer100 * g) / 100 * 10) / 10,
    carbs: Math.round((item.carbsPer100 * g) / 100 * 10) / 10,
    fat: Math.round((item.fatPer100 * g) / 100 * 10) / 10,
  };
}
function dayTotals(day: DayPlan) {
  const all = [...day.breakfast, ...day.lunch, ...day.dinner, ...day.snacks];
  return all.reduce(
    (acc, i) => ({ kcal: acc.kcal + i.kcal, protein: acc.protein + i.protein, carbs: acc.carbs + i.carbs, fat: acc.fat + i.fat }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 }
  );
}

// ─── LocalStorage keys ────────────────────────────────────────────────────────

const LS_RECENT = "nesema_recent_foods";
const LS_FAVS = "nesema_favourite_foods";

// ─── Compliance check ─────────────────────────────────────────────────────────

interface PatientFlags {
  gluten_free?: boolean;
  dairy_free?: boolean;
  nut_free?: boolean;
  low_fodmap?: boolean;
}

function checkFoodCompliance(food: FoodItem, flags: PatientFlags): string | null {
  const allergens = (food.allergens ?? []).map((a) => a.toLowerCase());
  if (flags.gluten_free && allergens.some((a) => /gluten|wheat|rye|barley|spelt/.test(a))) {
    return `${food.name} may contain gluten — patient is on a gluten-free protocol.`;
  }
  if (flags.dairy_free && allergens.some((a) => /milk|dairy|lactose|casein/.test(a))) {
    return `${food.name} may contain dairy — patient is on a dairy-free protocol.`;
  }
  if (flags.nut_free && allergens.some((a) => /nut|peanut|almond|cashew|walnut|hazel/.test(a))) {
    return `${food.name} may contain nuts — patient has a nut-free requirement.`;
  }
  if (flags.low_fodmap) {
    const name = food.name.toLowerCase();
    if (/garlic|onion|apple|pear|watermelon|mango|wheat|rye|chickpea|lentil|kidney bean/.test(name)) {
      return `${food.name} may be high FODMAP — patient is on a low-FODMAP protocol.`;
    }
  }
  return null;
}

type Patient = { id: string; name: string };
type MobilePanel = "library" | "canvas" | "totals";

// ─── Skeleton loader ─────────────────────────────────────────────────────────

function FoodSkeleton() {
  return (
    <div className="space-y-0.5 animate-pulse">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-2.5 p-2.5">
          <div className="w-2 h-2 rounded-full bg-[#E6E0D8] shrink-0" />
          <div className="flex-1 space-y-1.5">
            <div className="h-2.5 bg-[#E6E0D8] rounded w-3/4" />
            <div className="h-2 bg-[#E6E0D8] rounded w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Food detail popover ──────────────────────────────────────────────────────

function FoodDetailPopover({ food, onClose }: { food: FoodItem; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30" />
      <div
        className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm p-5 z-10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 pr-2">
            <h3 className="font-medium text-sm text-[#1E1A16] leading-tight">{food.name}</h3>
            <p className="text-[11px] text-[#9C9087] mt-0.5 capitalize">{food.category.replace("-", " ")}</p>
          </div>
          <button onClick={onClose} className="text-[#9C9087] hover:text-[#1E1A16] transition-colors shrink-0">
            <X size={16} />
          </button>
        </div>

        {food.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={food.image} alt={food.name} className="w-full h-28 object-contain rounded-xl mb-3 bg-[#F6F3EE]" />
        )}

        <div className="text-[10px] font-semibold uppercase tracking-widest text-[#9C9087] mb-2">Per 100g</div>
        <div className="grid grid-cols-4 gap-2 mb-4">
          {[
            { label: "Calories", value: `${food.kcal}`, unit: "kcal" },
            { label: "Protein", value: `${food.protein}`, unit: "g" },
            { label: "Carbs", value: `${food.carbs}`, unit: "g" },
            { label: "Fat", value: `${food.fat}`, unit: "g" },
          ].map(({ label, value, unit }) => (
            <div key={label} className="bg-[#F6F3EE] rounded-lg p-2 text-center">
              <p className="font-semibold text-sm text-[#1E1A16]">{value}</p>
              <p className="text-[9px] text-[#9C9087]">{unit}</p>
              <p className="text-[9px] text-[#9C9087]">{label}</p>
            </div>
          ))}
        </div>

        {food.allergens && food.allergens.length > 0 && (
          <div className="mb-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#9C9087] mb-1.5">Allergens</p>
            <div className="flex flex-wrap gap-1">
              {food.allergens.map((a) => (
                <span key={a} className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full capitalize">
                  {a.replace(/-/g, " ")}
                </span>
              ))}
            </div>
          </div>
        )}

        {food.offUrl && (
          <a
            href={food.offUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-[11px] text-[#4E7A5F] hover:underline"
          >
            <ExternalLink size={11} />
            View on Open Food Facts
          </a>
        )}

        {food.fallback && (
          <p className="text-[10px] text-[#9C9087] mt-2 italic">From offline food library</p>
        )}
      </div>
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function MealBuilderPage() {
  const supabase = createClient();

  // ── Search + library state
  const [search, setSearch] = useState("");
  const [cat, setCat] = useState("all");
  const [foods, setFoods] = useState<FoodItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchFallback, setSearchFallback] = useState(false);
  const [recentFoods, setRecentFoods] = useState<FoodItem[]>([]);
  const [favouriteIds, setFavouriteIds] = useState<Set<string>>(new Set());
  const [favouriteFoods, setFavouriteFoods] = useState<FoodItem[]>([]);
  const [detailFood, setDetailFood] = useState<FoodItem | null>(null);

  // ── Plan state
  const [activeDay, setActiveDay] = useState<DayKey>("mon");
  const [activeMeal, setActiveMeal] = useState<MealSection>("breakfast");
  const [plan, setPlan] = useState<WeekPlan>(emptyWeek());

  // ── Protocol / assign state
  const [protocolName, setProtocolName] = useState("");
  const [weekNumber, setWeekNumber] = useState("1");
  const [notes, setNotes] = useState("");
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState("");
  const [patientFlags, setPatientFlags] = useState<PatientFlags | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>("canvas");

  // ── Compliance state
  const [complianceWarning, setComplianceWarning] = useState<string | null>(null);
  const [dismissedWarning, setDismissedWarning] = useState(false);

  // ── Debounce ref
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── Load patients ─────────────────────────────────────────────────────────

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: prac } = (await supabase
        .from("practitioners").select("id").eq("profile_id", user.id).single()) as {
        data: { id: string } | null; error: unknown;
      };
      if (!prac) return;
      const { data: pts } = (await supabase
        .from("patients").select("id, profile_id").eq("practitioner_id", prac.id)) as {
        data: { id: string; profile_id: string }[] | null; error: unknown;
      };
      if (!pts || pts.length === 0) return;
      const profileIds = pts.map((p) => p.profile_id);
      const { data: profiles } = (await supabase
        .from("profiles").select("id, first_name, last_name").in("id", profileIds)) as {
        data: { id: string; first_name: string | null; last_name: string | null }[] | null; error: unknown;
      };
      const pMap: Record<string, string> = {};
      for (const pr of profiles ?? []) {
        pMap[pr.id] = [pr.first_name, pr.last_name].filter(Boolean).join(" ") || "Patient";
      }
      setPatients(pts.map((p) => ({ id: p.id, name: pMap[p.profile_id] ?? "Patient" })));
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Load localStorage (recent + favourites) ───────────────────────────────

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_RECENT);
      if (raw) setRecentFoods(JSON.parse(raw) as FoodItem[]);
    } catch { /* ignore */ }
    try {
      const raw = localStorage.getItem(LS_FAVS);
      if (raw) {
        const favs = JSON.parse(raw) as FoodItem[];
        setFavouriteFoods(favs);
        setFavouriteIds(new Set(favs.map((f) => f.id)));
      }
    } catch { /* ignore */ }
  }, []);

  // ─── Load patient dietary flags when patient changes ──────────────────────

  useEffect(() => {
    if (!selectedPatient) { setPatientFlags(null); return; }
    (async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data } = await (supabase as any)
          .from("patients")
          .select("health_background")
          .eq("id", selectedPatient)
          .single();
        if (data?.health_background && typeof data.health_background === "object") {
          const hb = data.health_background as Record<string, unknown>;
          setPatientFlags({
            gluten_free: !!(hb.gluten_free ?? hb.glutenFree),
            dairy_free: !!(hb.dairy_free ?? hb.dairyFree),
            nut_free: !!(hb.nut_free ?? hb.nutFree),
            low_fodmap: !!(hb.low_fodmap ?? hb.lowFodmap),
          });
        }
      } catch { /* no dietary data — compliance check skipped */ }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPatient]);

  // ─── Debounced food search ─────────────────────────────────────────────────

  const runSearch = useCallback(async (query: string) => {
    setLoading(true);
    setSearchFallback(false);
    try {
      const q = query.trim() || "chicken breast";
      const res = await fetch(`/api/foods/search?q=${encodeURIComponent(q)}`);
      if (!res.ok) throw new Error("search failed");
      const data = await res.json() as { foods: FoodItem[]; fallback: boolean };
      setFoods(data.foods);
      setSearchFallback(data.fallback);
    } catch {
      setSearchFallback(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const q = search.trim();
    // Don't fire if search is 1 char (wait for more)
    if (q.length === 1) return;

    if (searchTimer.current) clearTimeout(searchTimer.current);
    const delay = q.length === 0 ? 0 : 400;
    searchTimer.current = setTimeout(() => runSearch(q), delay);

    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [search, runSearch]);

  // ─── Helpers ───────────────────────────────────────────────────────────────

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  function addToRecent(food: FoodItem) {
    setRecentFoods((prev) => {
      const next = [food, ...prev.filter((f) => f.id !== food.id)].slice(0, 10);
      try { localStorage.setItem(LS_RECENT, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }

  function toggleFavourite(food: FoodItem) {
    setFavouriteIds((prev) => {
      const next = new Set(prev);
      if (next.has(food.id)) {
        next.delete(food.id);
        setFavouriteFoods((f) => {
          const updated = f.filter((x) => x.id !== food.id);
          try { localStorage.setItem(LS_FAVS, JSON.stringify(updated)); } catch { /* ignore */ }
          return updated;
        });
      } else {
        next.add(food.id);
        setFavouriteFoods((f) => {
          const updated = [food, ...f.filter((x) => x.id !== food.id)];
          try { localStorage.setItem(LS_FAVS, JSON.stringify(updated)); } catch { /* ignore */ }
          return updated;
        });
      }
      return next;
    });
  }

  function addFood(food: FoodItem) {
    const item: MealItem = {
      id: `${food.id}-${Date.now()}`,
      foodId: food.id,
      name: food.name,
      ...calcMacros(food, 100),
      kcalPer100: food.kcal,
      proteinPer100: food.protein,
      carbsPer100: food.carbs,
      fatPer100: food.fat,
    };
    setPlan((prev) => ({
      ...prev,
      [activeDay]: { ...prev[activeDay], [activeMeal]: [...prev[activeDay][activeMeal], item] },
    }));
    addToRecent(food);

    // Compliance check
    if (patientFlags) {
      const warning = checkFoodCompliance(food, patientFlags);
      if (warning) {
        setComplianceWarning(warning);
        setDismissedWarning(false);
      }
    }

    setMobilePanel("canvas");
  }

  function updateGrams(itemId: string, grams: number) {
    setPlan((prev) => ({
      ...prev,
      [activeDay]: {
        ...prev[activeDay],
        [activeMeal]: prev[activeDay][activeMeal].map((item) => {
          if (item.id !== itemId) return item;
          return { ...item, ...recalcMacros(item, grams) };
        }),
      },
    }));
  }

  function removeItem(itemId: string) {
    setPlan((prev) => ({
      ...prev,
      [activeDay]: {
        ...prev[activeDay],
        [activeMeal]: prev[activeDay][activeMeal].filter((i) => i.id !== itemId),
      },
    }));
  }

  async function handleAssign() {
    if (!selectedPatient) { showToast("Select a patient first"); return; }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: prac } = (await supabase
        .from("practitioners").select("id").eq("profile_id", user.id).single()) as {
        data: { id: string } | null; error: unknown;
      };
      if (!prac) { showToast("Practitioner record not found"); return; }
      const { error } = await supabase.from("meal_plans").insert({
        patient_id: selectedPatient,
        practitioner_id: prac.id,
        protocol_name: protocolName || "Meal Plan",
        week_number: parseInt(weekNumber) || 1,
        days: plan,
        notes,
      });
      if (error) throw error;
      showToast("Meal plan assigned!");
    } catch {
      showToast("Failed to assign — please try again");
    } finally {
      setSaving(false);
    }
  }

  // ─── Derived display lists ─────────────────────────────────────────────────

  const displayFoods: FoodItem[] = (() => {
    if (cat === "favourites") {
      return favouriteFoods.filter((f) =>
        !search.trim() || f.name.toLowerCase().includes(search.toLowerCase())
      );
    }
    const filtered = foods.filter((f) => cat === "all" || f.category === (cat as FoodCategory));
    return filtered;
  })();

  const showRecent = search.trim().length === 0 && cat !== "favourites" && recentFoods.length > 0;

  const totals = dayTotals(plan[activeDay]);
  const kcalTarget = 1700;
  const kcalPct = Math.min(100, Math.round((totals.kcal / kcalTarget) * 100));

  // ─── Sub-panels ────────────────────────────────────────────────────────────

  const LibraryPanel = (
    <div className="flex flex-col h-full">
      {/* Header + search */}
      <div className="p-4 border-b border-[#E6E0D8] bg-[#FDFCFA] shrink-0">
        <h2 className="font-medium text-sm text-[#1E1A16] mb-3">Food Library</h2>
        <div className="relative mb-3">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9C9087]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search foods…"
            className="w-full pl-8 pr-3 py-2 text-xs rounded-lg border border-[#E6E0D8] bg-white focus:outline-none focus:ring-2 focus:ring-[#4E7A5F]/20"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#9C9087] hover:text-[#1E1A16]"
            >
              <X size={12} />
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-1">
          {CAT_OPTIONS.map((c) => (
            <button
              key={c.key}
              onClick={() => setCat(c.key)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
                cat === c.key ? "bg-[#4E7A5F] text-white" : "bg-[#EBF2EE] text-[#4E7A5F] hover:bg-[#C3D9CB]"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
        {searchFallback && (
          <p className="mt-2 text-[10px] text-amber-600 flex items-center gap-1">
            <AlertTriangle size={10} />
            Showing offline library — live search unavailable
          </p>
        )}
      </div>

      {/* Compliance warning */}
      {complianceWarning && !dismissedWarning && (
        <div className="mx-3 mt-3 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 shrink-0">
          <AlertTriangle size={13} className="text-amber-600 mt-0.5 shrink-0" />
          <p className="text-[11px] text-amber-800 flex-1">{complianceWarning}</p>
          <button onClick={() => setDismissedWarning(true)} className="text-amber-500 hover:text-amber-700 shrink-0">
            <X size={12} />
          </button>
        </div>
      )}

      {/* Food list */}
      <div className="flex-1 overflow-y-auto p-2 bg-[#FDFCFA]">
        {loading && <FoodSkeleton />}

        {!loading && cat === "favourites" && favouriteFoods.length === 0 && (
          <div className="text-center py-10 px-4">
            <Heart size={24} className="mx-auto text-[#E6E0D8] mb-2" />
            <p className="text-xs text-[#9C9087]">No saved foods yet</p>
            <p className="text-[10px] text-[#9C9087] mt-1">Click the heart icon on any food to save it</p>
          </div>
        )}

        {/* Recent foods (shown when search is empty, not on favourites tab) */}
        {!loading && showRecent && (
          <div className="mb-2">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#9C9087] px-2.5 py-1.5">Recent</p>
            {recentFoods
              .filter((f) => cat === "all" || f.category === (cat as FoodCategory))
              .map((food) => (
                <FoodRow
                  key={`recent-${food.id}`}
                  food={food}
                  isFav={favouriteIds.has(food.id)}
                  onAdd={() => addFood(food)}
                  onToggleFav={() => toggleFavourite(food)}
                  onDetail={() => setDetailFood(food)}
                />
              ))}
            {displayFoods.length > 0 && (
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[#9C9087] px-2.5 py-1.5 mt-1">Suggested</p>
            )}
          </div>
        )}

        {!loading && !showRecent && cat !== "favourites" && displayFoods.length === 0 && search.trim().length >= 2 && (
          <p className="text-center text-[#9C9087] text-xs py-8">No foods found for &ldquo;{search}&rdquo;</p>
        )}

        {!loading && cat !== "favourites" && displayFoods.map((food) => (
          <FoodRow
            key={food.id}
            food={food}
            isFav={favouriteIds.has(food.id)}
            onAdd={() => addFood(food)}
            onToggleFav={() => toggleFavourite(food)}
            onDetail={() => setDetailFood(food)}
          />
        ))}

        {!loading && cat === "favourites" && displayFoods.map((food) => (
          <FoodRow
            key={food.id}
            food={food}
            isFav={true}
            onAdd={() => addFood(food)}
            onToggleFav={() => toggleFavourite(food)}
            onDetail={() => setDetailFood(food)}
          />
        ))}
      </div>
    </div>
  );

  const CanvasPanel = (
    <div className="flex flex-col h-full">
      {/* Day tabs */}
      <div className="flex gap-1 px-3 py-2.5 border-b border-[#E6E0D8] bg-[#FDFCFA] overflow-x-auto">
        {DAYS.map((d) => {
          const hasItems = Object.values(plan[d]).some((m) => m.length > 0);
          return (
            <button
              key={d}
              onClick={() => setActiveDay(d)}
              className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                activeDay === d ? "bg-[#2E2620] text-white" : "text-[#5C5248] hover:bg-[#F6F3EE]"
              }`}
            >
              {DAY_LABELS[d]}
              {hasItems && <span className="w-1.5 h-1.5 rounded-full bg-[#4E7A5F]" />}
            </button>
          );
        })}
      </div>

      <div className="px-4 pt-3 pb-1">
        <p className="font-serif text-lg text-[#1E1A16]">{DAY_FULL[activeDay]}</p>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {MEALS.map((meal) => {
          const isActive = activeMeal === meal;
          const items = plan[activeDay][meal];
          const mealKcal = items.reduce((a, i) => a + i.kcal, 0);
          return (
            <div
              key={meal}
              className={`rounded-xl border transition-all ${
                isActive ? "border-[#4E7A5F]/30 bg-[#EBF2EE]/30" : "border-[#E6E0D8] bg-white"
              }`}
            >
              <button
                onClick={() => setActiveMeal(meal)}
                className="w-full flex items-center justify-between px-3 py-2.5 text-left"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-[#1E1A16]">{MEAL_LABELS[meal]}</span>
                  {items.length > 0 && (
                    <span className="text-[10px] text-[#9C9087] bg-[#F6F3EE] px-1.5 py-0.5 rounded-full">
                      {items.length} item{items.length > 1 ? "s" : ""} · {mealKcal} kcal
                    </span>
                  )}
                </div>
                <ChevronDown
                  size={14}
                  className={`text-[#9C9087] transition-transform ${isActive ? "rotate-180" : ""}`}
                />
              </button>

              {isActive && (
                <div className="px-3 pb-3 space-y-1.5">
                  {items.length === 0 && (
                    <p className="text-[11px] text-[#9C9087] text-center py-3">
                      Click a food in the library to add it here
                    </p>
                  )}
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 border border-[#E6E0D8]"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-[#1E1A16] truncate">{item.name}</p>
                        <p className="text-[10px] text-[#9C9087]">
                          {item.kcal} kcal · P {item.protein}g · C {item.carbs}g · F {item.fat}g
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <input
                          type="number"
                          value={item.grams}
                          onChange={(e) => updateGrams(item.id, parseInt(e.target.value) || 1)}
                          className="w-14 text-center text-xs border border-[#E6E0D8] rounded-lg py-1 focus:outline-none focus:ring-1 focus:ring-[#4E7A5F]/30"
                        />
                        <span className="text-[10px] text-[#9C9087]">g</span>
                        <button
                          onClick={() => removeItem(item.id)}
                          className="text-[#9C9087] hover:text-red-400 transition-colors ml-0.5"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  const TotalsPanel = (
    <div className="flex flex-col h-full overflow-y-auto bg-[#FDFCFA]">
      <div className="p-4 space-y-4">
        {/* Day kcal card */}
        <div className="rounded-xl bg-[#2E2620] text-white p-4">
          <div className="flex items-end justify-between mb-2">
            <div>
              <p className="text-[10px] text-white/50 uppercase tracking-widest">Day total</p>
              <p className="font-serif text-3xl font-semibold mt-0.5">{totals.kcal}</p>
              <p className="text-[11px] text-white/50">kcal</p>
            </div>
            <div className="text-right text-[11px] text-white/50">
              <p>Target</p>
              <p className="text-white/80 font-medium">{kcalTarget} kcal</p>
            </div>
          </div>
          <div className="w-full bg-white/10 rounded-full h-1.5 mb-3">
            <div
              className={`h-1.5 rounded-full transition-all ${kcalPct >= 95 ? "bg-[#B5704A]" : "bg-[#4E7A5F]"}`}
              style={{ width: `${kcalPct}%` }}
            />
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
            {[
              { label: "Protein", value: `${totals.protein}g`, dot: "bg-[#4A7FA0]" },
              { label: "Carbs", value: `${totals.carbs}g`, dot: "bg-[#C27D30]" },
              { label: "Fat", value: `${totals.fat}g`, dot: "bg-[#7B6FA8]" },
            ].map(({ label, value, dot }) => (
              <div key={label}>
                <div className="flex items-center justify-center gap-1 mb-0.5">
                  <div className={`w-1.5 h-1.5 rounded-full ${dot}`} />
                  <span className="text-white/50">{label}</span>
                </div>
                <p className="font-semibold">{value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Macro bars */}
        <div className="rounded-xl border border-[#E6E0D8] bg-white p-4 space-y-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#9C9087]">Macro targets</p>
          {[
            { label: "Protein", value: totals.protein, target: 150, color: "bg-[#4A7FA0]" },
            { label: "Carbs", value: totals.carbs, target: 200, color: "bg-[#C27D30]" },
            { label: "Fat", value: totals.fat, target: 75, color: "bg-[#7B6FA8]" },
          ].map(({ label, value, target, color }) => (
            <div key={label}>
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-[#5C5248]">{label}</span>
                <span className="text-[#9C9087]">{value}g / {target}g</span>
              </div>
              <div className="w-full bg-[#F6F3EE] rounded-full h-1.5">
                <div
                  className={`h-1.5 rounded-full transition-all ${color}`}
                  style={{ width: `${Math.min(100, (value / target) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Plan details */}
        <div className="rounded-xl border border-[#E6E0D8] bg-white p-4 space-y-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#9C9087]">Plan details</p>
          <div>
            <label className="text-[11px] text-[#5C5248] mb-1 block">Protocol name</label>
            <input
              value={protocolName}
              onChange={(e) => setProtocolName(e.target.value)}
              placeholder="e.g. Anti-inflammatory Week 1"
              className="w-full text-xs border border-[#E6E0D8] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#4E7A5F]/20"
            />
          </div>
          <div>
            <label className="text-[11px] text-[#5C5248] mb-1 block">Week number</label>
            <input
              type="number"
              value={weekNumber}
              onChange={(e) => setWeekNumber(e.target.value)}
              min={1}
              className="w-20 text-xs border border-[#E6E0D8] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#4E7A5F]/20"
            />
          </div>
          <div>
            <label className="text-[11px] text-[#5C5248] mb-1 block">Notes for patient</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add guidance, tips, or context…"
              rows={3}
              className="w-full text-xs border border-[#E6E0D8] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#4E7A5F]/20 resize-none"
            />
          </div>
        </div>

        {/* Assign */}
        <div className="rounded-xl border border-[#E6E0D8] bg-white p-4 space-y-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#9C9087]">Assign to patient</p>
          <div className="relative">
            <select
              value={selectedPatient}
              onChange={(e) => setSelectedPatient(e.target.value)}
              className="w-full appearance-none text-xs border border-[#E6E0D8] rounded-lg px-3 py-2 pr-7 focus:outline-none focus:ring-2 focus:ring-[#4E7A5F]/20 bg-white"
            >
              <option value="">Select a patient…</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#9C9087] pointer-events-none" />
          </div>

          <button
            onClick={handleAssign}
            disabled={saving || !selectedPatient}
            className="w-full py-2.5 rounded-full bg-[#4E7A5F] text-white text-xs font-semibold hover:bg-[#6B9E7A] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? "Assigning…" : "Assign Plan"}
          </button>

          <div className="flex gap-2">
            <button
              onClick={() => showToast("Copied to next week")}
              className="flex-1 py-2 rounded-full border border-[#E6E0D8] text-[11px] text-[#5C5248] hover:bg-[#F6F3EE] transition-colors"
            >
              Copy to next week
            </button>
            <button
              onClick={() => showToast("PDF export coming soon")}
              className="flex-1 py-2 rounded-full border border-[#E6E0D8] text-[11px] text-[#5C5248] hover:bg-[#F6F3EE] transition-colors"
            >
              Export PDF
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="h-full flex flex-col bg-[#F6F3EE]">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-[#E6E0D8] bg-[#FDFCFA] shrink-0">
        <div>
          <h1 className="font-serif text-2xl text-[#1E1A16]">Meal Plan Builder</h1>
          <p className="text-[11px] text-[#9C9087] mt-0.5">Build a weekly plan and assign it to a patient</p>
        </div>
      </div>

      {/* Mobile tab switcher */}
      <div className="flex md:hidden border-b border-[#E6E0D8] bg-[#FDFCFA] shrink-0">
        {(["library", "canvas", "totals"] as MobilePanel[]).map((panel) => (
          <button
            key={panel}
            onClick={() => setMobilePanel(panel)}
            className={`flex-1 py-2.5 text-[11px] font-medium capitalize transition-colors ${
              mobilePanel === panel
                ? "text-[#4E7A5F] border-b-2 border-[#4E7A5F]"
                : "text-[#9C9087]"
            }`}
          >
            {panel === "library" ? "Foods" : panel === "canvas" ? "Meals" : "Totals"}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {/* Desktop 3-col */}
        <div className="hidden md:grid grid-cols-[260px_1fr_272px] h-full divide-x divide-[#E6E0D8]">
          <div className="overflow-hidden">{LibraryPanel}</div>
          <div className="overflow-hidden">{CanvasPanel}</div>
          <div className="overflow-hidden">{TotalsPanel}</div>
        </div>
        {/* Mobile single panel */}
        <div className="md:hidden h-full overflow-hidden">
          {mobilePanel === "library" && LibraryPanel}
          {mobilePanel === "canvas" && CanvasPanel}
          {mobilePanel === "totals" && TotalsPanel}
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#2E2620] text-white text-xs px-5 py-3 rounded-full shadow-xl pointer-events-none">
          {toast}
        </div>
      )}

      {/* Food detail popover */}
      {detailFood && (
        <FoodDetailPopover food={detailFood} onClose={() => setDetailFood(null)} />
      )}
    </div>
  );
}

// ─── FoodRow component ────────────────────────────────────────────────────────

function FoodRow({
  food,
  isFav,
  onAdd,
  onToggleFav,
  onDetail,
}: {
  food: FoodItem;
  isFav: boolean;
  onAdd: () => void;
  onToggleFav: () => void;
  onDetail: () => void;
}) {
  return (
    <div className="flex items-center gap-2 px-1 py-0.5 rounded-xl hover:bg-[#EBF2EE] group transition-colors">
      <button
        onClick={onAdd}
        className="flex items-center gap-2.5 flex-1 min-w-0 p-1.5 text-left"
      >
        <div className={`w-2 h-2 rounded-full shrink-0 ${CAT_DOT[food.category] ?? "bg-[#9C9087]"}`} />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-[#1E1A16] truncate">{food.name}</p>
          <p className="text-[10px] text-[#9C9087]">
            {food.kcal} kcal · P {food.protein}g · C {food.carbs}g · F {food.fat}g
          </p>
        </div>
      </button>
      <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => { e.stopPropagation(); onDetail(); }}
          className="p-1 text-[#9C9087] hover:text-[#4E7A5F] transition-colors"
          title="View details"
        >
          <Info size={12} />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onToggleFav(); }}
          className={`p-1 transition-colors ${isFav ? "text-rose-400" : "text-[#9C9087] hover:text-rose-400"}`}
          title={isFav ? "Remove from saved" : "Save food"}
        >
          <Heart size={12} fill={isFav ? "currentColor" : "none"} />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onAdd(); }}
          className="p-1 text-[#4E7A5F] hover:text-[#2E5C45] transition-colors"
          title="Add to meal"
        >
          <Plus size={13} />
        </button>
      </div>
    </div>
  );
}
