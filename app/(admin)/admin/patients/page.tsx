import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { PatientsClient } from "@/components/admin/PatientsClient";

function adminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export const dynamic = "force-dynamic";

interface PatientRaw {
  id: string;
  profile_id: string;
  practitioner_id: string | null;
  current_health: string | null;
  goals: string[] | null;
  programme_weeks: number;
  created_at: string;
  profiles: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    suspended: boolean;
  } | null;
}

interface PractitionerRaw {
  id: string;
  profile_id: string;
  practice_name: string | null;
  profiles: { first_name: string | null; last_name: string | null } | null;
}

export default async function AdminPatientsPage() {
  const supabase = adminClient();

  const [{ data: patientsRaw }, { data: practitionersRaw }] = await Promise.all([
    supabase
      .from("patients")
      .select(`
        id,
        profile_id,
        practitioner_id,
        current_health,
        goals,
        programme_weeks,
        created_at,
        profiles!patients_profile_id_fkey (
          id,
          first_name,
          last_name,
          email,
          suspended
        )
      `)
      .order("created_at", { ascending: false }),

    supabase
      .from("practitioners")
      .select(`
        id,
        profile_id,
        practice_name,
        profiles!practitioners_profile_id_fkey (
          first_name,
          last_name
        )
      `)
      .eq("verification_status", "verified")
      .eq("is_live", true),
  ]);

  const patients = (patientsRaw ?? []) as unknown as PatientRaw[];
  const practitioners = (practitionersRaw ?? []) as unknown as PractitionerRaw[];

  // Get last check-in for each patient
  const patientIds = patients.map((p) => p.id);
  const { data: lastCheckins } = patientIds.length
    ? await supabase
        .from("check_ins")
        .select("patient_id, checked_in_at")
        .in("patient_id", patientIds)
        .order("checked_in_at", { ascending: false })
    : { data: [] };

  const lastCheckinMap: Record<string, string> = {};
  for (const ci of lastCheckins ?? []) {
    if (!lastCheckinMap[ci.patient_id]) {
      lastCheckinMap[ci.patient_id] = ci.checked_in_at;
    }
  }

  const enriched = patients.map((p) => ({
    ...p,
    last_checkin: lastCheckinMap[p.id] ?? null,
  }));

  const practitionerOptions = practitioners.map((pr) => {
    const profile = Array.isArray(pr.profiles) ? pr.profiles[0] : pr.profiles;
    const name =
      [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
      pr.practice_name ||
      "Unknown";
    return { id: pr.id, name };
  });

  const pracNameMap: Record<string, string> = {};
  for (const pr of practitioners) {
    const profile = Array.isArray(pr.profiles) ? pr.profiles[0] : pr.profiles;
    const name =
      [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
      pr.practice_name ||
      "Unknown";
    pracNameMap[pr.id] = name;
  }

  return (
    <PatientsClient
      patients={enriched}
      practitionerOptions={practitionerOptions}
      pracNameMap={pracNameMap}
    />
  );
}
