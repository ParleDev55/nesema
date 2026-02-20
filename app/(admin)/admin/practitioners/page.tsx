import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { PractitionersClient } from "@/components/admin/PractitionersClient";

function adminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export const dynamic = "force-dynamic";

export default async function AdminPractitionersPage() {
  const supabase = adminClient();

  const { data: rawData } = await supabase
    .from("practitioners")
    .select(`
      id,
      profile_id,
      practice_name,
      discipline,
      registration_body,
      registration_number,
      bio,
      verification_status,
      booking_slug,
      session_length_mins,
      initial_fee,
      followup_fee,
      is_live,
      stripe_account_id,
      created_at,
      profiles (
        id,
        first_name,
        last_name,
        email,
        avatar_url,
        suspended
      )
    `)
    .order("created_at", { ascending: false });

  // Get patient counts per practitioner
  const { data: patientCounts } = await supabase
    .from("patients")
    .select("practitioner_id");

  const countMap: Record<string, number> = {};
  (patientCounts ?? []).forEach((p) => {
    if (p.practitioner_id) {
      countMap[p.practitioner_id] = (countMap[p.practitioner_id] ?? 0) + 1;
    }
  });

  // Cast to bypass FK join type inference limitations
  type PracRow = Parameters<typeof PractitionersClient>[0]["practitioners"][number];
  const practitioners = (rawData ?? []) as unknown as Omit<PracRow, "patientCount">[];

  const enriched = practitioners.map((p) => ({
    ...p,
    patientCount: countMap[p.id] ?? 0,
  }));

  return <PractitionersClient practitioners={enriched} />;
}
