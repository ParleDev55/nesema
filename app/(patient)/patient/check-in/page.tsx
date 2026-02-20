"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { CheckCircle2, Flame } from "lucide-react";

// ── constants ─────────────────────────────────────────────────────────────────

const MOOD_OPTIONS = [
  { score: 1, emoji: "😞", label: "Low" },
  { score: 2, emoji: "😐", label: "Low-ish" },
  { score: 3, emoji: "🙂", label: "OK" },
  { score: 4, emoji: "😊", label: "Good" },
  { score: 5, emoji: "😄", label: "Great" },
];

const COMMON_SYMPTOMS = [
  "Headache",
  "Fatigue",
  "Bloating",
  "Nausea",
  "Brain fog",
  "Joint pain",
  "Skin flare",
  "Low mood",
  "Anxiety",
  "Poor sleep",
  "Constipation",
  "Diarrhoea",
];

// ── helpers ───────────────────────────────────────────────────────────────────

function calcStreak(dates: string[]): number {
  if (!dates.length) return 0;
  const unique = Array.from(
    new Set(dates.map((d) => d.slice(0, 10)))
  ).sort((a, b) => (a > b ? -1 : 1));

  const today = new Date().toISOString().slice(0, 10);
  let streak = 0;
  let cursor = today;

  for (const d of unique) {
    if (d === cursor) {
      streak++;
      const prev = new Date(cursor);
      prev.setDate(prev.getDate() - 1);
      cursor = prev.toISOString().slice(0, 10);
    } else {
      break;
    }
  }
  return streak;
}

// ── component ─────────────────────────────────────────────────────────────────

