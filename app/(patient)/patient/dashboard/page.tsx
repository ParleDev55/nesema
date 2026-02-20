import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  Flame,
  ClipboardCheck,
  CalendarDays,
  Clock,
  Leaf,
  CheckCircle2,
  Video,
  MessageSquare,
} from "lucide-react";
import { AiInsightCard } from "@/components/shared/AiInsightCard";

// ── helpers ──────────────────────────────────────────────────────────────────

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

function programmeWeek(start: string | null): number {
  if (!start) return 1;
  const diff =
    new Date().getTime() - new Date(start).getTime();
  return Math.max(1, Math.floor(diff / (7 * 24 * 60 * 60 * 1000)) + 1);
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function isWithin15Min(iso: string) {
  const diff = new Date(iso).getTime() - Date.now();
  return diff >= -60_000 && diff <= 15 * 60_000;
}

const MOOD_EMOJI: Record<number, string> = {
  1: "😞",
  2: "😐",
  3: "🙂",
  4: "😊",
  5: "😄",
};

// ── page ─────────────────────────────────────────────────────────────────────

export default async function PatientDashboardPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  // Profile
  const { data: profile } = (await supabase
    .from("profiles")
    .select("first_name, last_name")
    .eq("id", user.id)
    .single()) as {
    data: { first_name: string | null; last_name: string | null } | null;
    error: unknown;
  };

  // Patient record
  const { data: patient } = (await supabase
    .from("patients")
    .select(
      "id, practitioner_id, programme_start, programme_weeks"
    )
    .eq("profile_id", user.id)
    .single()) as {
    data: {
      id: string;
      practitioner_id: string | null;
      programme_start: string | null;
      programme_weeks: number | null;
    } | null;
    error: unknown;
  };

  if (!patient) redirect("/onboarding/patient");

  // Parallel fetches
  const [checkInsRes, nextApptRes, carePlanRes, practitionerRes, fullCheckInsRes] =
    await Promise.all([
      supabase
        .from("check_ins")
        .select("checked_in_at, mood_score")
        .eq("patient_id", patient.id)
        .order("checked_in_at", { ascending: false })
        .limit(90),

      supabase
        .from("appointments")
        .select("scheduled_at, duration_mins, location_type")
        .eq("patient_id", patient.id)
        .eq("status", "scheduled")
        .gt("scheduled_at", new Date().toISOString())
        .order("scheduled_at", { ascending: true })
        .limit(1)
        .maybeSingle(),

      patient.practitioner_id
        ? supabase
            .from("care_plans")
            .select("goals, supplements, notes")
            .eq("patient_id", patient.id)
            .order("week_number", { ascending: false })
            .limit(1)
            .maybeSingle()
        : Promise.resolve({ data: null }),

      patient.practitioner_id
        ? supabase
            .from("practitioners")
            .select(
              "profile_id, practice_name, discipline"
            )
            .eq("id", patient.practitioner_id)
            .single()
        : Promise.resolve({ data: null }),

      // Full check-in data for AI (last 14)
      supabase
        .from("check_ins")
        .select("*")
        .eq("patient_id", patient.id)
        .order("checked_in_at", { ascending: false })
        .limit(14),
    ]);

  const checkIns = checkInsRes.data ?? [];
  const nextAppt = nextApptRes.data ?? null;
  const carePlan = carePlanRes.data ?? null;
  const practitioner = practitionerRes.data ?? null;
  type FullCheckIn = {
    id: string;
    patient_id: string;
    checked_in_at: string;
    mood_score: number | null;
    energy_score: number | null;
    sleep_hours: number | null;
    digestion_score: number | null;
    symptoms: string[] | null;
    supplements_taken: string[] | null;
    notes: string | null;
  };
  const fullCheckIns = (fullCheckInsRes.data ?? []) as FullCheckIn[];

  // Derived values
  const streak = calcStreak(checkIns.map((c) => c.checked_in_at));
  const totalCheckIns = checkIns.length;
  const week = programmeWeek(patient.programme_start);

  // AI data computations
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const last7Full = fullCheckIns.filter(
    (c) => c.checked_in_at.slice(0, 10) >= sevenDaysAgo
  );
  const showWeeklySummary = last7Full.length >= 3;

  const avg14 = (vals: (number | null)[]): string => {
    const v = vals.filter((x): x is number => x !== null);
    return v.length ? (v.reduce((a, b) => a + b, 0) / v.length).toFixed(1) : "N/A";
  };
  const avgEnergy = avg14(fullCheckIns.map((c) => c.energy_score));
  const avgSleep = avg14(fullCheckIns.map((c) => c.sleep_hours));
  const avgDigestion = avg14(fullCheckIns.map((c) => c.digestion_score));
  const avgMood = avg14(fullCheckIns.map((c) => c.mood_score));

  const allSymptoms14 = fullCheckIns.flatMap((c) => (c.symptoms as string[] | null) ?? []);
  const symFreq: Record<string, number> = {};
  allSymptoms14.forEach((s) => { symFreq[s] = (symFreq[s] ?? 0) + 1; });
  const topSymptoms14 = Object.entries(symFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([s, n]) => `${s} (×${n})`)
    .join(", ") || "None";

  const allSymptoms7 = last7Full.flatMap((c) => (c.symptoms as string[] | null) ?? []);
  const symFreq7: Record<string, number> = {};
  allSymptoms7.forEach((s) => { symFreq7[s] = (symFreq7[s] ?? 0) + 1; });
  const topSymptoms7 = Object.entries(symFreq7)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([s]) => s)
    .join(", ") || "None";

  // Supplement names from care plan
  type Supp = { name?: string } | string;
  const suppList = Array.isArray(carePlan?.supplements)
    ? (carePlan!.supplements as Supp[]).map((s) =>
        typeof s === "string" ? s : (s?.name ?? "")
      ).filter(Boolean).join(", ")
    : "None";

  const firstName = profile?.first_name ?? "there";

  // Weekly summary message
  const weeklySummaryMessage = [
    `Patient first name: ${firstName}`,
    `Programme week: ${week}`,
    `Current goals: ${(carePlan?.goals as string[] | null ?? []).join(", ") || "None"}`,
    `Most common symptoms this week: ${topSymptoms7}`,
    "",
    "Last 7 check-ins (most recent first):",
    ...last7Full.map((c) =>
      `  ${c.checked_in_at.slice(0, 10)}: mood=${c.mood_score ?? "—"}/5, energy=${c.energy_score ?? "—"}/10, sleep=${c.sleep_hours ?? "—"}h, digestion=${c.digestion_score ?? "—"}/10`
    ),
  ].join("\n");

  const weeklySummarySystemPrompt =
    "You are a warm and encouraging health coach assistant. Write a personalised weekly progress summary for a patient in a holistic health programme. Reference their actual scores — energy, sleep, mood, digestion. Highlight what went well, acknowledge any struggles with empathy, and offer one simple actionable encouragement for the coming week. Write directly to the patient using their first name. Keep it to 3 short paragraphs. Warm, human, never clinical.";

  // Dashboard insight message
  const dashboardInsightMessage = [
    `Last 14 check-ins averaged scores:`,
    `  Avg energy: ${avgEnergy}/10`,
    `  Avg sleep: ${avgSleep}h`,
    `  Avg digestion: ${avgDigestion}/10`,
    `  Avg mood: ${avgMood}/5`,
    `Most common symptoms: ${topSymptoms14}`,
    `Current supplement protocol: ${suppList}`,
    `Active care plan goals: ${(carePlan?.goals as string[] | null ?? []).join("; ") || "None"}`,
  ].join("\n");

  const dashboardInsightSystemPrompt =
    "You are a supportive health assistant. Based on this patient's recent check-in data, provide one specific, actionable insight they can act on today. It should relate directly to their symptoms or scores — for example, a sleep hygiene tip if sleep is low, a gentle movement suggestion if energy is low, or a positive reinforcement if scores are improving. Write 2–3 sentences maximum. Warm and encouraging tone. No medical advice.";

  const todayStr = new Date().toISOString().slice(0, 10);
  const todaysCheckIn = checkIns.find((c) =>
    c.checked_in_at.startsWith(todayStr)
  );

  const goals: string[] = carePlan?.goals ?? [];

  // Practitioner profile_id for messages link
  const practProfileId = practitioner?.profile_id ?? null;

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-serif text-3xl text-nesema-t1 mb-1">
          Good{" "}
          {new Date().getHours() < 12
            ? "morning"
            : new Date().getHours() < 17
              ? "afternoon"
              : "evening"}
          {profile?.first_name ? `, ${profile.first_name}` : ""}
        </h1>
        <p className="text-nesema-t3 text-sm">
          {new Date().toLocaleDateString("en-GB", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard
          icon={<Flame className="text-orange-400" size={20} />}
          value={streak}
          label="Day streak"
          bg="bg-orange-50"
        />
        <StatCard
          icon={<ClipboardCheck className="text-nesema-sage" size={20} />}
          value={totalCheckIns}
          label="Total check-ins"
          bg="bg-sage-50"
        />
        <StatCard
          icon={<CalendarDays className="text-nesema-bark" size={20} />}
          value={`Week ${week}`}
          label="Programme"
          bg="bg-nesema-bg"
        />
        <StatCard
          icon={<Clock className="text-blue-400" size={20} />}
          value={nextAppt ? fmtTime(nextAppt.scheduled_at) : "—"}
          label={nextAppt ? fmtDate(nextAppt.scheduled_at) : "No upcoming session"}
          bg="bg-blue-50"
        />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Today's plan */}
        <div className="bg-white rounded-2xl border border-nesema-bdr p-6">
          <h2 className="font-serif text-xl text-nesema-t1 mb-4">
            Today&apos;s plan
          </h2>
          {goals.length > 0 ? (
            <ul className="space-y-3">
              {goals.map((g, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="mt-0.5 h-5 w-5 flex-shrink-0 rounded border-2 border-nesema-bdr" />
                  <span className="text-nesema-t2 text-sm">{g}</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex flex-col items-center py-8 text-center">
              <Leaf className="text-nesema-sage mb-3" size={32} />
              <p className="text-nesema-t2 text-sm font-medium mb-1">
                No plan yet
              </p>
              <p className="text-nesema-t3 text-xs">
                Your practitioner will add goals to your care plan soon.
              </p>
            </div>
          )}
        </div>

        {/* Check-in prompt */}
        <div className="bg-white rounded-2xl border border-nesema-bdr p-6 flex flex-col">
          <h2 className="font-serif text-xl text-nesema-t1 mb-4">
            Daily check-in
          </h2>
          {todaysCheckIn ? (
            <div className="flex-1 flex flex-col items-center justify-center py-4 text-center">
              <CheckCircle2
                className="text-nesema-sage mb-3"
                size={36}
              />
              <p className="text-nesema-t1 font-medium mb-1">
                Checked in today
              </p>
              {todaysCheckIn.mood_score && (
                <p className="text-2xl mb-1">
                  {MOOD_EMOJI[todaysCheckIn.mood_score]}
                </p>
              )}
              <p className="text-nesema-t3 text-xs">
                {streak > 0
                  ? `${streak}-day streak — keep it up!`
                  : "Great work staying consistent."}
              </p>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center py-4 text-center">
              <p className="text-nesema-t2 text-sm mb-5">
                How are you feeling today? Logging takes 60 seconds and
                helps your practitioner track your progress.
              </p>
              <Link
                href="/patient/check-in"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-nesema-bark text-white text-sm font-medium hover:bg-nesema-bark/90 transition-colors"
              >
                Log today&apos;s check-in
              </Link>
            </div>
          )}
        </div>

        {/* Next session */}
        {nextAppt && (
          <div className="bg-white rounded-2xl border border-nesema-bdr p-6">
            <h2 className="font-serif text-xl text-nesema-t1 mb-4">
              Next session
            </h2>
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                <Video className="text-blue-500" size={18} />
              </div>
              <div>
                <p className="text-nesema-t1 font-medium text-sm">
                  {nextAppt.location_type === "virtual"
                    ? "Video consultation"
                    : "In-person appointment"}
                </p>
                <p className="text-nesema-t3 text-xs">
                  {fmtDate(nextAppt.scheduled_at)} at{" "}
                  {fmtTime(nextAppt.scheduled_at)} ·{" "}
                  {nextAppt.duration_mins} min
                </p>
              </div>
            </div>
            {isWithin15Min(nextAppt.scheduled_at) ? (
              <button className="w-full py-2.5 rounded-full bg-nesema-sage text-white text-sm font-medium hover:bg-nesema-sage/90 transition-colors">
                Join session
              </button>
            ) : (
              <Link
                href="/patient/appointments"
                className="block w-full text-center py-2.5 rounded-full border border-nesema-bdr text-nesema-t2 text-sm font-medium hover:bg-nesema-bg transition-colors"
              >
                View details
              </Link>
            )}
          </div>
        )}

        {/* Care team */}
        {practitioner && (
          <div className="bg-white rounded-2xl border border-nesema-bdr p-6">
            <h2 className="font-serif text-xl text-nesema-t1 mb-4">
              Your care team
            </h2>
            <div className="flex items-center gap-4 mb-5">
              <div className="h-12 w-12 rounded-full bg-nesema-bg flex items-center justify-center border border-nesema-bdr">
                <span className="font-serif text-nesema-bark text-lg">
                  {(practitioner.practice_name ?? "P")[0].toUpperCase()}
                </span>
              </div>
              <div>
                <p className="text-nesema-t1 font-medium text-sm">
                  {practitioner.practice_name ?? "Your practitioner"}
                </p>
                {practitioner.discipline && (
                  <p className="text-nesema-t3 text-xs capitalize">
                    {practitioner.discipline}
                  </p>
                )}
              </div>
            </div>
            {practProfileId && (
              <Link
                href={`/patient/messages?to=${practProfileId}`}
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-full border border-nesema-bdr text-nesema-t2 text-sm font-medium hover:bg-nesema-bg transition-colors"
              >
                <MessageSquare size={15} />
                Send a message
              </Link>
            )}
          </div>
        )}
      </div>

      {/* ── AI Insight Cards ────────────────────────────────────────────────── */}
      {showWeeklySummary && (
        <AiInsightCard
          title={`Your Week in Review ✦`}
          systemPrompt={weeklySummarySystemPrompt}
          userMessage={weeklySummaryMessage}
          apiRoute="/api/ai/weekly-summary"
          cacheKey={`weekly-summary-${patient.id}`}
        />
      )}

      {fullCheckIns.length >= 3 && (
        <AiInsightCard
          title="Today&apos;s Insight ✦"
          systemPrompt={dashboardInsightSystemPrompt}
          userMessage={dashboardInsightMessage}
          apiRoute="/api/ai/dashboard-insight"
          cacheKey={`dashboard-insight-${patient.id}`}
        />
      )}
    </div>
  );
}

// ── sub-components ────────────────────────────────────────────────────────────

function StatCard({
  icon,
  value,
  label,
  bg,
}: {
  icon: React.ReactNode;
  value: string | number;
  label: string;
  bg: string;
}) {
  return (
    <div className={`${bg} rounded-2xl p-4 border border-nesema-bdr`}>
      <div className="mb-3">{icon}</div>
      <p className="font-serif text-2xl text-nesema-t1 leading-none mb-1">
        {value}
      </p>
      <p className="text-nesema-t3 text-xs">{label}</p>
    </div>
  );
}
