import { createClient } from "@supabase/supabase-js";
import { Users, Stethoscope, CalendarDays, PoundSterling, TrendingUp, UserPlus, Sparkles } from "lucide-react";
import type { Database } from "@/types/database";

function adminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// ── Shared UI helpers ─────────────────────────────────────────────────────────
function StatCard({
  icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="bg-nesema-surf rounded-2xl border border-nesema-bdr p-5">
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center mb-3"
        style={{ backgroundColor: accent ? accent + "22" : "#C27D3022" }}
      >
        <span style={{ color: accent ?? "#C27D30" }}>{icon}</span>
      </div>
      <p className="text-xs text-nesema-t3 uppercase tracking-widest font-semibold mb-1">{label}</p>
      <p className="font-serif text-3xl text-nesema-t1">{value}</p>
      {sub && <p className="text-xs text-nesema-t3 mt-1">{sub}</p>}
    </div>
  );
}

// ── CSS bar chart ─────────────────────────────────────────────────────────────
function BarChart({
  data,
  maxValue,
  color,
}: {
  data: { label: string; value: number }[];
  maxValue: number;
  color: string;
}) {
  return (
    <div className="flex items-end gap-2 h-32">
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1">
          <div
            className="w-full rounded-t-md transition-all"
            style={{
              height: maxValue > 0 ? `${(d.value / maxValue) * 100}%` : "4px",
              backgroundColor: color,
              minHeight: "4px",
            }}
          />
          <span className="text-[10px] text-nesema-t4 text-center leading-tight">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

function StackedBarChart({
  data,
}: {
  data: { label: string; prac: number; patient: number }[];
}) {
  const max = Math.max(...data.map((d) => d.prac + d.patient), 1);
  return (
    <div className="flex items-end gap-2 h-32">
      {data.map((d, i) => {
        const totalPct = ((d.prac + d.patient) / max) * 100;
        const pracPct = d.prac + d.patient > 0 ? (d.prac / (d.prac + d.patient)) * 100 : 50;
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <div
              className="w-full rounded-t-md overflow-hidden flex flex-col justify-end"
              style={{ height: `${Math.max(totalPct, 4)}%`, minHeight: "4px" }}
            >
              <div style={{ height: `${pracPct}%`, backgroundColor: "#4E7A5F" }} />
              <div style={{ height: `${100 - pracPct}%`, backgroundColor: "#4A7FA0" }} />
            </div>
            <span className="text-[10px] text-nesema-t4 text-center leading-tight">{d.label}</span>
          </div>
        );
      })}
    </div>
  );
}

export const dynamic = "force-dynamic";

export default async function AdminOverviewPage() {
  const supabase = adminClient();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const weekStart = new Date(now.getTime() - 7 * 86400000).toISOString();

  // ── Parallel data fetches ─────────────────────────────────────────────────
  interface AuditLogRow {
    id: string;
    action: string;
    target_type: string | null;
    target_id: string | null;
    created_at: string;
    profiles: { first_name: string | null; last_name: string | null; email: string | null } | null;
  }

  const [
    { count: totalPrac },
    { count: verifiedPrac },
    { count: pendingPrac },
    { count: totalPatients },
    { count: appointmentsMonth },
    { data: revenueData },
    { data: checkinData },
    { data: newSignups },
    { data: auditLogRaw },
    { data: recentProfiles },
    { count: aiCallsWeek },
    { data: aiFeatureBreakdownRaw },
  ] = await Promise.all([
    supabase.from("practitioners").select("*", { count: "exact", head: true }),
    supabase
      .from("practitioners")
      .select("*", { count: "exact", head: true })
      .eq("verification_status", "verified"),
    supabase
      .from("practitioners")
      .select("*", { count: "exact", head: true })
      .eq("verification_status", "pending"),
    supabase.from("patients").select("*", { count: "exact", head: true }),
    supabase
      .from("appointments")
      .select("*", { count: "exact", head: true })
      .eq("status", "scheduled")
      .gte("scheduled_at", monthStart),
    supabase
      .from("appointments")
      .select("amount_pence")
      .eq("status", "completed")
      .gte("created_at", monthStart),
    supabase.from("check_ins").select("id").gte("checked_in_at", monthStart),
    supabase
      .from("profiles")
      .select("id, role, created_at")
      .gte("created_at", weekStart),
    supabase
      .from("admin_audit_log")
      .select(`
        id,
        action,
        target_type,
        target_id,
        created_at,
        profiles ( first_name, last_name, email )
      `)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("profiles")
      .select("id, role, first_name, last_name, email, created_at")
      .order("created_at", { ascending: false })
      .limit(20),

    // AI usage stats
    supabase
      .from("ai_usage_log")
      .select("*", { count: "exact", head: true })
      .gte("created_at", weekStart),

    supabase
      .from("ai_usage_log")
      .select("feature, created_at")
      .gte("created_at", weekStart),
  ]);

  const auditLog = (auditLogRaw ?? []) as unknown as AuditLogRow[];

  const revenueThisMonth =
    (revenueData ?? []).reduce((acc, r) => acc + (r.amount_pence ?? 0), 0) / 100;

  // ── Weekly sign-up chart (last 8 weeks) ───────────────────────────────────
  const weeklySignups = Array.from({ length: 8 }, (_, i) => {
    const weekEnd = new Date(now.getTime() - i * 7 * 86400000);
    const weekStartDate = new Date(weekEnd.getTime() - 7 * 86400000);
    const label = weekEnd.toLocaleDateString("en-GB", { day: "numeric", month: "short" }).replace(" ", "\n");
    const weekProfiles = (recentProfiles ?? []).filter((p) => {
      const d = new Date(p.created_at);
      return d >= weekStartDate && d < weekEnd;
    });
    return {
      label,
      prac: weekProfiles.filter((p) => p.role === "practitioner").length,
      patient: weekProfiles.filter((p) => p.role === "patient").length,
    };
  }).reverse();

  // ── Revenue chart (last 8 weeks) ──────────────────────────────────────────
  // We don't have granular enough data from just this month, so show static placeholders
  const weeklyRevenue = Array.from({ length: 8 }, (_, i) => {
    const d = new Date(now.getTime() - (7 - i) * 7 * 86400000);
    return {
      label: d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }).replace(" ", "\n"),
      value: i === 7 ? revenueThisMonth : 0,
    };
  });
  const maxRevenue = Math.max(...weeklyRevenue.map((w) => w.value), 1);

  const newSignupCount = (newSignups ?? []).length;

  // AI usage breakdown by feature
  const aiFeatureBreakdown: Record<string, number> = {};
  (aiFeatureBreakdownRaw ?? []).forEach((row: { feature: string }) => {
    aiFeatureBreakdown[row.feature] = (aiFeatureBreakdown[row.feature] ?? 0) + 1;
  });
  const aiBreakdownEntries = Object.entries(aiFeatureBreakdown).sort(
    (a, b) => b[1] - a[1]
  );

  const showAuditLog = (auditLog ?? []).length > 0;
  const activityItems = showAuditLog
    ? (auditLog ?? []).map((a) => {
        const profile = Array.isArray(a.profiles) ? a.profiles[0] : a.profiles;
        const adminName = profile
          ? `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim() || profile.email
          : "Unknown admin";
        return {
          adminName,
          action: a.action,
          targetType: a.target_type,
          targetId: a.target_id,
          time: new Date(a.created_at).toLocaleString("en-GB", {
            day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
          }),
        };
      })
    : (recentProfiles ?? []).map((p) => ({
        adminName: "System",
        action: `New ${p.role} signed up`,
        targetType: "profile",
        targetId: p.id,
        time: new Date(p.created_at).toLocaleString("en-GB", {
          day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
        }),
      }));

  return (
    <div className="p-6 md:p-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="font-serif text-3xl text-nesema-t1">Platform overview</h1>
        <p className="text-sm text-nesema-t3 mt-1">
          {now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        <StatCard
          icon={<Stethoscope size={16} />}
          label="Practitioners"
          value={String(totalPrac ?? 0)}
          sub={`${verifiedPrac ?? 0} verified · ${pendingPrac ?? 0} pending`}
        />
        <StatCard
          icon={<Users size={16} />}
          label="Patients"
          value={String(totalPatients ?? 0)}
          accent="#4E7A5F"
        />
        <StatCard
          icon={<CalendarDays size={16} />}
          label="Sessions this month"
          value={String(appointmentsMonth ?? 0)}
          accent="#4A7FA0"
        />
        <StatCard
          icon={<PoundSterling size={16} />}
          label="Revenue this month"
          value={`£${revenueThisMonth.toFixed(0)}`}
        />
        <StatCard
          icon={<TrendingUp size={16} />}
          label="Check-ins this month"
          value={String((checkinData ?? []).length)}
          accent="#4E7A5F"
        />
        <StatCard
          icon={<UserPlus size={16} />}
          label="New sign-ups (7d)"
          value={String(newSignupCount)}
          accent="#7B6FA8"
        />
        <StatCard
          icon={<Sparkles size={16} />}
          label="AI calls (7d)"
          value={String(aiCallsWeek ?? 0)}
          accent="#7C3AED"
        />
      </div>

      {/* Charts */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-nesema-surf rounded-2xl border border-nesema-bdr p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-nesema-t1">Sign-ups by week</h2>
            <div className="flex items-center gap-3 text-xs text-nesema-t3">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-sm inline-block bg-nesema-sage" />
                Practitioners
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-sm inline-block bg-nesema-sky" />
                Patients
              </span>
            </div>
          </div>
          <StackedBarChart data={weeklySignups} />
        </div>

        <div className="bg-nesema-surf rounded-2xl border border-nesema-bdr p-5">
          <h2 className="text-sm font-semibold text-nesema-t1 mb-4">Revenue by week</h2>
          <BarChart data={weeklyRevenue} maxValue={maxRevenue} color="#C27D30" />
        </div>
      </div>

      {/* AI Usage Breakdown */}
      {aiBreakdownEntries.length > 0 && (
        <div className="bg-nesema-surf rounded-2xl border border-nesema-bdr p-5">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles size={14} className="text-[#7C3AED]" />
            <h2 className="text-sm font-semibold text-nesema-t1">AI feature usage (7d)</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-nesema-bdr">
                  <th className="text-left text-xs text-nesema-t3 uppercase tracking-wide pb-2 font-semibold">Feature</th>
                  <th className="text-right text-xs text-nesema-t3 uppercase tracking-wide pb-2 font-semibold">Calls</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-nesema-bdr">
                {aiBreakdownEntries.map(([feature, count]) => (
                  <tr key={feature}>
                    <td className="py-2 text-nesema-t2 text-sm capitalize">
                      {feature.replace(/-/g, " ")}
                    </td>
                    <td className="py-2 text-right text-nesema-t1 font-medium text-sm">
                      {count}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Activity feed */}
      <div className="bg-nesema-surf rounded-2xl border border-nesema-bdr p-5">
        <h2 className="text-sm font-semibold text-nesema-t1 mb-4">
          {showAuditLog ? "Recent admin actions" : "Recent sign-ups"}
        </h2>
        {activityItems.length === 0 ? (
          <p className="text-sm text-nesema-t3 py-4 text-center">No activity yet — actions will appear here.</p>
        ) : (
          <div className="space-y-0 divide-y divide-nesema-bdr">
            {activityItems.map((item, i) => (
              <div key={i} className="flex items-start gap-3 py-3">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5"
                  style={{ backgroundColor: "#C27D3022", color: "#C27D30" }}
                >
                  {item.adminName.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-nesema-t1">
                    <span className="font-medium">{item.adminName}</span>
                    {" — "}
                    <span className="text-nesema-t2">{item.action}</span>
                    {item.targetType && (
                      <span className="text-nesema-t3 text-xs ml-1">
                        ({item.targetType})
                      </span>
                    )}
                  </p>
                </div>
                <span className="text-xs text-nesema-t4 flex-shrink-0">{item.time}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
