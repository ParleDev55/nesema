import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { CreditCard, PoundSterling } from "lucide-react";

type PracRow = {
  id: string;
  initial_fee: number | null;
  followup_fee: number | null;
  stripe_account_id: string | null;
};

type ApptRow = {
  id: string;
  scheduled_at: string;
  appointment_type: string;
  status: string;
  amount_pence: number | null;
};

function fmtGBP(pence: number | null) {
  if (pence === null) return "—";
  return `£${(pence / 100).toFixed(2)}`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default async function PaymentsPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: prac } = (await supabase
    .from("practitioners")
    .select("id, initial_fee, followup_fee, stripe_account_id")
    .eq("profile_id", user.id)
    .single()) as { data: PracRow | null; error: unknown };

  if (!prac) redirect("/onboarding/practitioner");

  const { data: appts } = (await supabase
    .from("appointments")
    .select("id, scheduled_at, appointment_type, status, amount_pence")
    .eq("practitioner_id", prac.id)
    .not("amount_pence", "is", null)
    .order("scheduled_at", { ascending: false })
    .limit(50)) as { data: ApptRow[] | null; error: unknown };

  const paidAppts = (appts ?? []).filter((a) => a.status === "completed");
  const totalRevenuePence = paidAppts.reduce(
    (s, a) => s + (a.amount_pence ?? 0),
    0
  );

  const thisMonthStart = new Date();
  thisMonthStart.setDate(1);
  thisMonthStart.setHours(0, 0, 0, 0);
  const thisMonthRevenue = paidAppts
    .filter((a) => new Date(a.scheduled_at) >= thisMonthStart)
    .reduce((s, a) => s + (a.amount_pence ?? 0), 0);

  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto">
      <h1 className="font-serif text-3xl text-nesema-t1 mb-8">Payments</h1>

      {/* Fees */}
      <section className="mb-8">
        <h2 className="text-xs font-semibold tracking-widest text-nesema-t3 uppercase mb-4">
          Your Fees
        </h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-2xl bg-white border border-nesema-sage/20 p-5">
            <p className="text-xs text-nesema-t3 mb-1">Initial consultation</p>
            <p className="text-2xl font-semibold text-nesema-t1">
              {fmtGBP(prac.initial_fee !== null ? prac.initial_fee * 100 : null)}
            </p>
          </div>
          <div className="rounded-2xl bg-white border border-nesema-sage/20 p-5">
            <p className="text-xs text-nesema-t3 mb-1">Follow-up</p>
            <p className="text-2xl font-semibold text-nesema-t1">
              {fmtGBP(prac.followup_fee !== null ? prac.followup_fee * 100 : null)}
            </p>
          </div>
        </div>
      </section>

      {/* Revenue summary */}
      <section className="mb-8">
        <h2 className="text-xs font-semibold tracking-widest text-nesema-t3 uppercase mb-4">
          Revenue
        </h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-2xl bg-nesema-sage/5 p-5">
            <div className="flex items-center gap-1.5 mb-1">
              <PoundSterling className="text-nesema-sage" size={16} />
              <p className="text-xs text-nesema-t3">This month</p>
            </div>
            <p className="text-2xl font-semibold text-nesema-t1">
              {fmtGBP(thisMonthRevenue)}
            </p>
          </div>
          <div className="rounded-2xl bg-nesema-sage/5 p-5">
            <div className="flex items-center gap-1.5 mb-1">
              <CreditCard className="text-nesema-sage" size={16} />
              <p className="text-xs text-nesema-t3">All time</p>
            </div>
            <p className="text-2xl font-semibold text-nesema-t1">
              {fmtGBP(totalRevenuePence)}
            </p>
          </div>
        </div>
      </section>

      {/* Stripe connection status */}
      <section className="mb-8">
        <h2 className="text-xs font-semibold tracking-widest text-nesema-t3 uppercase mb-4">
          Payment Processing
        </h2>
        <div className="rounded-2xl bg-white border border-nesema-sage/20 p-5 flex items-center gap-3">
          <div
            className={`w-2.5 h-2.5 rounded-full shrink-0 ${prac.stripe_account_id ? "bg-green-400" : "bg-amber-400"}`}
          />
          <div>
            <p className="text-sm font-medium text-nesema-t1">
              {prac.stripe_account_id ? "Stripe connected" : "Stripe not connected"}
            </p>
            <p className="text-xs text-nesema-t3 mt-0.5">
              {prac.stripe_account_id
                ? "Online payments are enabled for your practice."
                : "Connect Stripe to accept online payments from patients."}
            </p>
          </div>
        </div>
      </section>

      {/* Recent transactions */}
      {paidAppts.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold tracking-widest text-nesema-t3 uppercase mb-4">
            Recent Transactions
          </h2>
          <div className="rounded-2xl bg-white border border-nesema-sage/20 overflow-hidden">
            {paidAppts.slice(0, 10).map((a, i) => (
              <div
                key={a.id}
                className={`flex items-center gap-4 px-5 py-3.5 ${i > 0 ? "border-t border-gray-50" : ""}`}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-nesema-t1 capitalize">
                    {a.appointment_type.replace("_", " ")}
                  </p>
                  <p className="text-xs text-nesema-t3">
                    {fmtDate(a.scheduled_at)}
                  </p>
                </div>
                <p className="text-sm font-medium text-nesema-t1 shrink-0">
                  {fmtGBP(a.amount_pence)}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
