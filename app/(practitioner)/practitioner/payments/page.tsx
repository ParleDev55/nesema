"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { CreditCard, TrendingUp, Calendar, PoundSterling, ExternalLink, Package, ArrowDownToLine } from "lucide-react";

type Tab = "invoices" | "packages" | "payouts";

type Appt = {
  id: string;
  scheduled_at: string;
  appointment_type: string;
  status: string;
  amount_pence: number | null;
  patient_id: string;
};

type PracData = {
  id: string;
  initial_fee: number | null;
  followup_fee: number | null;
  stripe_account_id: string | null;
};

type Patient = { id: string; name: string };

const PACKAGES = [
  { name: "Starter Programme", sessions: 3, price: 25000, description: "Initial consultation + 2 follow-ups" },
  { name: "Core Programme", sessions: 6, price: 45000, description: "Comprehensive 3-month support" },
  { name: "Intensive Programme", sessions: 12, price: 80000, description: "Full programme with weekly sessions" },
];

function fmtGBP(pence: number | null) {
  if (pence === null || pence === undefined) return "—";
  return `£${(pence / 100).toFixed(2)}`;
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  completed: { label: "Paid", className: "bg-[#EBF2EE] text-[#4E7A5F]" },
  scheduled: { label: "Upcoming", className: "bg-[#F9F1E6] text-[#C27D30]" },
  cancelled: { label: "Cancelled", className: "bg-[#F6F3EE] text-[#9C9087]" },
  no_show: { label: "No-show", className: "bg-[#FEF2F2] text-red-500" },
};

