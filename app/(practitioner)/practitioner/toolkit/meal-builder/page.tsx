"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { Search, Plus, X, ChevronDown } from "lucide-react";

// ─── Food library ────────────────────────────────────────────────────────────

type FoodCategory = "protein" | "carbs" | "veg" | "fats" | "dairy-free";

type Food = {
  id: string;
  name: string;
  category: FoodCategory;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
};

const FOODS: Food[] = [
  { id: "f01", name: "Chicken Breast", category: "protein", kcal: 165, protein: 31, carbs: 0, fat: 3.6 },
  { id: "f02", name: "Salmon Fillet", category: "protein", kcal: 208, protein: 20, carbs: 0, fat: 13 },
  { id: "f03", name: "Eggs (whole)", category: "protein", kcal: 143, protein: 13, carbs: 1, fat: 10 },
  { id: "f04", name: "Turkey Mince", category: "protein", kcal: 170, protein: 29, carbs: 0, fat: 6 },
  { id: "f05", name: "Tofu (firm)", category: "protein", kcal: 76, protein: 8, carbs: 2, fat: 4 },
  { id: "f06", name: "Brown Rice (cooked)", category: "carbs", kcal: 112, protein: 2.6, carbs: 23, fat: 0.9 },
  { id: "f07", name: "Sweet Potato", category: "carbs", kcal: 86, protein: 1.6, carbs: 20, fat: 0.1 },
  { id: "f08", name: "Oats (rolled)", category: "carbs", kcal: 389, protein: 17, carbs: 66, fat: 7 },
  { id: "f09", name: "Quinoa (cooked)", category: "carbs", kcal: 120, protein: 4.4, carbs: 22, fat: 2 },
  { id: "f10", name: "Broccoli", category: "veg", kcal: 34, protein: 2.8, carbs: 7, fat: 0.4 },
  { id: "f11", name: "Spinach", category: "veg", kcal: 23, protein: 2.9, carbs: 3.6, fat: 0.4 },
  { id: "f12", name: "Courgette", category: "veg", kcal: 17, protein: 1.2, carbs: 3, fat: 0.3 },
  { id: "f13", name: "Kale", category: "veg", kcal: 49, protein: 4.3, carbs: 9, fat: 0.9 },
  { id: "f14", name: "Blueberries", category: "veg", kcal: 57, protein: 0.7, carbs: 14, fat: 0.3 },
  { id: "f15", name: "Avocado", category: "fats", kcal: 160, protein: 2, carbs: 9, fat: 15 },
  { id: "f16", name: "Olive Oil", category: "fats", kcal: 884, protein: 0, carbs: 0, fat: 100 },
  { id: "f17", name: "Almonds", category: "fats", kcal: 579, protein: 21, carbs: 22, fat: 50 },
  { id: "f18", name: "Walnuts", category: "fats", kcal: 654, protein: 15, carbs: 14, fat: 65 },
  { id: "f19", name: "Coconut Milk", category: "dairy-free", kcal: 230, protein: 2.3, carbs: 6, fat: 24 },
  { id: "f20", name: "Oat Milk", category: "dairy-free", kcal: 46, protein: 1, carbs: 8, fat: 1.5 },
];

const CAT_OPTIONS = [
  { key: "all", label: "All" },
  { key: "protein", label: "Protein" },
  { key: "carbs", label: "Carbs" },
  { key: "veg", label: "Veg" },
  { key: "fats", label: "Fats" },
  { key: "dairy-free", label: "Dairy-free" },
];

