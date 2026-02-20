import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Users, CalendarDays, TrendingUp, CheckCircle2 } from "lucide-react";

export default async function AnalyticsPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: prac } = (await supabase
    .from("practitioners")
    .select("id")
    .eq("profile_id", user.id)
    .single()) as { data: { id: string } | null; error: unknown };

  if (!prac) redirect("/onboarding/practitioner");

  // Fetch all patients for this practitioner
  const { data: patients } = (await supabase
    .from("patients")
    .select("id")
    .eq("practitioner_id", prac.id)) as {
    data: { id: string }[] | null;
    error: unknown;
  };

  const patientIds = (patients ?? []).map((p) => p.id);
  const totalPatients = patientIds.length;

  // Fetch appointments
  const { data: appointments } = (await supabase
    .from("appointments")
    .select("id, scheduled_at, status")
    .eq("practitioner_id", prac.id)) as {
    data: { id: string; scheduled_at: string; status: string }[] | null;
    error: unknown;
  };

  const appts = appointments ?? [];
  const totalAppts = appts.length;
  const completedAppts = appts.filter((a) => a.status === "completed").length;
  const cancelledAppts = appts.filter(
    (a) => a.status === "cancelled" || a.status === "no_show"
  ).length;
  const upcomingAppts = appts.filter((a) => a.status === "scheduled").length;
  const completionRate =
    totalAppts > 0 ? Math.round((completedAppts / totalAppts) * 100) : null;

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const thisMonthAppts = appts.filter(
    (a) => new Date(a.scheduled_at) >= monthStart
  ).length;

  // Fetch check-ins for these patients
  const weekStart = new Date(Date.now() - 7 * 86400000).toISOString();
  let checkInsThisWeek = 0;
  let activeThisWeek = 0;
  let avgMood: string | null = null;

  if (patientIds.length > 0) {
    const { data: checkIns } = (await supabase
      .from("check_ins")
      .select("checked_in_at, mood_score, patient_id")
      .in("patient_id", patientIds)
      .order("checked_in_at", { ascending: false })
      .limit(500)) as {
      data: {
        checked_in_at: string;
        mood_score: number | null;
        patient_id: string;
      }[] | null;
      error: unknown;
    };

    const ci = checkIns ?? [];
    const recentCi = ci.filter((c) => c.checked_in_at >= weekStart);
    checkInsThisWeek = recentCi.length;
    activeThisWeek = new Set(recentCi.map((c) => c.patient_id)).size;

    const moodScores = ci
      .map((c) => c.mood_score)
      .filter((m): m is number => m !== null);
    if (moodScores.length > 0) {
      avgMood = (
        moodScores.reduce((s, m) => s + m, 0) / moodScores.length
      ).toFixed(1);
    }
  }

  const stats = [
    {
      label: "Total patients",
      value: totalPatients,
      icon: <Users className="text-nesema-sage" size={20} />,
      bg: "bg-nesema-sage/5",
    },
    {
      label: "Appointments this month",
      value: thisMonthAppts,
      icon: <CalendarDays className="text-blue-500" size={20} />,
      bg: "bg-blue-50",
    },
    {
      label: "Completion rate",
      value: completionRate !== null ? `${completionRate}%` : "—",
      icon: <CheckCircle2 className="text-green-500" size={20} />,
      bg: "bg-green-50",
    },
    {
      label: "Avg patient mood",
      value: avgMood !== null ? `${avgMood}/5` : "—",
      icon: <TrendingUp className="text-orange-400" size={20} />,
      bg: "bg-orange-50",
    },
  ];

  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto">
      <h1 className="font-serif text-3xl text-nesema-t1 mb-8">Analytics</h1>

      <div className="grid grid-cols-2 gap-4 mb-8">
        {stats.map((s) => (
          <div
            key={s.label}
            className={`rounded-2xl ${s.bg} border border-transparent p-5`}
          >
            <div className="mb-3">{s.icon}</div>
            <p className="text-2xl font-semibold text-nesema-t1">{s.value}</p>
            <p className="text-xs text-nesema-t3 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Engagement */}
      <div className="rounded-2xl bg-white border border-nesema-sage/20 p-6 mb-6">
        <h2 className="font-semibold text-nesema-t1 mb-4">
          Patient Engagement · Last 7 days
        </h2>
        <div className="grid grid-cols-2 gap-6 mb-4">
          <div>
            <p className="text-3xl font-semibold text-nesema-t1">
              {checkInsThisWeek}
            </p>
            <p className="text-xs text-nesema-t3 mt-1">Total check-ins</p>
          </div>
          <div>
            <p className="text-3xl font-semibold text-nesema-t1">
              {activeThisWeek}
              <span className="text-base text-nesema-t3 font-normal ml-1">
                / {totalPatients}
              </span>
            </p>
            <p className="text-xs text-nesema-t3 mt-1">Active patients</p>
          </div>
        </div>
        {totalPatients > 0 && (
          <div>
            <div className="flex items-center justify-between text-xs text-nesema-t3 mb-1.5">
              <span>Engagement rate</span>
              <span>
                {Math.round((activeThisWeek / totalPatients) * 100)}%
              </span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-nesema-sage rounded-full"
                style={{
                  width: `${Math.round((activeThisWeek / totalPatients) * 100)}%`,
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Appointment breakdown */}
      <div className="rounded-2xl bg-white border border-nesema-sage/20 p-6">
        <h2 className="font-semibold text-nesema-t1 mb-4">
          Appointment Breakdown
        </h2>
        <div className="space-y-3">
          {[
            { label: "Completed", count: completedAppts, color: "bg-green-400" },
            { label: "Upcoming", count: upcomingAppts, color: "bg-blue-400" },
            {
              label: "Cancelled / No-show",
              count: cancelledAppts,
              color: "bg-red-300",
            },
          ].map((row) => (
            <div key={row.label} className="flex items-center gap-3">
              <div
                className={`w-2.5 h-2.5 rounded-full shrink-0 ${row.color}`}
              />
              <span className="text-sm text-nesema-t2 flex-1">{row.label}</span>
              <span className="text-sm font-medium text-nesema-t1">
                {row.count}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
