import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

function adminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export const dynamic = "force-dynamic";

interface AppointmentPayment {
  id: string;
  practitioner_id: string | null;
  amount_pence: number | null;
  status: string | null;
  created_at: string;
  practitioners: {
    id: string;
    practice_name: string | null;
    stripe_account_id: string | null;
    profiles: { first_name: string | null; last_name: string | null; email: string | null } | null;
  } | null;
}

export default async function AdminPaymentsPage() {
  const supabase = adminClient();

  const { data } = await supabase
    .from("appointments")
    .select(`
      id,
      practitioner_id,
      amount_pence,
      status,
      created_at,
      practitioners (
        id,
        practice_name,
        stripe_account_id,
        profiles!practitioners_profile_id_fkey (
          first_name,
          last_name,
          email
        )
      )
    `)
    .eq("status", "completed")
    .order("created_at", { ascending: false });

  const appointments = (data ?? []) as unknown as AppointmentPayment[];

  // Aggregate revenue by practitioner
  const byPrac: Record<
    string,
    { name: string; email: string | null; stripeId: string | null; total: number; count: number }
  > = {};

  for (const a of appointments) {
    const prac = Array.isArray(a.practitioners) ? a.practitioners[0] : a.practitioners;
    if (!prac) continue;
    const profile = Array.isArray(prac.profiles) ? prac.profiles[0] : prac.profiles;
    const id = a.practitioner_id ?? prac.id;
    if (!byPrac[id]) {
      byPrac[id] = {
        name:
          [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
          prac.practice_name ||
          "Unknown",
        email: profile?.email ?? null,
        stripeId: prac.stripe_account_id ?? null,
        total: 0,
        count: 0,
      };
    }
    byPrac[id].total += a.amount_pence ?? 0;
    byPrac[id].count += 1;
  }

  const rows = Object.entries(byPrac)
    .map(([id, v]) => ({ id, ...v }))
    .sort((a, b) => b.total - a.total);

  const grandTotal = rows.reduce((s, r) => s + r.total, 0);

  return (
    <div className="p-6 md:p-8">
      <h1 className="font-serif text-3xl text-nesema-t1 mb-2">Payments</h1>
      <p className="text-sm text-nesema-t3 mb-8">Revenue from completed sessions.</p>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-nesema-surf rounded-2xl border border-nesema-bdr p-5">
          <p className="text-xs text-nesema-t3 uppercase tracking-widest font-semibold mb-1">
            Total revenue
          </p>
          <p className="font-serif text-3xl text-nesema-t1">£{(grandTotal / 100).toFixed(0)}</p>
        </div>
        <div className="bg-nesema-surf rounded-2xl border border-nesema-bdr p-5">
          <p className="text-xs text-nesema-t3 uppercase tracking-widest font-semibold mb-1">
            Completed sessions
          </p>
          <p className="font-serif text-3xl text-nesema-t1">
            {(appointments ?? []).length}
          </p>
        </div>
        <div className="bg-nesema-surf rounded-2xl border border-nesema-bdr p-5">
          <p className="text-xs text-nesema-t3 uppercase tracking-widest font-semibold mb-1">
            Active practitioners
          </p>
          <p className="font-serif text-3xl text-nesema-t1">{rows.length}</p>
        </div>
      </div>

      {/* Revenue table by practitioner */}
      <div className="bg-nesema-surf rounded-2xl border border-nesema-bdr overflow-hidden">
        <div className="px-5 py-4 border-b border-nesema-bdr">
          <h2 className="text-sm font-semibold text-nesema-t1">Revenue by practitioner</h2>
        </div>
        {rows.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-nesema-t3 text-sm">No completed payments yet.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-nesema-bdr">
              <tr>
                {["Practitioner", "Email", "Stripe account", "Sessions", "Total revenue"].map(
                  (h) => (
                    <th
                      key={h}
                      className="text-left px-4 py-3 text-xs font-semibold text-nesema-t3 uppercase tracking-widest"
                    >
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-nesema-bdr">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-nesema-bg/60 transition-colors">
                  <td className="px-4 py-3 font-medium text-nesema-t1">{r.name}</td>
                  <td className="px-4 py-3 text-nesema-t3 text-xs">{r.email ?? "—"}</td>
                  <td className="px-4 py-3 text-xs">
                    {r.stripeId ? (
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                        Connected
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                        Not connected
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-nesema-t2 text-center">{r.count}</td>
                  <td className="px-4 py-3 font-semibold text-nesema-t1">
                    £{(r.total / 100).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
