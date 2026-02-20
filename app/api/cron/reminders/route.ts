import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendAppointmentReminder } from "@/lib/resend";

// Vercel Cron: runs every hour
// vercel.json: { "crons": [{ "path": "/api/cron/reminders", "schedule": "0 * * * *" }] }

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  // Verify cron secret to prevent unauthorized calls
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const now = new Date();
  const windowStart = new Date(now.getTime() + 24 * 60 * 60 * 1000); // +24h
  const windowEnd = new Date(now.getTime() + 25 * 60 * 60 * 1000);   // +25h

  // Fetch appointments in the 24–25h window that haven't had a reminder sent
  const { data: appointments, error } = await supabase
    .from("appointments")
    .select(`
      id,
      scheduled_at,
      appointment_type,
      reminder_sent,
      practitioners (
        id,
        profiles ( first_name, last_name, email )
      ),
      patients (
        id,
        profiles ( first_name, last_name, email )
      )
    `)
    .eq("status", "scheduled")
    .eq("reminder_sent", false)
    .gte("scheduled_at", windowStart.toISOString())
    .lte("scheduled_at", windowEnd.toISOString());

  if (error) {
    console.error("Reminders cron error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let sent = 0;

  for (const appt of appointments ?? []) {
    const scheduledAt = new Date(appt.scheduled_at);
    const dateStr = scheduledAt.toLocaleDateString("en-GB", {
      weekday: "long", day: "numeric", month: "long", year: "numeric",
    });
    const timeStr = scheduledAt.toLocaleTimeString("en-GB", {
      hour: "2-digit", minute: "2-digit", hour12: false,
    });

    // Safely extract nested data
    const prac = Array.isArray(appt.practitioners) ? appt.practitioners[0] : appt.practitioners;
    const patient = Array.isArray(appt.patients) ? appt.patients[0] : appt.patients;
    const pracProfile = prac && (Array.isArray(prac.profiles) ? prac.profiles[0] : prac.profiles);
    const patProfile = patient && (Array.isArray(patient.profiles) ? patient.profiles[0] : patient.profiles);

    if (!pracProfile?.email || !patProfile?.email) continue;

    const pracName = `${pracProfile.first_name ?? ""} ${pracProfile.last_name ?? ""}`.trim();
    const patName = `${patProfile.first_name ?? ""} ${patProfile.last_name ?? ""}`.trim();

    try {
      await Promise.all([
        sendAppointmentReminder({
          to: patProfile.email,
          recipientName: patName,
          otherPartyName: pracName,
          appointmentDate: dateStr,
          appointmentTime: timeStr,
          appointmentId: appt.id,
          role: "patient",
        }),
        sendAppointmentReminder({
          to: pracProfile.email,
          recipientName: pracName,
          otherPartyName: patName,
          appointmentDate: dateStr,
          appointmentTime: timeStr,
          appointmentId: appt.id,
          role: "practitioner",
        }),
      ]);

      await supabase
        .from("appointments")
        .update({ reminder_sent: true })
        .eq("id", appt.id);

      sent++;
    } catch (emailErr) {
      console.error(`Failed to send reminder for appt ${appt.id}:`, emailErr);
    }
  }

  return NextResponse.json({ sent, total: appointments?.length ?? 0 });
}
