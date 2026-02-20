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

  const { data: prac, error: fetchErr } = await supabase
    .from("practitioners")
    .select("id, profile_id")
    .eq("id", id)
    .single();

  if (fetchErr || !prac) {
    return NextResponse.json({ error: "Practitioner not found" }, { status: 404 });
  }

  // Update is_live on practitioner and suspended on profile
  const [{ error: pracErr }, { error: profileErr }] = await Promise.all([
    supabase.from("practitioners").update({ is_live: false }).eq("id", id),
    supabase.from("profiles").update({ suspended: true }).eq("id", prac.profile_id),
  ]);

  if (pracErr || profileErr) {
    return NextResponse.json({ error: pracErr?.message ?? profileErr?.message }, { status: 500 });
  }

  await auditLog(supabase, {
    adminId,
    action: "suspend",
    targetType: "practitioner",
    targetId: id,
  });

  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, email")
    .eq("id", prac.profile_id)
    .single();

  if (profile?.email) {
    await sendAccountSuspended({
      to: profile.email,
      firstName: profile.first_name ?? "there",
      role: "practitioner",
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true });
}
