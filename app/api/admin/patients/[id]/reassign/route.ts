import { NextResponse } from "next/server";
import { adminDb, requireAdmin, auditLog } from "@/lib/admin-api";

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

  const { practitionerId } = (await req.json().catch(() => ({}))) as {
    practitionerId?: string;
  };
  if (!practitionerId) {
    return NextResponse.json({ error: "practitionerId is required" }, { status: 400 });
  }

  const supabase = adminDb();
  const { id } = params;

  const { error } = await supabase
    .from("patients")
    .update({ practitioner_id: practitionerId })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await auditLog(supabase, {
    adminId,
    action: "reassign",
    targetType: "patient",
    targetId: id,
    metadata: { new_practitioner_id: practitionerId },
  });

  return NextResponse.json({ ok: true });
}