export default function PaymentsPage() {
  const supabase = createClient();
  const [tab, setTab] = useState<Tab>("invoices");
  const [prac, setPrac] = useState<PracData | null>(null);
  const [appts, setAppts] = useState<Appt[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: pracData } = (await supabase
        .from("practitioners")
        .select("id, initial_fee, followup_fee, stripe_account_id")
        .eq("profile_id", user.id)
        .single()) as { data: PracData | null; error: unknown };

      if (!pracData) { setLoading(false); return; }
      setPrac(pracData);

      const { data: apptData } = (await supabase
        .from("appointments")
        .select("id, scheduled_at, appointment_type, status, amount_pence, patient_id")
        .eq("practitioner_id", pracData.id)
        .order("scheduled_at", { ascending: false })
        .limit(100)) as { data: Appt[] | null; error: unknown };

      const allAppts = apptData ?? [];
      setAppts(allAppts);

      // Fetch patient names
      const patientIds = Array.from(new Set(allAppts.map((a) => a.patient_id)));
      if (patientIds.length > 0) {
        const { data: pts } = (await supabase
          .from("patients")
          .select("id, profile_id")
          .in("id", patientIds)) as { data: { id: string; profile_id: string }[] | null; error: unknown };

        const profileIds = (pts ?? []).map((p) => p.profile_id);
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
          setPatients((pts ?? []).map((p) => ({ id: p.id, name: pMap[p.profile_id] ?? "Patient" })));
        }
      }

      setLoading(false);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  const patientMap = Object.fromEntries(patients.map((p) => [p.id, p.name]));

  // Stats
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const paidAppts = appts.filter((a) => a.status === "completed" && a.amount_pence);
  const thisMonthPaid = paidAppts.filter((a) => new Date(a.scheduled_at) >= monthStart);
  const thisMonthRevenue = thisMonthPaid.reduce((s, a) => s + (a.amount_pence ?? 0), 0);
  const sessionsThisMonth = appts.filter(
    (a) => new Date(a.scheduled_at) >= monthStart && a.status !== "cancelled"
  ).length;
  const avgSessionValue = paidAppts.length > 0
    ? Math.round(paidAppts.reduce((s, a) => s + (a.amount_pence ?? 0), 0) / paidAppts.length)
    : 0;
  const outstanding = appts.filter((a) => a.status === "scheduled" && a.amount_pence).reduce(
    (s, a) => s + (a.amount_pence ?? 0), 0
  );

  const STAT_CARDS = [
    { label: "Revenue this month", value: fmtGBP(thisMonthRevenue), icon: PoundSterling, color: "bg-[#EBF2EE]", iconColor: "text-[#4E7A5F]" },
    { label: "Outstanding invoices", value: fmtGBP(outstanding), icon: TrendingUp, color: "bg-[#F9F1E6]", iconColor: "text-[#C27D30]" },
    { label: "Sessions this month", value: String(sessionsThisMonth), icon: Calendar, color: "bg-[#E8F2F8]", iconColor: "text-[#4A7FA0]" },
    { label: "Avg session value", value: fmtGBP(avgSessionValue), icon: CreditCard, color: "bg-[#EEECf6]", iconColor: "text-[#7B6FA8]" },
  ];

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-[#4E7A5F] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto">
      <h1 className="font-serif text-3xl text-[#1E1A16] mb-8">Payments</h1>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {STAT_CARDS.map(({ label, value, icon: Icon, color, iconColor }) => (
          <div key={label} className="rounded-2xl bg-white border border-[#E6E0D8] p-4">
            <div className={`w-8 h-8 rounded-xl ${color} flex items-center justify-center mb-3`}>
              <Icon size={15} className={iconColor} />
            </div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#9C9087] mb-1">{label}</p>
            <p className="text-xl font-semibold text-[#1E1A16]">{value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-[#F6F3EE] rounded-xl p-1 w-fit">
        {(["invoices", "packages", "payouts"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
              tab === t ? "bg-white text-[#1E1A16] shadow-sm" : "text-[#9C9087] hover:text-[#5C5248]"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* ── Invoices tab ── */}
      {tab === "invoices" && (
        <div>
          {appts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#4E7A5F]/30 p-10 text-center">
              <CreditCard className="mx-auto mb-3 text-[#4E7A5F]/40" size={36} />
              <p className="text-[#1E1A16] font-medium mb-1">No appointments yet</p>
              <p className="text-[#9C9087] text-sm">Invoices will appear here once you have sessions.</p>
            </div>
          ) : (
            <div className="rounded-2xl border border-[#E6E0D8] bg-white overflow-hidden">
              <div className="hidden md:grid grid-cols-[1fr_160px_100px_120px_80px] px-5 py-3 border-b border-[#F6F3EE] text-[10px] font-semibold uppercase tracking-widest text-[#9C9087]">
                <span>Patient</span>
                <span>Date</span>
                <span>Type</span>
                <span>Amount</span>
                <span>Status</span>
              </div>
              {appts.slice(0, 20).map((a, i) => {
                const status = STATUS_CONFIG[a.status] ?? { label: a.status, className: "bg-[#F6F3EE] text-[#9C9087]" };
                return (
                  <div
                    key={a.id}
                    className={`flex flex-col md:grid md:grid-cols-[1fr_160px_100px_120px_80px] items-start md:items-center gap-1 md:gap-0 px-5 py-3.5 ${
                      i > 0 ? "border-t border-[#F6F3EE]" : ""
                    }`}
                  >
                    <p className="text-sm font-medium text-[#1E1A16]">{patientMap[a.patient_id] ?? "Patient"}</p>
                    <p className="text-xs text-[#9C9087]">{fmtDate(a.scheduled_at)}</p>
                    <p className="text-xs text-[#5C5248] capitalize">{a.appointment_type.replace("_", " ")}</p>
                    <p className="text-sm font-medium text-[#1E1A16]">{fmtGBP(a.amount_pence)}</p>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${status.className}`}>
                        {status.label}
                      </span>
                      {a.status === "completed" && (
                        <button
                          onClick={() => showToast("Invoice sent")}
                          className="text-[10px] text-[#4E7A5F] hover:underline"
                        >
                          Send
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Packages tab ── */}
      {tab === "packages" && (
        <div className="space-y-4">
          <div className="grid md:grid-cols-3 gap-4">
            {PACKAGES.map((pkg) => (
              <div key={pkg.name} className="rounded-2xl border border-[#E6E0D8] bg-white p-5">
                <div className="w-9 h-9 rounded-xl bg-[#EBF2EE] flex items-center justify-center mb-4">
                  <Package size={16} className="text-[#4E7A5F]" />
                </div>
                <h3 className="font-semibold text-[#1E1A16] mb-1">{pkg.name}</h3>
                <p className="text-xs text-[#9C9087] mb-3">{pkg.description}</p>
                <p className="text-2xl font-serif font-semibold text-[#1E1A16] mb-1">{fmtGBP(pkg.price)}</p>
                <p className="text-xs text-[#9C9087] mb-4">{pkg.sessions} sessions</p>
                <button
                  onClick={() => showToast("Package links coming soon")}
                  className="w-full py-2 rounded-full border border-[#E6E0D8] text-xs text-[#5C5248] hover:bg-[#F6F3EE] transition-colors flex items-center justify-center gap-1.5"
                >
                  <ExternalLink size={12} />
                  Share link
                </button>
              </div>
            ))}
          </div>
          <button
            onClick={() => showToast("Package builder coming soon")}
            className="w-full py-3 rounded-full border border-dashed border-[#4E7A5F]/40 text-sm text-[#4E7A5F] hover:bg-[#EBF2EE] transition-colors"
          >
            + Create custom package
          </button>
        </div>
      )}

      {/* ── Payouts tab ── */}
      {tab === "payouts" && (
        <div>
          {!prac?.stripe_account_id ? (
            <div className="rounded-2xl border border-[#E6E0D8] bg-white p-8 text-center">
              <div className="w-14 h-14 rounded-2xl bg-[#F9F1E6] flex items-center justify-center mx-auto mb-4">
                <ArrowDownToLine size={24} className="text-[#C27D30]" />
              </div>
              <h3 className="font-semibold text-[#1E1A16] mb-2">Connect Stripe to receive payouts</h3>
              <p className="text-sm text-[#9C9087] mb-6 max-w-sm mx-auto">
                Set up Stripe Connect to receive patient payments directly to your bank account. Takes 5 minutes.
              </p>
              <button
                onClick={() => showToast("Stripe Connect onboarding coming soon")}
                className="px-6 py-2.5 bg-[#4E7A5F] text-white rounded-full text-sm font-medium hover:bg-[#6B9E7A] transition-colors"
              >
                Connect Stripe →
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-2xl border border-[#E6E0D8] bg-white p-5 flex items-center gap-3">
                <div className="w-2.5 h-2.5 rounded-full bg-green-400 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-[#1E1A16]">Stripe connected</p>
                  <p className="text-xs text-[#9C9087]">Payouts are enabled. Funds arrive within 2–5 business days.</p>
                </div>
                <button
                  onClick={() => showToast("Stripe dashboard opening soon")}
                  className="ml-auto text-xs text-[#4E7A5F] flex items-center gap-1 hover:underline shrink-0"
                >
                  Open dashboard <ExternalLink size={11} />
                </button>
              </div>
              <div className="rounded-2xl border border-[#E6E0D8] bg-white overflow-hidden">
                <div className="px-5 py-4 border-b border-[#F6F3EE]">
                  <p className="text-xs font-semibold uppercase tracking-widest text-[#9C9087]">Payout history</p>
                </div>
                <div className="px-5 py-8 text-center text-sm text-[#9C9087]">
                  Payout history will appear here once you&apos;ve received your first payout.
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#2E2620] text-white text-xs px-5 py-3 rounded-full shadow-xl pointer-events-none">
          {toast}
        </div>
      )}
    </div>
  );
}
