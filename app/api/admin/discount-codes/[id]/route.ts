import { NextRequest, NextResponse } from "next/server";
import { adminDb, requireAdmin, auditLog } from "@/lib/admin-api";

export const runtime = "nodejs";

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
    .from("discount_codes")
    .update({ is_active: body.is_active ?? false })
    .eq("id", params.id)
    .select("id, code, is_active")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await auditLog(supabase, {
    adminId,
    action: data.is_active ? "discount_code_enabled" : "discount_code_disabled",
    targetType: "discount_codes",
    targetId: params.id,
    metadata: { code: data.code },
  });

  return NextResponse.json({ code: data });
}

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

  const { data: existing } = await supabase
    .from("discount_codes")
    .select("id, code")
    .eq("id", params.id)
    .single() as { data: { id: string; code: string } | null };

  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { error } = await supabase.from("discount_codes").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await auditLog(supabase, {
    adminId,
    action: "discount_code_deleted",
    targetType: "discount_codes",
    targetId: params.id,
    metadata: { code: existing.code },
  });

  return NextResponse.json({ ok: true });
}
