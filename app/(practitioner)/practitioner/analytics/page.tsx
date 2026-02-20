"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { TrendingUp, TrendingDown, Minus, PoundSterling, Users, CalendarCheck, Activity, AlertTriangle, Download } from "lucide-react";

type Period = "30d" | "90d" | "year";

type Appt = {
  id: string;
  scheduled_at: string;
  appointment_type: "initial" | "followup" | "review";
  status: string;
  amount_pence: number | null;
  patient_id: string;
};

type Patient = {
  id: string;
  profile_id: string;
  programme_start: string | null;
};

type CheckIn = {
  id: string;
  patient_id: string;
  checked_in_at: string;
  mood_score: number | null;
  energy_score: number | null;
  sleep_hours: number | null;
  digestion_score: number | null;
  symptoms: string[] | null;
};

type AvailRow = {
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
};

type PracData = {
  id: string;
  session_length_mins: number;
};

function getPeriodBounds(p: Period): { start: Date; end: Date; prevStart: Date; prevEnd: Date } {
  const now = new Date();
  const end = now;
  let start: Date;
  let prevStart: Date;
  let prevEnd: Date;

  if (p === "30d") {
    start = new Date(now.getTime() - 30 * 86400000);
    prevEnd = new Date(start.getTime() - 1);
    prevStart = new Date(prevEnd.getTime() - 30 * 86400000);
  } else if (p === "90d") {
    start = new Date(now.getTime() - 90 * 86400000);
    prevEnd = new Date(start.getTime() - 1);
    prevStart = new Date(prevEnd.getTime() - 90 * 86400000);
  } else {
    start = new Date(now.getFullYear(), 0, 1);
    prevStart = new Date(now.getFullYear() - 1, 0, 1);
    prevEnd = new Date(now.getFullYear() - 1, 11, 31);
  }
  return { start, end, prevStart, prevEnd };
}

function weekLabel(dateStr: string, period: Period): string {
  if (period === "year") {
    return new Date(dateStr + "T12:00:00").toLocaleDateString("en-GB", { month: "short" });
  }
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function groupByPeriod(appts: Appt[], period: Period): { label: string; revenue: number }[] {
  const buckets: Record<string, number> = {};

  for (const a of appts) {
    if (a.status !== "completed" || !a.amount_pence) continue;
    const d = new Date(a.scheduled_at);
    let key: string;
    if (period === "year") {
      key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
    } else {
      const dow = d.getDay();
      const diff = dow === 0 ? -6 : 1 - dow;
      const mon = new Date(d);
      mon.setDate(d.getDate() + diff);
      key = mon.toISOString().slice(0, 10);
    }
    buckets[key] = (buckets[key] ?? 0) + a.amount_pence;
  }

  return Object.entries(buckets)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, revenue]) => ({ label: weekLabel(k, period), revenue }));
}

function TrendIcon({ curr, prev }: { curr: number; prev: number }) {
  if (prev === 0) return <Minus size={12} className="text-[#9C9087]" />;
  const delta = curr - prev;
  if (delta > 0) return <TrendingUp size={12} className="text-[#4E7A5F]" />;
  if (delta < 0) return <TrendingDown size={12} className="text-[#B5704A]" />;
  return <Minus size={12} className="text-[#9C9087]" />;
}

