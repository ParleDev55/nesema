import { NextResponse } from "next/server";
import { adminDb, requireAdmin, auditLog } from "@/lib/admin-api";
import { sendPractitionerVerified } from "@/lib/resend";
import { syncPractitionerVerified } from "@/lib/ghl-sync";

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

  const { error } = await supabase
    .from("practitioners")
    .update({ verification_status: "verified", is_live: true })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await auditLog(supabase, {
    adminId,
    action: "verify",
    targetType: "practitioner",
    targetId: id,
  });

  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, email")
    .eq("id", prac.profile_id)
    .single();

  if (profile?.email) {
    await sendPractitionerVerified({
      to: profile.email,
      firstName: profile.first_name ?? "there",
    }).catch(() => {});
  }

  // GHL sync — never block the response
  try { await syncPractitionerVerified(id); } catch {}

  return NextResponse.json({ ok: true });
}