export default function CheckInPage() {
  const router = useRouter();
  const supabase = useRef(createClient()).current;

  // Form state
  const [mood, setMood] = useState<number | null>(null);
  const [energy, setEnergy] = useState(5);
  const [sleepHours, setSleepHours] = useState(7);
  const [digestion, setDigestion] = useState(5);
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [supplementsTaken, setSupplementsTaken] = useState<string[]>([]);
  const [notes, setNotes] = useState("");

  // Data
  const [patientId, setPatientId] = useState<string | null>(null);
  const [carePlanSupplements, setCarePlanSupplements] = useState<string[]>([]);
  const [alreadyCheckedIn, setAlreadyCheckedIn] = useState(false);

  // UI state
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [streak, setStreak] = useState(0);

  // Load patient id + check if already checked in today
  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/sign-in");
        return;
      }

      const { data: patient } = (await supabase
        .from("patients")
        .select("id, practitioner_id")
        .eq("profile_id", user.id)
        .single()) as {
        data: { id: string; practitioner_id: string | null } | null;
        error: unknown;
      };

      if (!patient) {
        router.push("/onboarding/patient");
        return;
      }

      setPatientId(patient.id);

      const todayStr = new Date().toISOString().slice(0, 10);

      // Check today's check-in
      const { data: todayCheckIn } = (await supabase
        .from("check_ins")
        .select("id")
        .eq("patient_id", patient.id)
        .gte("checked_in_at", todayStr + "T00:00:00")
        .lte("checked_in_at", todayStr + "T23:59:59")
        .maybeSingle()) as { data: { id: string } | null; error: unknown };

      if (todayCheckIn) {
        setAlreadyCheckedIn(true);
        return;
      }

      // Load supplements from latest care plan
      if (patient.practitioner_id) {
        const { data: cp } = (await supabase
          .from("care_plans")
          .select("supplements")
          .eq("patient_id", patient.id)
          .order("week_number", { ascending: false })
          .limit(1)
          .maybeSingle()) as {
          data: { supplements: unknown } | null;
          error: unknown;
        };

        if (cp?.supplements && Array.isArray(cp.supplements)) {
          const names = (cp.supplements as Array<{ name?: string } | string>)
            .map((s) => (typeof s === "string" ? s : s?.name ?? ""))
            .filter(Boolean);
          setCarePlanSupplements(names);
        }
      }
    }

    load();
  }, [router, supabase]);

  function toggleSymptom(s: string) {
    setSymptoms((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );
  }

  function toggleSupplement(s: string) {
    setSupplementsTaken((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!patientId) return;
    if (mood === null) {
      setError("Please select your mood before submitting.");
      return;
    }
    setError(null);
    setSubmitting(true);

    const { error: insertError } = await supabase.from("check_ins").insert({
      patient_id: patientId,
      mood_score: mood,
      energy_score: energy,
      sleep_hours: sleepHours,
      digestion_score: digestion,
      symptoms: symptoms.length > 0 ? symptoms : null,
      supplements_taken: supplementsTaken.length > 0 ? supplementsTaken : null,
      notes: notes.trim() || null,
    });

    if (insertError) {
      setError("Something went wrong. Please try again.");
      setSubmitting(false);
      return;
    }

    // Calculate new streak
    const { data: allCheckIns } = await supabase
      .from("check_ins")
      .select("checked_in_at")
      .eq("patient_id", patientId)
      .order("checked_in_at", { ascending: false })
      .limit(90);

    const newStreak = calcStreak(
      (allCheckIns ?? []).map((c) => c.checked_in_at)
    );
    setStreak(newStreak);
    setDone(true);
  }

  // ── Already checked in ─────────────────────────────────────────────────────

  if (alreadyCheckedIn) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center p-8 text-center">
        <CheckCircle2 className="text-nesema-sage mb-4" size={48} />
        <h1 className="font-serif text-3xl text-nesema-t1 mb-2">
          Already checked in today
        </h1>
        <p className="text-nesema-t3 mb-8 max-w-sm">
          You&apos;ve already logged your check-in for today. Come back
          tomorrow to keep your streak going!
        </p>
        <Link
          href="/patient/dashboard"
          className="px-6 py-2.5 rounded-full bg-nesema-bark text-white text-sm font-medium hover:bg-nesema-bark/90 transition-colors"
        >
          Back to dashboard
        </Link>
      </div>
    );
  }

  // ── Success screen ─────────────────────────────────────────────────────────

  if (done) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center p-8 text-center">
        <div className="h-20 w-20 rounded-full bg-nesema-sage/10 flex items-center justify-center mb-6">
          <CheckCircle2 className="text-nesema-sage" size={40} />
        </div>
        <h1 className="font-serif text-3xl text-nesema-t1 mb-2">
          Check-in logged!
        </h1>
        {streak > 0 && (
          <div className="flex items-center gap-2 text-orange-500 font-medium text-lg mb-3">
            <Flame size={20} />
            <span>{streak}-day streak</span>
          </div>
        )}
        <p className="text-nesema-t3 mb-8 max-w-sm">
          {streak >= 7
            ? "Amazing consistency — your practitioner will love seeing this data."
            : streak >= 3
              ? "You're building a great habit. Keep it up!"
              : "Great start — every check-in helps your practitioner support you better."}
        </p>
        <Link
          href="/patient/dashboard"
          className="px-6 py-2.5 rounded-full bg-nesema-bark text-white text-sm font-medium hover:bg-nesema-bark/90 transition-colors"
        >
          Back to dashboard
        </Link>
      </div>
    );
  }

  // ── Form ───────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 md:p-8 max-w-2xl mx-auto">
      <h1 className="font-serif text-3xl text-nesema-t1 mb-1">
        Daily check-in
      </h1>
      <p className="text-nesema-t3 text-sm mb-8">
        {new Date().toLocaleDateString("en-GB", {
          weekday: "long",
          day: "numeric",
          month: "long",
        })}
      </p>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Mood */}
        <section>
          <h2 className="font-medium text-nesema-t1 mb-1">
            How are you feeling today?
          </h2>
          <p className="text-nesema-t3 text-xs mb-4">Overall mood</p>
          <div className="flex gap-3 flex-wrap">
            {MOOD_OPTIONS.map((opt) => (
              <button
                key={opt.score}
                type="button"
                onClick={() => setMood(opt.score)}
                className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-colors min-w-[64px] ${
                  mood === opt.score
                    ? "border-nesema-sage bg-nesema-sage/10"
                    : "border-nesema-bdr bg-white hover:border-nesema-sage/40"
                }`}
              >
                <span className="text-2xl">{opt.emoji}</span>
                <span className="text-xs text-nesema-t3">{opt.label}</span>
              </button>
            ))}
          </div>
        </section>

        {/* Energy */}
        <section>
          <div className="flex items-center justify-between mb-1">
            <h2 className="font-medium text-nesema-t1">Energy level</h2>
            <span className="text-nesema-sage font-semibold tabular-nums">
              {energy}/10
            </span>
          </div>
          <p className="text-nesema-t3 text-xs mb-4">
            1 = exhausted, 10 = fully energised
          </p>
          <input
            type="range"
            min={1}
            max={10}
            step={1}
            value={energy}
            onChange={(e) => setEnergy(Number(e.target.value))}
            className="w-full accent-nesema-sage"
          />
          <div className="flex justify-between text-xs text-nesema-t3 mt-1">
            <span>Exhausted</span>
            <span>Energised</span>
          </div>
        </section>

        {/* Sleep */}
        <section>
          <div className="flex items-center justify-between mb-1">
            <h2 className="font-medium text-nesema-t1">Sleep last night</h2>
            <span className="text-nesema-sage font-semibold tabular-nums">
              {sleepHours}h
            </span>
          </div>
          <p className="text-nesema-t3 text-xs mb-4">
            Approximate hours of sleep
          </p>
          <input
            type="range"
            min={2}
            max={12}
            step={0.5}
            value={sleepHours}
            onChange={(e) => setSleepHours(Number(e.target.value))}
            className="w-full accent-nesema-sage"
          />
          <div className="flex justify-between text-xs text-nesema-t3 mt-1">
            <span>2h</span>
            <span>12h</span>
          </div>
        </section>

        {/* Digestion */}
        <section>
          <div className="flex items-center justify-between mb-1">
            <h2 className="font-medium text-nesema-t1">Digestion</h2>
            <span className="text-nesema-sage font-semibold tabular-nums">
              {digestion}/10
            </span>
          </div>
          <p className="text-nesema-t3 text-xs mb-4">
            1 = very uncomfortable, 10 = no issues
          </p>
          <input
            type="range"
            min={1}
            max={10}
            step={1}
            value={digestion}
            onChange={(e) => setDigestion(Number(e.target.value))}
            className="w-full accent-nesema-sage"
          />
          <div className="flex justify-between text-xs text-nesema-t3 mt-1">
            <span>Uncomfortable</span>
            <span>No issues</span>
          </div>
        </section>

        {/* Symptoms */}
        <section>
          <h2 className="font-medium text-nesema-t1 mb-1">
            Any symptoms today?
          </h2>
          <p className="text-nesema-t3 text-xs mb-4">Select all that apply</p>
          <div className="flex flex-wrap gap-2">
            {COMMON_SYMPTOMS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => toggleSymptom(s)}
                className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                  symptoms.includes(s)
                    ? "border-nesema-bark bg-nesema-bark text-white"
                    : "border-nesema-bdr bg-white text-nesema-t2 hover:border-nesema-bark/40"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </section>

        {/* Supplements */}
        {carePlanSupplements.length > 0 && (
          <section>
            <h2 className="font-medium text-nesema-t1 mb-1">
              Supplements taken today
            </h2>
            <p className="text-nesema-t3 text-xs mb-4">
              Tick the ones you&apos;ve taken
            </p>
            <div className="space-y-2">
              {carePlanSupplements.map((s) => (
                <label
                  key={s}
                  className="flex items-center gap-3 cursor-pointer group"
                >
                  <span
                    className={`h-5 w-5 flex-shrink-0 rounded border-2 flex items-center justify-center transition-colors ${
                      supplementsTaken.includes(s)
                        ? "border-nesema-sage bg-nesema-sage"
                        : "border-nesema-bdr group-hover:border-nesema-sage/50"
                    }`}
                    onClick={() => toggleSupplement(s)}
                  >
                    {supplementsTaken.includes(s) && (
                      <svg
                        width="10"
                        height="8"
                        viewBox="0 0 10 8"
                        fill="none"
                      >
                        <path
                          d="M1 4L3.5 6.5L9 1"
                          stroke="white"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </span>
                  <span
                    className="text-sm text-nesema-t2"
                    onClick={() => toggleSupplement(s)}
                  >
                    {s}
                  </span>
                </label>
              ))}
            </div>
          </section>
        )}

        {/* Notes */}
        <section>
          <h2 className="font-medium text-nesema-t1 mb-1">
            Anything else to note?
          </h2>
          <p className="text-nesema-t3 text-xs mb-3">
            Optional — visible to your practitioner
          </p>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            placeholder="e.g. Had a stressful day at work, tried the new recipe from the meal plan…"
            className="w-full rounded-xl border border-nesema-bdr bg-white px-4 py-3 text-sm text-nesema-t1 placeholder:text-nesema-t3 focus:outline-none focus:ring-2 focus:ring-nesema-sage/40 resize-none"
          />
        </section>

        {/* Error */}
        {error && (
          <p className="text-red-500 text-sm">{error}</p>
        )}

        {/* Submit */}
        <div className="flex items-center gap-4 pt-2 pb-8">
          <button
            type="submit"
            disabled={submitting}
            className="px-8 py-3 rounded-full bg-nesema-bark text-white text-sm font-medium hover:bg-nesema-bark/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {submitting ? "Saving…" : "Submit check-in"}
          </button>
          <Link
            href="/patient/dashboard"
            className="text-sm text-nesema-t3 hover:text-nesema-t2 transition-colors"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
