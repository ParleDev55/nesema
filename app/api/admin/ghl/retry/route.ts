import { NextResponse } from "next/server";
import { requireAdmin, adminDb } from "@/lib/admin-api";
import {
  syncPractitionerSignup,
  syncPractitionerVerified,
  syncPractitionerRejected,
  syncPatientSignup,
  syncPatientMatched,
  syncPatientFirstBooking,
  syncAppointmentCompleted,
  syncPatientAtRisk,
  syncPatientChurned,
} from "@/lib/ghl-sync";

export async function POST(req: Request) {
  try {
    await requireAdmin();
  } catch (err) {
    return err as NextResponse;
  }

  const { logId } = (await req.json().catch(() => ({}))) as { logId?: string };
  if (!logId) return NextResponse.json({ error: "logId required" }, { status: 400 });

  const supabase = adminDb();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: log } = await (supabase as any)
    .from("ghl_sync_log")
    .select("id, event_type, user_id, payload")
    .eq("id", logId)
    .single();

  if (!log) return NextResponse.json({ error: "Log entry not found" }, { status: 404 });

  const eventType: string = log.event_type ?? "";
  const payload = log.payload as Record<string, string> | null;

  try {
    // Dispatch based on event_type
    if (eventType === "practitioner_signup" || eventType === "create_contact") {
      const { data: prac } = await supabase
        .from("practitioners")
        .select("id")
        .eq("profile_id", log.user_id)
        .single();
      if (prac) await syncPractitionerSignup(prac.id);
    } else if (eventType === "practitioner_verified") {
      const { data: prac } = await supabase
        .from("practitioners")
        .select("id")
        .eq("profile_id", log.user_id)
        .single();
      if (prac) await syncPractitionerVerified(prac.id);
    } else if (eventType === "practitioner_rejected") {
      const { data: prac } = await supabase
        .from("practitioners")
        .select("id")
        .eq("profile_id", log.user_id)
        .single();
      if (prac) await syncPractitionerRejected(prac.id, payload?.reason ?? "");
    } else if (eventType === "patient_signup") {
      const { data: patient } = await supabase
        .from("patients")
        .select("id")
        .eq("profile_id", log.user_id)
        .single();
      if (patient) await syncPatientSignup(patient.id);
    } else if (eventType === "patient_matched") {
      const { data: patient } = await supabase
        .from("patients")
        .select("id, practitioner_id")
        .eq("profile_id", log.user_id)
        .single();
      if (patient?.practitioner_id)
        await syncPatientMatched(patient.id, patient.practitioner_id);
    } else if (eventType === "first_booking") {
      const { data: patient } = await supabase
        .from("patients")
        .select("id")
        .eq("profile_id", log.user_id)
        .single();
      if (patient) await syncPatientFirstBooking(patient.id);
    } else if (eventType === "appointment_completed") {
      const appointmentId = payload?.appointmentId;
      if (appointmentId) await syncAppointmentCompleted(appointmentId);
    } else if (eventType === "at_risk_flagged") {
      const { data: patient } = await supabase
        .from("patients")
        .select("id")
        .eq("profile_id", log.user_id)
        .single();
      if (patient) await syncPatientAtRisk(patient.id);
    } else if (eventType === "patient_churned") {
      const { data: patient } = await supabase
        .from("patients")
        .select("id")
        .eq("profile_id", log.user_id)
        .single();
      if (patient) await syncPatientChurned(patient.id);
    } else {
      return NextResponse.json({ error: `Unknown event type: ${eventType}` }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Retry failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
