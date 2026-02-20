import { NextResponse } from "next/server";
import { adminDb, requireAdmin, auditLog } from "@/lib/admin-api";

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

  const { error } = await supabase
    .from("appointments")
    .update({ status: "cancelled" })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await auditLog(supabase, {
    adminId,
    action: "cancel",
    targetType: "appointment",
    targetId: id,
  });

  return NextResponse.json({ ok: true });
}
