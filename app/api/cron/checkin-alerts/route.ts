import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendCheckinStreakAlert } from "@/lib/resend";

// Vercel Cron: runs daily at 9am UTC
// vercel.json: { "crons": [{ "path": "/api/cron/checkin-alerts", "schedule": "0 9 * * *" }] }

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();

  // Fetch all active patients who have a practitioner assigned
  const { data: patients, error } = await supabase
    .from("patients")
    .select(`
      id,
      practitioner_id,
      profiles ( first_name, last_name, email ),
      practitioners (
        id,
        profiles ( first_name, last_name, email )
      )
    `)
    .not("practitioner_id", "is", null);

  if (error) {
    console.error("Check-in alerts cron error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let alerted = 0;

  for (const patient of patients ?? []) {
    // Check if patient has any check-in in the last 3 days
    const { data: recentCheckins } = await supabase
      .from("check_ins")
      .select("id")
      .eq("patient_id", patient.id)
      .gte("checked_in_at", threeDaysAgo)
      .limit(1);

    if (recentCheckins && recentCheckins.length > 0) continue; // Active, skip

    // Check if patient has ANY check-in at all (only alert for engaged patients)
    const { data: anyCheckin } = await supabase
      .from("check_ins")
      .select("checked_in_at")
      .eq("patient_id", patient.id)
      .order("checked_in_at", { ascending: false })
      .limit(1);

    if (!anyCheckin || anyCheckin.length === 0) continue; // Never checked in, skip

    const lastCheckinDate = new Date(anyCheckin[0].checked_in_at);
    const daysMissed = Math.floor((Date.now() - lastCheckinDate.getTime()) / (1000 * 60 * 60 * 24));

    // Safely extract nested data
    const patProfile = Array.isArray(patient.profiles) ? patient.profiles[0] : patient.profiles;
    const prac = Array.isArray(patient.practitioners) ? patient.practitioners[0] : patient.practitioners;
    const pracProfile = prac && (Array.isArray(prac.profiles) ? prac.profiles[0] : prac.profiles);

    if (!pracProfile?.email) continue;

    const patName = `${patProfile?.first_name ?? ""} ${patProfile?.last_name ?? ""}`.trim() || "Your patient";
    const pracName = `${pracProfile.first_name ?? ""} ${pracProfile.last_name ?? ""}`.trim();

    try {
      // Create in-app notification
      const pracRow = Array.isArray(patient.practitioners)
        ? patient.practitioners[0]
        : patient.practitioners;
      if (pracRow) {
        // Get practitioner profile_id for notification
        const { data: pracData } = await supabase
          .from("practitioners")
          .select("profile_id")
          .eq("id", pracRow.id)
          .single();

        if (pracData?.profile_id) {
          await supabase.from("notifications").insert({
            user_id: pracData.profile_id,
            type: "checkin_missed",
            title: `${patName} hasn't checked in`,
            body: `${patName} has missed ${daysMissed} consecutive days of check-ins.`,
            link: `/practitioner/patients/${patient.id}`,
          });
        }
      }

      // Send email
      await sendCheckinStreakAlert({
        to: pracProfile.email,
        practitionerName: pracName,
        patientName: patName,
        daysMissed,
        patientId: patient.id,
      });

      alerted++;
    } catch (err) {
      console.error(`Failed to send check-in alert for patient ${patient.id}:`, err);
    }
  }

  return NextResponse.json({ alerted });
}
