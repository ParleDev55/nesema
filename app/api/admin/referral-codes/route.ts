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
    .from("referral_codes")
    .select("id, code, description, referrer_reward_type, referrer_reward_value, referee_reward_type, referee_reward_value, max_uses, uses_count, valid_from, valid_until, is_active, created_at")
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
    referrer_reward_type?: "percentage" | "fixed" | "none";
    referrer_reward_value?: number;
    referee_reward_type?: "percentage" | "fixed" | "none";
    referee_reward_value?: number;
    max_uses?: number | null;
    valid_until?: string | null;
  };

  const code = (body.code ?? "").trim().toUpperCase();
  if (!code) return NextResponse.json({ error: "code is required" }, { status: 400 });

  const supabase = adminDb();

  const { data, error } = await supabase
    .from("referral_codes")
    .insert({
      code,
      description: body.description?.trim() || null,
      referrer_reward_type: body.referrer_reward_type ?? "none",
      referrer_reward_value: body.referrer_reward_value ?? 0,
      referee_reward_type: body.referee_reward_type ?? "none",
      referee_reward_value: body.referee_reward_value ?? 0,
      max_uses: body.max_uses ?? null,
      valid_until: body.valid_until ?? null,
      is_active: true,
      created_by: adminId,
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "A referral code with this code already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await auditLog(supabase, {
    adminId,
    action: "referral_code_created",
    targetType: "referral_codes",
    targetId: (data as { id: string }).id,
    metadata: { code },
  });

  return NextResponse.json({ code: data }, { status: 201 });
}
