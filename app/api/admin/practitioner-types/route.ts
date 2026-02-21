import { NextRequest, NextResponse } from "next/server";
import { adminDb, requireAdmin, auditLog } from "@/lib/admin-api";

export const runtime = "nodejs";

// GET — list all types (admins see inactive ones too)
export async function GET() {
  try {
    await requireAdmin();
  } catch (err) {
    return err as NextResponse;
  }

  const supabase = adminDb();
  const { data, error } = await supabase
    .from("practitioner_types")
    .select("id, name, is_active, sort_order, created_at")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ types: data ?? [] });
}

// POST — create a new type
export async function POST(request: NextRequest) {
  let adminId: string;
  try {
    ({ adminId } = await requireAdmin());
  } catch (err) {
    return err as NextResponse;
  }

  const body = await request.json().catch(() => ({})) as { name?: string; sort_order?: number };
  const name = (body.name ?? "").trim();

  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });

  const supabase = adminDb();

  // Get current max sort_order to append at bottom
  const { data: maxRow } = await supabase
    .from("practitioner_types")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle() as { data: { sort_order: number } | null };

  const sort_order = body.sort_order ?? ((maxRow?.sort_order ?? 0) + 1);

  const { data, error } = await supabase
    .from("practitioner_types")
    .insert({ name, sort_order, is_active: true, created_by: adminId })
    .select("id, name, is_active, sort_order, created_at")
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "A type with this name already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await auditLog(supabase, {
    adminId,
    action: "practitioner_type_created",
    targetType: "practitioner_types",
    targetId: data.id,
    metadata: { name },
  });

  return NextResponse.json({ type: data }, { status: 201 });
}
