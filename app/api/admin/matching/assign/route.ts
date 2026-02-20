import { NextResponse } from "next/server";
import { adminDb, requireAdmin, auditLog } from "@/lib/admin-api";
import { syncPatientMatched, sendMatchedSMS } from "@/lib/ghl-sync";

export async function POST(req: Request) {
  let adminId: string;
  try {
    ({ adminId } = await requireAdmin());
  } catch (err) {
    return err as NextResponse;
  }

  const { patientId, practitionerId } = (await req.json().catch(() => ({}))) as {
    patientId?: string;
    practitionerId?: string;
  };

  if (!patientId || !practitionerId) {
    return NextResponse.json(
      { error: "patientId and practitionerId are required" },
      { status: 400 }
    );
  }

  const supabase = adminDb();

  const { data: patient, error: fetchErr } = await supabase
    .from("patients")
    .select("id")
    .eq("id", patientId)
    .single();

  if (fetchErr || !patient) {
    return NextResponse.json({ error: "Patient not found" }, { status: 404 });
  }

  const { error } = await supabase
    .from("patients")
    .update({ practitioner_id: practitionerId })
    .eq("id", patientId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await auditLog(supabase, {
    adminId,
    action: "assign",
    targetType: "patient",
    targetId: patientId,
    metadata: { practitionerId },
  });

  // GHL sync — never block
  try {
    await Promise.all([
      syncPatientMatched(patientId, practitionerId),
      sendMatchedSMS(patientId),
    ]);
  } catch {}

  return NextResponse.json({ ok: true });
}
