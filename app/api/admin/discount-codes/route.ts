import { NextRequest, NextResponse } from "next/server";
import { adminDb, requireAdmin, auditLog } from "@/lib/admin-api";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireAdmin();
  } catch (err) {
    return err as NextResponse;
  }

  const supabase = adminDb();
  const { data, error } = await supabase
    .from("discount_codes")
    .select("id, code, description, discount_type, discount_value, applies_to, max_uses, uses_count, valid_from, valid_until, is_active, created_at")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ codes: data ?? [] });
}

export async function POST(request: NextRequest) {
  let adminId: string;
  try {
    ({ adminId } = await requireAdmin());
  } catch (err) {
    return err as NextResponse;
  }

  const body = await request.json().catch(() => ({})) as {
    code?: string;
    description?: string;
    discount_type?: "percentage" | "fixed";
    discount_value?: number;
    applies_to?: "all" | "initial" | "followup";
    max_uses?: number | null;
    valid_until?: string | null;
  };

  const code = (body.code ?? "").trim().toUpperCase();
  if (!code) return NextResponse.json({ error: "code is required" }, { status: 400 });
  if (!body.discount_type || !["percentage", "fixed"].includes(body.discount_type)) {
    return NextResponse.json({ error: "discount_type must be percentage or fixed" }, { status: 400 });
  }
  if (!body.discount_value || body.discount_value <= 0) {
    return NextResponse.json({ error: "discount_value must be greater than 0" }, { status: 400 });
  }
  if (body.discount_type === "percentage" && body.discount_value > 100) {
    return NextResponse.json({ error: "Percentage discount cannot exceed 100" }, { status: 400 });
  }

  const supabase = adminDb();

  const { data, error } = await supabase
    .from("discount_codes")
    .insert({
      code,
      description: body.description?.trim() || null,
      discount_type: body.discount_type,
      discount_value: body.discount_value,
      applies_to: body.applies_to ?? "all",
      max_uses: body.max_uses ?? null,
      valid_until: body.valid_until ?? null,
      is_active: true,
      created_by: adminId,
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "A discount code with this code already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await auditLog(supabase, {
    adminId,
    action: "discount_code_created",
    targetType: "discount_codes",
    targetId: (data as { id: string }).id,
    metadata: { code, discount_type: body.discount_type, discount_value: body.discount_value },
  });

  return NextResponse.json({ code: data }, { status: 201 });
}
