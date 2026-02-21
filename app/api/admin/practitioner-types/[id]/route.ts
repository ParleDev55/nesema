import { NextRequest, NextResponse } from "next/server";
import { adminDb, requireAdmin, auditLog } from "@/lib/admin-api";

export const runtime = "nodejs";

// PATCH — toggle is_active
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  let adminId: string;
  try {
    ({ adminId } = await requireAdmin());
  } catch (err) {
    return err as NextResponse;
  }

  const body = await request.json().catch(() => ({})) as { is_active?: boolean };
  const supabase = adminDb();

  const { data, error } = await supabase
    .from("practitioner_types")
    .update({ is_active: body.is_active ?? false })
    .eq("id", params.id)
    .select("id, name, is_active")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await auditLog(supabase, {
    adminId,
    action: data.is_active ? "practitioner_type_enabled" : "practitioner_type_disabled",
    targetType: "practitioner_types",
    targetId: params.id,
    metadata: { name: data.name, is_active: data.is_active },
  });

  return NextResponse.json({ type: data });
}

// DELETE — hard delete (only safe if no practitioner uses this discipline)
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  let adminId: string;
  try {
    ({ adminId } = await requireAdmin());
  } catch (err) {
    return err as NextResponse;
  }

  const supabase = adminDb();

  // Fetch the type first for the audit log name
  const { data: existing } = await supabase
    .from("practitioner_types")
    .select("id, name")
    .eq("id", params.id)
    .single() as { data: { id: string; name: string } | null };

  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Check whether any practitioner currently uses this discipline
  const { count } = await (supabase as ReturnType<typeof adminDb>)
    .from("practitioners")
    .select("id", { count: "exact", head: true })
    .eq("discipline", existing.name) as { count: number | null };

  if ((count ?? 0) > 0) {
    // Deactivate instead of deleting to preserve referential integrity
    await supabase
      .from("practitioner_types")
      .update({ is_active: false })
      .eq("id", params.id);

    await auditLog(supabase, {
      adminId,
      action: "practitioner_type_disabled",
      targetType: "practitioner_types",
      targetId: params.id,
      metadata: { name: existing.name, reason: "in_use_by_practitioners" },
    });

    return NextResponse.json({
      ok: true,
      deactivated: true,
      message: `${existing.name} is used by ${count} practitioner(s). It has been hidden from the sign-up form rather than deleted.`,
    });
  }

  const { error } = await supabase
    .from("practitioner_types")
    .delete()
    .eq("id", params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await auditLog(supabase, {
    adminId,
    action: "practitioner_type_deleted",
    targetType: "practitioner_types",
    targetId: params.id,
    metadata: { name: existing.name },
  });

  return NextResponse.json({ ok: true, deleted: true });
}
