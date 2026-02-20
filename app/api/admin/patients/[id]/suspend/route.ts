import { NextResponse } from "next/server";
import { adminDb, requireAdmin, auditLog } from "@/lib/admin-api";
import { sendAccountSuspended } from "@/lib/resend";

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

  const { data: patient, error: fetchErr } = await supabase
    .from("patients")
    .select("id, profile_id")
    .eq("id", id)
    .single();

  if (fetchErr || !patient) {
    return NextResponse.json({ error: "Patient not found" }, { status: 404 });
  }

  const { error } = await supabase
    .from("profiles")
    .update({ suspended: true })
    .eq("id", patient.profile_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await auditLog(supabase, {
    adminId,
    action: "suspend",
    targetType: "patient",
    targetId: id,
  });

  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, email")
    .eq("id", patient.profile_id)
    .single();

  if (profile?.email) {
    await sendAccountSuspended({
      to: profile.email,
      firstName: profile.first_name ?? "there",
      role: "patient",
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true });
}
