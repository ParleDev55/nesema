import { NextResponse } from "next/server";
import { adminDb, requireAdmin, auditLog } from "@/lib/admin-api";
import { syncPatientChurned } from "@/lib/ghl-sync";

export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  let adminId: string;
  try {
    ({ adminId } = await requireAdmin());
  } catch (err) {
    return err as NextResponse;
  }

  const supabase = adminDb();
  const { id } = params;

  // Get the auth user ID via profile_id
  const { data: patient, error: fetchErr } = await supabase
    .from("patients")
    .select("id, profile_id")
    .eq("id", id)
    .single();

  if (fetchErr || !patient) {
    return NextResponse.json({ error: "Patient not found" }, { status: 404 });
  }

  await auditLog(supabase, {
    adminId,
    action: "delete",
    targetType: "patient",
    targetId: id,
  });

  // GHL sync before deletion so the patient record still exists
  try { await syncPatientChurned(id); } catch {}

  // Delete the auth user — cascades to profile and patient rows via FK
  const { error: deleteErr } = await supabase.auth.admin.deleteUser(patient.profile_id);
  if (deleteErr) return NextResponse.json({ error: deleteErr.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