const CAT_DOT: Record<string, string> = {
  protein: "bg-[#4A7FA0]",
  carbs: "bg-[#C27D30]",
  veg: "bg-[#4E7A5F]",
  fats: "bg-[#7B6FA8]",
  "dairy-free": "bg-[#B5704A]",
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
function calcItem(food: Food, grams: number) {
  return {
    grams,
    kcal: Math.round((food.kcal * grams) / 100),
    protein: Math.round((food.protein * grams) / 100 * 10) / 10,
    carbs: Math.round((food.carbs * grams) / 100 * 10) / 10,
    fat: Math.round((food.fat * grams) / 100 * 10) / 10,
  };
}
function dayTotals(day: DayPlan) {
  const all = [...day.breakfast, ...day.lunch, ...day.dinner, ...day.snacks];
  return all.reduce(
    (acc, i) => ({ kcal: acc.kcal + i.kcal, protein: acc.protein + i.protein, carbs: acc.carbs + i.carbs, fat: acc.fat + i.fat }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 }
  );
}

type Patient = { id: string; name: string };
type MobilePanel = "library" | "canvas" | "totals";

// ─── Component ───────────────────────────────────────────────────────────────

export default function MealBuilderPage() {
  const supabase = createClient();

  const [search, setSearch] = useState("");
  const [cat, setCat] = useState("all");
  const [activeDay, setActiveDay] = useState<DayKey>("mon");
  const [activeMeal, setActiveMeal] = useState<MealSection>("breakfast");
  const [plan, setPlan] = useState<WeekPlan>(emptyWeek());
  const [protocolName, setProtocolName] = useState("");
  const [weekNumber, setWeekNumber] = useState("1");
  const [notes, setNotes] = useState("");
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState("");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>("canvas");

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

  const filteredFoods = useMemo(
    () => FOODS.filter((f) =>
      (cat === "all" || f.category === cat) &&
      f.name.toLowerCase().includes(search.toLowerCase())
    ),
    [search, cat]
  );

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  function addFood(food: Food) {
    const item: MealItem = {
      id: `${food.id}-${Date.now()}`,
      foodId: food.id,
      name: food.name,
      ...calcItem(food, 100),
    };
    setPlan((prev) => ({
      ...prev,
      [activeDay]: { ...prev[activeDay], [activeMeal]: [...prev[activeDay][activeMeal], item] },
    }));
    setMobilePanel("canvas");
  }

  function updateGrams(itemId: string, grams: number) {
    setPlan((prev) => ({
      ...prev,
      [activeDay]: {
        ...prev[activeDay],
        [activeMeal]: prev[activeDay][activeMeal].map((item) => {
          if (item.id !== itemId) return item;
          const food = FOODS.find((f) => f.id === item.foodId)!;
          return { ...item, ...calcItem(food, Math.max(1, grams)) };
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

  const totals = dayTotals(plan[activeDay]);
  const kcalTarget = 1700;
  const kcalPct = Math.min(100, Math.round((totals.kcal / kcalTarget) * 100));

  // ─── Sub-panels ────────────────────────────────────────────────────────────

  const LibraryPanel = (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-[#E6E0D8] bg-[#FDFCFA]">
        <h2 className="font-medium text-sm text-[#1E1A16] mb-3">Food Library</h2>
        <div className="relative mb-3">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9C9087]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search foods…"
            className="w-full pl-8 pr-3 py-2 text-xs rounded-lg border border-[#E6E0D8] bg-white focus:outline-none focus:ring-2 focus:ring-[#4E7A5F]/20"
          />
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
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5 bg-[#FDFCFA]">
        {filteredFoods.length === 0 && (
          <p className="text-center text-[#9C9087] text-xs py-8">No foods match</p>
        )}
        {filteredFoods.map((food) => (
          <button
            key={food.id}
            onClick={() => addFood(food)}
            className="w-full flex items-center gap-2.5 p-2.5 rounded-xl hover:bg-[#EBF2EE] text-left transition-colors group"
          >
            <div className={`w-2 h-2 rounded-full shrink-0 ${CAT_DOT[food.category]}`} />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-[#1E1A16] truncate">{food.name}</p>
              <p className="text-[10px] text-[#9C9087]">
                {food.kcal} kcal · P {food.protein}g · C {food.carbs}g · F {food.fat}g
              </p>
            </div>
            <Plus size={13} className="text-[#4E7A5F] opacity-0 group-hover:opacity-100 shrink-0 transition-opacity" />
          </button>
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
    </div>
  );
}
