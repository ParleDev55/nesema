import { NextResponse } from "next/server";
import { adminDb, requireAdmin, auditLog } from "@/lib/admin-api";
import { sendPractitionerRejected } from "@/lib/resend";

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  let adminId: string;
  try {
    ({ adminId } = await requireAdmin());
  } catch (err) {
    return err as NextResponse;
  }

  const { reason } = (await req.json().catch(() => ({}))) as { reason?: string };
  if (!reason?.trim()) {
    return NextResponse.json({ error: "Reason is required" }, { status: 400 });
  }

  const supabase = adminDb();
  const { id } = params;

  const { data: prac, error: fetchErr } = await supabase
    .from("practitioners")
    .select("id, profile_id")
    .eq("id", id)
    .single();

  if (fetchErr || !prac) {
    return NextResponse.json({ error: "Practitioner not found" }, { status: 404 });
  }

  const { error } = await supabase
    .from("practitioners")
    .update({ verification_status: "rejected", is_live: false })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await auditLog(supabase, {
    adminId,
    action: "reject",
    targetType: "practitioner",
    targetId: id,
    metadata: { reason },
  });

  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, email")
    .eq("id", prac.profile_id)
    .single();

  if (profile?.email) {
    await sendPractitionerRejected({
      to: profile.email,
      firstName: profile.first_name ?? "there",
      reason,
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true });
}
