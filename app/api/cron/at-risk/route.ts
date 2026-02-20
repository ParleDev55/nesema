import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { syncPatientAtRisk, sendLowCheckinSMS } from "@/lib/ghl-sync";

// Vercel Cron: runs daily at 10am UTC
// vercel.json: { "path": "/api/cron/at-risk", "schedule": "0 10 * * *" }

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

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // All patients who have a practitioner assigned (active patients)
  const { data: activePatients, error } = await supabase
    .from("patients")
    .select("id, profile_id, practitioner_id")
    .not("practitioner_id", "is", null);

  if (error) {
    console.error("at-risk cron error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Patients who HAVE checked in within the last 7 days (exclude these)
  const allPatientIds = (activePatients ?? []).map((p) => p.id);
  if (allPatientIds.length === 0) {
    return NextResponse.json({ processed: 0 });
  }

  const { data: recentCheckIns } = await supabase
    .from("check_ins")
    .select("patient_id")
    .in("patient_id", allPatientIds)
    .gte("checked_in_at", sevenDaysAgo);

  const recentPatientIds = new Set((recentCheckIns ?? []).map((c) => c.patient_id));

  // At-risk: active patients with no check-in in last 7 days
  const atRiskPatients = (activePatients ?? []).filter(
    (p) => !recentPatientIds.has(p.id)
  );

  if (atRiskPatients.length === 0) {
    return NextResponse.json({ processed: 0 });
  }

  // Skip patients already tagged at-risk in the last 7 days (check ghl_sync_log)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: recentAtRiskLogs } = await (supabase as any)
    .from("ghl_sync_log")
    .select("user_id")
    .eq("event_type", "at_risk_flagged")
    .gte("created_at", sevenDaysAgo);

  const alreadyFlaggedProfileIds = new Set(
    (recentAtRiskLogs ?? []).map((l: { user_id: string }) => l.user_id)
  );

  const toProcess = atRiskPatients.filter(
    (p) => !alreadyFlaggedProfileIds.has(p.profile_id)
  );

  let processed = 0;

  for (const patient of toProcess) {
    try {
      // Log the at-risk event before sync so we don't double-process on retry
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from("ghl_sync_log").insert({
        user_id: patient.profile_id,
        event_type: "at_risk_flagged",
        success: true,
      });

      await Promise.all([
        syncPatientAtRisk(patient.id),
        sendLowCheckinSMS(patient.id),
      ]);

      // Create notification for practitioner
      const { data: pracData } = await supabase
        .from("practitioners")
        .select("profile_id")
        .eq("id", patient.practitioner_id!)
        .single();

      if (pracData) {
        const { data: patProfile } = await supabase
          .from("profiles")
          .select("first_name, last_name")
          .eq("id", patient.profile_id)
          .single();

        const patName = [patProfile?.first_name, patProfile?.last_name]
          .filter(Boolean)
          .join(" ") || "A patient";

        await supabase.from("notifications").insert({
          user_id: pracData.profile_id,
          type: "at_risk",
          title: "Patient needs attention",
          body: `⚠ ${patName} hasn't checked in for 7 days`,
          link: "/practitioner/patients",
        });
      }

      processed++;
    } catch (err) {
      console.error(`Failed to process at-risk patient ${patient.id}:`, err);
    }
  }

  return NextResponse.json({ processed, total: toProcess.length });
}
