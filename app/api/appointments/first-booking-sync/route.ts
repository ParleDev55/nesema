import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { syncPatientFirstBooking } from "@/lib/ghl-sync";

export const runtime = "nodejs";

// Called from the public booking page — no user auth required.
// Gracefully no-ops if the appointment or patient can't be found.
export async function POST(req: Request) {
  const { appointmentId } = (await req.json().catch(() => ({}))) as {
    appointmentId?: string;
  };
  if (!appointmentId) return NextResponse.json({ ok: true });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data: appt } = await supabase
    .from("appointments")
    .select("id, patient_id, appointment_type")
    .eq("id", appointmentId)
    .single();

  if (!appt || appt.appointment_type !== "initial") return NextResponse.json({ ok: true });

  // Check if this is truly their first appointment
  const { count } = await supabase
    .from("appointments")
    .select("id", { count: "exact", head: true })
    .eq("patient_id", appt.patient_id)
    .in("status", ["scheduled", "completed"]);

  if ((count ?? 0) <= 1) {
    void syncPatientFirstBooking(appt.patient_id).catch(() => {});
  }

  return NextResponse.json({ ok: true });
}