function DonutChart({ segments }: { segments: { color: string; value: number; label: string; count: number }[] }) {
  const R = 40;
  const C = 2 * Math.PI * R;
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  let acc = 0;
  return (
    <div className="flex items-center gap-6">
      <svg width="100" height="100" viewBox="0 0 100 100">
        <g transform="rotate(-90 50 50)">
          {total === 0 ? (
            <circle cx={50} cy={50} r={R} fill="none" stroke="#E6E0D8" strokeWidth={18} />
          ) : (
            segments.map((seg) => {
              const dash = (seg.value / total) * C;
              const offset = -acc;
              acc += dash;
              if (seg.value === 0) return null;
              return (
                <circle
                  key={seg.label}
                  cx={50} cy={50} r={R}
                  fill="none"
                  stroke={seg.color}
                  strokeWidth={18}
                  strokeDasharray={`${dash} ${C}`}
                  strokeDashoffset={offset}
                />
              );
            })
          )}
        </g>
        <text x="50" y="50" textAnchor="middle" dominantBaseline="middle" fontSize="18" fontWeight="600" fill="#1E1A16">
          {total}
        </text>
        <text x="50" y="63" textAnchor="middle" dominantBaseline="middle" fontSize="7" fill="#9C9087">
          sessions
        </text>
      </svg>
      <div className="space-y-2">
        {segments.map((seg) => (
          <div key={seg.label} className="flex items-center gap-2 text-xs">
            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: seg.color }} />
            <span className="text-[#5C5248]">{seg.label}</span>
            <span className="font-semibold text-[#1E1A16]">{seg.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const supabase = createClient();
  const [period, setPeriod] = useState<Period>("30d");
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  const [prac, setPrac] = useState<PracData | null>(null);
  const [allAppts, setAllAppts] = useState<Appt[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [patientNames, setPatientNames] = useState<Record<string, string>>({});
  const [allCheckIns, setAllCheckIns] = useState<CheckIn[]>([]);
  const [avail, setAvail] = useState<AvailRow[]>([]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: pracData } = (await supabase
        .from("practitioners")
        .select("id, session_length_mins")
        .eq("profile_id", user.id)
        .single()) as { data: PracData | null; error: unknown };
      if (!pracData) return;
      setPrac(pracData);

      const [apptRes, patRes, ciRes, availRes] = await Promise.all([
        supabase.from("appointments")
          .select("id, scheduled_at, appointment_type, status, amount_pence, patient_id")
          .eq("practitioner_id", pracData.id)
          .order("scheduled_at", { ascending: true }),
        supabase.from("patients")
          .select("id, profile_id, programme_start")
          .eq("practitioner_id", pracData.id),
        supabase.from("check_ins")
          .select("id, patient_id, checked_in_at, mood_score, energy_score, sleep_hours, digestion_score, symptoms")
          .order("checked_in_at", { ascending: false })
          .limit(2000),
        supabase.from("availability")
          .select("day_of_week, start_time, end_time, is_active")
          .eq("practitioner_id", pracData.id),
      ]);

      const pts = (patRes.data ?? []) as Patient[];
      setPatients(pts);
      setAllAppts((apptRes.data ?? []) as Appt[]);
      setAllCheckIns((ciRes.data ?? []) as CheckIn[]);
      setAvail((availRes.data ?? []) as AvailRow[]);

      // Fetch patient names
      const profileIds = pts.map((p) => p.profile_id);
      if (profileIds.length > 0) {
        const { data: profiles } = (await supabase
          .from("profiles")
          .select("id, first_name, last_name")
          .in("id", profileIds)) as {
          data: { id: string; first_name: string | null; last_name: string | null }[] | null;
          error: unknown;
        };
        const pMap: Record<string, string> = {};
        for (const pr of profiles ?? []) {
          pMap[pr.id] = [pr.first_name, pr.last_name].filter(Boolean).join(" ") || "Patient";
        }
        const nameMap: Record<string, string> = {};
        for (const pt of pts) nameMap[pt.id] = pMap[pt.profile_id] ?? "Patient";
        setPatientNames(nameMap);
      }

      setLoading(false);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { start, end, prevStart, prevEnd } = useMemo(() => getPeriodBounds(period), [period]);

  const periodAppts = useMemo(
    () => allAppts.filter((a) => new Date(a.scheduled_at) >= start && new Date(a.scheduled_at) <= end),
    [allAppts, start, end]
  );
  const prevPeriodAppts = useMemo(
    () => allAppts.filter((a) => new Date(a.scheduled_at) >= prevStart && new Date(a.scheduled_at) <= prevEnd),
    [allAppts, prevStart, prevEnd]
  );

  const periodCheckIns = useMemo(
    () => allCheckIns.filter((c) => new Date(c.checked_in_at) >= start && new Date(c.checked_in_at) <= end),
    [allCheckIns, start, end]
  );
  const prevCheckIns = useMemo(
    () => allCheckIns.filter((c) => new Date(c.checked_in_at) >= prevStart && new Date(c.checked_in_at) <= prevEnd),
    [allCheckIns, prevStart, prevEnd]
  );

  // ── Stats ──────────────────────────────────────────────────────────────────
  const totalRevenue = useMemo(
    () => periodAppts.filter((a) => a.status === "completed").reduce((s, a) => s + (a.amount_pence ?? 0), 0),
    [periodAppts]
  );
  const prevRevenue = useMemo(
    () => prevPeriodAppts.filter((a) => a.status === "completed").reduce((s, a) => s + (a.amount_pence ?? 0), 0),
    [prevPeriodAppts]
  );

  const sessionsCompleted = useMemo(
    () => periodAppts.filter((a) => a.status === "completed").length,
    [periodAppts]
  );
  const prevSessionsCompleted = useMemo(
    () => prevPeriodAppts.filter((a) => a.status === "completed").length,
    [prevPeriodAppts]
  );

  const activePatients = patients.length;

  const avgCheckInRate = useMemo(() => {
    if (patients.length === 0) return 0;
    const rates = patients.map((pt) => {
      const ptCheckIns = periodCheckIns.filter((c) => c.patient_id === pt.id);
      const ptStart = pt.programme_start ? Math.max(new Date(pt.programme_start).getTime(), start.getTime()) : start.getTime();
      const ptDays = Math.max(1, Math.round((end.getTime() - ptStart) / 86400000));
      return Math.min(100, Math.round((ptCheckIns.length / ptDays) * 100));
    });
    return Math.round(rates.reduce((s, r) => s + r, 0) / patients.length);
  }, [patients, periodCheckIns, start, end]);

  // ── Bar chart ──────────────────────────────────────────────────────────────
  const barData = useMemo(() => groupByPeriod(periodAppts, period), [periodAppts, period]);
  const maxRevenue = useMemo(() => Math.max(...barData.map((b) => b.revenue), 1), [barData]);

  // ── Donut chart ────────────────────────────────────────────────────────────
  const donutSegments = useMemo(() => {
    const counts = { initial: 0, followup: 0, review: 0 };
    for (const a of periodAppts) {
      if (a.appointment_type in counts) counts[a.appointment_type as keyof typeof counts]++;
    }
    return [
      { label: "Initial", color: "#4E7A5F", value: counts.initial, count: counts.initial },
      { label: "Follow-up", color: "#B5704A", value: counts.followup, count: counts.followup },
      { label: "Review", color: "#4A7FA0", value: counts.review, count: counts.review },
    ];
  }, [periodAppts]);

  // ── Patient adherence ──────────────────────────────────────────────────────
  const adherenceRows = useMemo(() => {
    return patients.map((pt) => {
      const ptCheckIns = periodCheckIns.filter((c) => c.patient_id === pt.id);
      const ptStart = pt.programme_start ? Math.max(new Date(pt.programme_start).getTime(), start.getTime()) : start.getTime();
      const ptDays = Math.max(1, Math.round((end.getTime() - ptStart) / 86400000));
      const pct = Math.min(100, Math.round((ptCheckIns.length / ptDays) * 100));
      return { id: pt.id, name: patientNames[pt.id] ?? "Patient", pct };
    }).sort((a, b) => a.pct - b.pct);
  }, [patients, periodCheckIns, patientNames, start, end]);

  const lowAdherence = adherenceRows.filter((r) => r.pct < 50);

  // ── Patient-reported outcomes ──────────────────────────────────────────────
  const outcomes = useMemo(() => {
    const avg = (vals: (number | null)[]) => {
      const valid = vals.filter((v): v is number => v !== null);
      return valid.length > 0 ? valid.reduce((s, v) => s + v, 0) / valid.length : null;
    };
    const prevAvg = (vals: (number | null)[]) => {
      const valid = vals.filter((v): v is number => v !== null);
      return valid.length > 0 ? valid.reduce((s, v) => s + v, 0) / valid.length : null;
    };

    const metrics = [
      {
        label: "Energy",
        curr: avg(periodCheckIns.map((c) => c.energy_score)),
        prev: prevAvg(prevCheckIns.map((c) => c.energy_score)),
        max: 10,
      },
      {
        label: "Digestion",
        curr: avg(periodCheckIns.map((c) => c.digestion_score)),
        prev: prevAvg(prevCheckIns.map((c) => c.digestion_score)),
        max: 10,
      },
      {
        label: "Mood",
        curr: avg(periodCheckIns.map((c) => c.mood_score ? c.mood_score * 2 : null)),
        prev: prevAvg(prevCheckIns.map((c) => c.mood_score ? c.mood_score * 2 : null)),
        max: 10,
      },
      {
        label: "Sleep",
        curr: avg(periodCheckIns.map((c) => c.sleep_hours ? Math.min(10, (c.sleep_hours / 9) * 10) : null)),
        prev: prevAvg(prevCheckIns.map((c) => c.sleep_hours ? Math.min(10, (c.sleep_hours / 9) * 10) : null)),
        max: 10,
      },
    ];

    // Find best improvement
    const best = metrics
      .filter((m) => m.curr !== null && m.prev !== null)
      .map((m) => ({ ...m, delta: (m.curr! - m.prev!) }))
      .sort((a, b) => b.delta - a.delta)[0];

    return { metrics, best };
  }, [periodCheckIns, prevCheckIns]);

  // ── Symptoms ────────────────────────────────────────────────────────────────
  const topSymptoms = useMemo(() => {
    const counts: Record<string, number> = {};
    let total = 0;
    for (const ci of periodCheckIns) {
      for (const s of ci.symptoms ?? []) {
        counts[s] = (counts[s] ?? 0) + 1;
        total++;
      }
    }
    return Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([symptom, count]) => ({ symptom, count, pct: total > 0 ? Math.round((count / total) * 100) : 0 }));
  }, [periodCheckIns]);

  // ── Capacity ────────────────────────────────────────────────────────────────
  const capacity = useMemo(() => {
    const total = periodAppts.length;
    const cancelled = periodAppts.filter((a) => a.status === "cancelled").length;
    const noShow = periodAppts.filter((a) => a.status === "no_show").length;
    const cancelRate = total > 0 ? Math.round((cancelled / total) * 100) : 0;
    const noShowRate = total > 0 ? Math.round((noShow / total) * 100) : 0;

    const sessionLen = prac?.session_length_mins ?? 60;
    const weeklySlots = avail
      .filter((a) => a.is_active)
      .reduce((s, a) => {
        const [sh, sm] = a.start_time.split(":").map(Number);
        const [eh, em] = a.end_time.split(":").map(Number);
        const mins = (eh * 60 + em) - (sh * 60 + sm);
        return s + Math.floor(mins / sessionLen);
      }, 0);

    const weeks = Math.max(1, Math.round((end.getTime() - start.getTime()) / (7 * 86400000)));
    const totalSlots = weeklySlots * weeks;
    const usedSlots = periodAppts.filter((a) => a.status !== "cancelled").length;
    const utilPct = totalSlots > 0 ? Math.min(100, Math.round((usedSlots / totalSlots) * 100)) : 0;

    return { cancelRate, noShowRate, weeklySlots, utilPct, usedSlots, totalSlots };
  }, [periodAppts, avail, prac, start, end]);

  const PERIOD_LABELS: Record<Period, string> = {
    "30d": "Last 30 days",
    "90d": "Last 90 days",
    year: "This year",
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-[#4E7A5F] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl text-[#1E1A16]">Analytics &amp; Insights</h1>
          <p className="text-xs text-[#9C9087] mt-0.5">Your practice performance at a glance</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-[#F6F3EE] rounded-xl p-0.5">
            {(["30d", "90d", "year"] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  period === p ? "bg-white text-[#1E1A16] shadow-sm" : "text-[#9C9087] hover:text-[#5C5248]"
                }`}
              >
                {PERIOD_LABELS[p]}
              </button>
            ))}
          </div>
          <button
            onClick={() => { setToast("PDF export coming soon"); setTimeout(() => setToast(null), 3000); }}
            className="flex items-center gap-1.5 text-xs text-[#5C5248] border border-[#E6E0D8] px-3 py-1.5 rounded-full hover:bg-[#F6F3EE] transition-colors"
          >
            <Download size={13} /> Export PDF
          </button>
        </div>
      </div>

      {/* ── Stat cards ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            label: "Total Revenue",
            value: `£${(totalRevenue / 100).toFixed(0)}`,
            icon: PoundSterling,
            bg: "bg-[#EBF2EE]",
            ic: "text-[#4E7A5F]",
            delta: totalRevenue - prevRevenue,
            deltaLabel: prevRevenue > 0 ? `vs £${(prevRevenue / 100).toFixed(0)} prev` : "No previous data",
          },
          {
            label: "Sessions Completed",
            value: String(sessionsCompleted),
            icon: CalendarCheck,
            bg: "bg-[#E8F2F8]",
            ic: "text-[#4A7FA0]",
            delta: sessionsCompleted - prevSessionsCompleted,
            deltaLabel: prevSessionsCompleted > 0 ? `vs ${prevSessionsCompleted} prev` : "No previous data",
          },
          {
            label: "Active Patients",
            value: String(activePatients),
            icon: Users,
            bg: "bg-[#F5EDE8]",
            ic: "text-[#B5704A]",
            delta: 0,
            deltaLabel: "Currently active",
          },
          {
            label: "Avg Check-in Rate",
            value: `${avgCheckInRate}%`,
            icon: Activity,
            bg: "bg-[#F9F1E6]",
            ic: "text-[#C27D30]",
            delta: 0,
            deltaLabel: "Across all patients",
          },
        ].map(({ label, value, icon: Icon, bg, ic, delta, deltaLabel }) => (
          <div key={label} className="rounded-2xl bg-white border border-[#E6E0D8] p-4">
            <div className={`w-8 h-8 rounded-xl ${bg} flex items-center justify-center mb-3`}>
              <Icon size={15} className={ic} />
            </div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#9C9087] mb-1">{label}</p>
            <p className="text-2xl font-semibold text-[#1E1A16]">{value}</p>
            <div className="flex items-center gap-1 mt-1">
              {delta !== 0 && <TrendIcon curr={delta > 0 ? 1 : 0} prev={1} />}
              <span className="text-[10px] text-[#9C9087]">{deltaLabel}</span>
            </div>
          </div>
        ))}
      </div>

      {/* ── Revenue bar chart + donut ───────────────────────────────────────── */}
      <div className="grid md:grid-cols-[1fr_auto] gap-4">
        {/* Bar chart */}
        <div className="rounded-2xl bg-white border border-[#E6E0D8] p-5">
          <h2 className="font-semibold text-sm text-[#1E1A16] mb-1">Revenue by {period === "year" ? "Month" : "Week"}</h2>
          <p className="text-xs text-[#9C9087] mb-4">Completed sessions only</p>
          {barData.length === 0 ? (
            <div className="h-24 flex items-center justify-center text-sm text-[#9C9087]">No revenue data for this period</div>
          ) : (
            <>
              <div className="flex items-end gap-1 h-24 mb-2">
                {barData.map(({ revenue }, i) => {
                  const h = Math.max(4, Math.round((revenue / maxRevenue) * 88));
                  return (
                    <div key={i} className="flex-1 min-w-0 flex flex-col items-center">
                      <div className="w-full bg-[#4E7A5F] rounded-t-sm" style={{ height: `${h}px` }} />
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-1">
                {barData.map(({ label }, i) => (
                  <div key={i} className="flex-1 min-w-0 text-center">
                    <span className="text-[9px] text-[#9C9087] block truncate">{label}</span>
                  </div>
                ))}
              </div>
            </>
          )}
          {/* Breakdown row */}
          <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-[#F6F3EE]">
            {[
              { label: "Sessions", value: `£${(totalRevenue / 100).toFixed(0)}` },
              { label: "Packages", value: "£—" },
              { label: "Subscriptions", value: "£—" },
            ].map(({ label, value }) => (
              <div key={label} className="text-center">
                <p className="text-[10px] text-[#9C9087]">{label}</p>
                <p className="text-sm font-semibold text-[#1E1A16]">{value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Donut */}
        <div className="rounded-2xl bg-white border border-[#E6E0D8] p-5 flex flex-col">
          <h2 className="font-semibold text-sm text-[#1E1A16] mb-1">Sessions by Type</h2>
          <p className="text-xs text-[#9C9087] mb-4">All statuses</p>
          <div className="flex-1 flex items-center">
            <DonutChart segments={donutSegments} />
          </div>
        </div>
      </div>

      {/* ── Patient adherence ──────────────────────────────────────────────── */}
      <div className="rounded-2xl bg-white border border-[#E6E0D8] p-5">
        <h2 className="font-semibold text-sm text-[#1E1A16] mb-4">Patient Adherence</h2>

        {lowAdherence.length > 0 && (
          <div className="rounded-xl bg-[#F5EDE8] border border-[#B5704A]/20 px-4 py-3 flex items-start gap-3 mb-4">
            <AlertTriangle size={15} className="text-[#B5704A] shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-[#B5704A]">Attention needed</p>
              <p className="text-xs text-[#B5704A]/80 mt-0.5">
                {lowAdherence.map((r) => r.name).join(", ")}{" "}
                {lowAdherence.length === 1 ? "has" : "have"} a check-in rate below 50% — consider reaching out.
              </p>
            </div>
          </div>
        )}

        {adherenceRows.length === 0 ? (
          <p className="text-sm text-[#9C9087] text-center py-4">No patients yet</p>
        ) : (
          <div className="space-y-3">
            {adherenceRows.map((row) => {
              const color = row.pct >= 70 ? "bg-[#4E7A5F]" : row.pct >= 50 ? "bg-[#C27D30]" : "bg-[#B5704A]";
              return (
                <div key={row.id}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-[#1E1A16]">{row.name}</span>
                    <span className="text-xs font-semibold text-[#5C5248]">{row.pct}%</span>
                  </div>
                  <div className="h-1.5 bg-[#F6F3EE] rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${row.pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Outcomes + Symptoms ────────────────────────────────────────────── */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Outcomes */}
        <div className="rounded-2xl bg-white border border-[#E6E0D8] p-5">
          <h2 className="font-semibold text-sm text-[#1E1A16] mb-4">Patient-Reported Outcomes</h2>

          {outcomes.best && outcomes.best.delta > 0.2 && (
            <div className="rounded-xl bg-[#EBF2EE] px-4 py-3 mb-4 flex items-start gap-2">
              <TrendingUp size={14} className="text-[#4E7A5F] shrink-0 mt-0.5" />
              <p className="text-xs text-[#4E7A5F]">
                <strong>{outcomes.best.label}</strong> shows the strongest improvement this period — great progress!
              </p>
            </div>
          )}

          <div className="space-y-3">
            {outcomes.metrics.map(({ label, curr, prev, max }) => (
              <div key={label}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-[#5C5248]">{label}</span>
                  <div className="flex items-center gap-1">
                    {curr !== null && prev !== null && <TrendIcon curr={curr} prev={prev} />}
                    <span className="text-xs font-semibold text-[#1E1A16]">
                      {curr !== null ? curr.toFixed(1) : "—"}/{max}
                    </span>
                  </div>
                </div>
                <div className="h-1.5 bg-[#F6F3EE] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#4E7A5F] rounded-full transition-all"
                    style={{ width: `${curr !== null ? (curr / max) * 100 : 0}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          {periodCheckIns.length === 0 && (
            <p className="text-sm text-[#9C9087] text-center py-4">No check-ins in this period</p>
          )}
        </div>

        {/* Symptoms */}
        <div className="rounded-2xl bg-white border border-[#E6E0D8] p-5">
          <h2 className="font-semibold text-sm text-[#1E1A16] mb-4">Most Reported Symptoms</h2>
          {topSymptoms.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-sm text-[#9C9087]">
              No symptoms reported in this period
            </div>
          ) : (
            <div className="space-y-3">
              {topSymptoms.map(({ symptom, count, pct }, i) => (
                <div key={symptom} className="flex items-center gap-3">
                  <span className="text-xs font-medium text-[#9C9087] w-4 text-right">{i + 1}</span>
                  <div className="flex-1">
                    <div className="flex justify-between mb-1">
                      <span className="text-xs text-[#1E1A16] capitalize">{symptom}</span>
                      <span className="text-xs text-[#9C9087]">{count}× · {pct}%</span>
                    </div>
                    <div className="h-1.5 bg-[#F6F3EE] rounded-full overflow-hidden">
                      <div className="h-full bg-[#7B6FA8] rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Capacity ────────────────────────────────────────────────────────── */}
      <div className="rounded-2xl bg-white border border-[#E6E0D8] p-5">
        <h2 className="font-semibold text-sm text-[#1E1A16] mb-4">Capacity &amp; Operations</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Weekly slots available", value: String(capacity.weeklySlots) },
            { label: "Utilisation", value: `${capacity.utilPct}%` },
            { label: "Cancellation rate", value: `${capacity.cancelRate}%` },
            { label: "No-show rate", value: `${capacity.noShowRate}%` },
          ].map(({ label, value }) => (
            <div key={label} className="text-center p-4 bg-[#F6F3EE] rounded-xl">
              <p className="text-xl font-semibold text-[#1E1A16]">{value}</p>
              <p className="text-[10px] text-[#9C9087] mt-1">{label}</p>
            </div>
          ))}
        </div>
        {capacity.weeklySlots > 0 && (
          <div className="mt-4">
            <div className="flex justify-between text-[11px] text-[#9C9087] mb-1">
              <span>Slots used ({capacity.usedSlots} of {capacity.totalSlots})</span>
              <span>{capacity.utilPct}%</span>
            </div>
            <div className="h-2 bg-[#F6F3EE] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#4E7A5F] rounded-full transition-all"
                style={{ width: `${capacity.utilPct}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#2E2620] text-white text-xs px-5 py-3 rounded-full shadow-xl pointer-events-none">
          {toast}
        </div>
      )}
    </div>
  );
}
