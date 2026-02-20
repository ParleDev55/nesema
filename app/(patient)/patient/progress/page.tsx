import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Flame, TrendingUp } from "lucide-react";

type CheckIn = {
  id: string;
  checked_in_at: string;
  mood_score: number | null;
  energy_score: number | null;
  sleep_hours: number | null;
  digestion_score: number | null;
  symptoms: string[] | null;
  notes: string | null;
};

const MOOD_EMOJI: Record<number, string> = {
  1: "😞",
  2: "😐",
  3: "🙂",
  4: "😊",
  5: "😄",
};

function calcStreak(dates: string[]): number {
  if (!dates.length) return 0;
  const unique = Array.from(new Set(dates.map((d) => d.slice(0, 10)))).sort(
    (a, b) => (a > b ? -1 : 1)
  );
  const today = new Date().toISOString().slice(0, 10);
  let streak = 0;
  let cursor = today;
  for (const d of unique) {
    if (d === cursor) {
      streak++;
      const prev = new Date(cursor);
      prev.setDate(prev.getDate() - 1);
      cursor = prev.toISOString().slice(0, 10);
    } else break;
  }
  return streak;
}

function avg(arr: (number | null)[]): number | null {
  const vals = arr.filter((v): v is number => v !== null);
  if (!vals.length) return null;
  return Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 10) / 10;
}

export default async function ProgressPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: patient } = (await supabase
    .from("patients")
    .select("id")
    .eq("profile_id", user.id)
    .single()) as { data: { id: string } | null; error: unknown };

  if (!patient) redirect("/onboarding/patient");

  const { data: checkIns } = (await supabase
    .from("check_ins")
    .select(
      "id, checked_in_at, mood_score, energy_score, sleep_hours, digestion_score, symptoms, notes"
    )
    .eq("patient_id", patient.id)
    .order("checked_in_at", { ascending: false })
    .limit(60)) as { data: CheckIn[] | null; error: unknown };

  const items = checkIns ?? [];
  const streak = calcStreak(items.map((c) => c.checked_in_at));
  const avgMood = avg(items.map((c) => c.mood_score));
  const avgEnergy = avg(items.map((c) => c.energy_score));
  const avgSleep = avg(items.map((c) => c.sleep_hours));

  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto">
      <h1 className="font-serif text-3xl text-nesema-t1 mb-6">My Progress</h1>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-nesema-sage/40 p-10 text-center">
          <TrendingUp className="mx-auto mb-3 text-nesema-sage/50" size={36} />
          <p className="text-nesema-t1 font-medium mb-1">No check-ins yet</p>
          <p className="text-nesema-t3 text-sm max-w-xs mx-auto">
            Start your daily check-ins to track your progress over time.
          </p>
          <Link
            href="/patient/check-in"
            className="mt-4 inline-block px-5 py-2 bg-nesema-bark text-white text-sm rounded-full"
          >
            Check in now
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              {
                label: "Current streak",
                value: `${streak} day${streak !== 1 ? "s" : ""}`,
                icon: <Flame className="text-orange-400" size={18} />,
              },
              {
                label: "Total check-ins",
                value: String(items.length),
                icon: <TrendingUp className="text-nesema-sage" size={18} />,
              },
              {
                label: "Avg mood",
                value:
                  avgMood !== null
                    ? `${avgMood} ${MOOD_EMOJI[Math.round(avgMood)] ?? ""}`
                    : "—",
                icon: null,
              },
              {
                label: "Avg sleep",
                value: avgSleep !== null ? `${avgSleep}h` : "—",
                icon: null,
              },
            ].map((s) => (
              <div
                key={s.label}
                className="rounded-2xl bg-white border border-nesema-sage/20 p-4"
              >
                <div className="flex items-center gap-1.5 mb-1">
                  {s.icon}
                  <p className="text-[11px] text-nesema-t3 uppercase tracking-wider">
                    {s.label}
                  </p>
                </div>
                <p className="text-xl font-semibold text-nesema-t1">{s.value}</p>
              </div>
            ))}
          </div>

          {/* Avg energy note if available */}
          {avgEnergy !== null && (
            <p className="text-xs text-nesema-t3 -mt-2">
              Average energy: {avgEnergy}/5
            </p>
          )}

          {/* 14-day mood bar chart */}
          <div className="rounded-2xl bg-white border border-nesema-sage/20 p-5">
            <h2 className="text-sm font-semibold text-nesema-t1 mb-4">
              Last 14 days · Mood
            </h2>
            <div className="flex items-end gap-1.5 h-24">
              {Array.from({ length: 14 }, (_, i) => {
                const daysAgo = 13 - i;
                const d = new Date();
                d.setDate(d.getDate() - daysAgo);
                const dayStr = d.toISOString().slice(0, 10);
                const found = items
                  .slice(0, 14)
                  .find((c) => c.checked_in_at.startsWith(dayStr));
                const score = found?.mood_score ?? null;
                const pct = score !== null ? (score / 5) * 100 : 0;
                return (
                  <div
                    key={i}
                    className="flex-1 flex flex-col items-center gap-1"
                  >
                    <div
                      className="w-full rounded-t-sm"
                      style={{
                        height: `${Math.max(pct, 4)}%`,
                        backgroundColor: score ? "#6B8F71" : "#e5e7eb",
                        opacity: score ? 1 : 0.5,
                      }}
                    />
                    <span className="text-[9px] text-nesema-t3">
                      {d.toLocaleDateString("en-GB", { weekday: "narrow" })}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recent check-ins list */}
          <div className="rounded-2xl bg-white border border-nesema-sage/20 p-5">
            <h2 className="text-sm font-semibold text-nesema-t1 mb-4">
              Recent check-ins
            </h2>
            <div className="space-y-3">
              {items.slice(0, 14).map((c) => (
                <div
                  key={c.id}
                  className="flex items-start gap-3 py-2 border-b border-gray-50 last:border-0"
                >
                  <div className="text-lg leading-none mt-0.5">
                    {c.mood_score ? MOOD_EMOJI[c.mood_score] : "—"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-nesema-t3">
                      {new Date(c.checked_in_at).toLocaleDateString("en-GB", {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                      })}
                    </p>
                    <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-0.5">
                      {c.energy_score !== null && (
                        <span className="text-xs text-nesema-t2">
                          Energy {c.energy_score}/5
                        </span>
                      )}
                      {c.sleep_hours !== null && (
                        <span className="text-xs text-nesema-t2">
                          Sleep {c.sleep_hours}h
                        </span>
                      )}
                      {c.digestion_score !== null && (
                        <span className="text-xs text-nesema-t2">
                          Digestion {c.digestion_score}/5
                        </span>
                      )}
                    </div>
                    {c.symptoms && c.symptoms.length > 0 && (
                      <p className="text-xs text-nesema-t3 mt-0.5 truncate">
                        Symptoms: {c.symptoms.join(", ")}
                      </p>
                    )}
                    {c.notes && (
                      <p className="text-xs text-nesema-t3 mt-0.5 truncate">
                        {c.notes}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
