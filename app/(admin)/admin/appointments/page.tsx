import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { AppointmentsClient } from "@/components/admin/AppointmentsClient";

function adminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export const dynamic = "force-dynamic";

interface AppointmentRaw {
  id: string;
  practitioner_id: string | null;
  patient_id: string | null;
  status: string | null;
  appointment_type: string | null;
  scheduled_at: string;
  amount_pence: number | null;
  created_at: string;
  practitioners: {
    id: string;
    practice_name: string | null;
    profiles: { first_name: string | null; last_name: string | null } | null;
  } | null;
  patients: {
    id: string;
    profiles: { first_name: string | null; last_name: string | null; email: string | null } | null;
  } | null;
}

export default async function AdminAppointmentsPage() {
  const supabase = adminClient();

  const { data } = await supabase
    .from("appointments")
    .select(`
      id,
      practitioner_id,
      patient_id,
      status,
      appointment_type,
      scheduled_at,
      amount_pence,
      created_at,
      practitioners (
        id,
        practice_name,
        profiles!practitioners_profile_id_fkey (
          first_name,
          last_name
        )
      ),
      patients (
        id,
        profiles!patients_profile_id_fkey (
          first_name,
          last_name,
          email
        )
      )
    `)
    .order("scheduled_at", { ascending: false })
    .limit(500);

  const appointments = (data ?? []) as unknown as AppointmentRaw[];

  return <AppointmentsClient appointments={appointments} />;
}
