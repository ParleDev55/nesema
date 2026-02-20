import { NextResponse } from "next/server";
import { adminDb, requireAdmin, auditLog } from "@/lib/admin-api";

export async function POST(req: Request) {
  let adminId: string;
  try {
    ({ adminId } = await requireAdmin());
  } catch (err) {
    return err as NextResponse;
  }

  const body = (await req.json().catch(() => ({}))) as {
    maintenance_mode?: boolean;
    allow_practitioner_signup?: boolean;
    allow_patient_signup?: boolean;
    adminId?: string;
  };

  const supabase = adminDb();

  // Check if a settings row exists
  const { data: existing } = await supabase
    .from("platform_settings")
    .select("id")
    .limit(1)
    .maybeSingle();

  const payload = {
    maintenance_mode: body.maintenance_mode ?? false,
    allow_practitioner_signup: body.allow_practitioner_signup ?? true,
    allow_patient_signup: body.allow_patient_signup ?? true,
    updated_at: new Date().toISOString(),
    updated_by: adminId,
  };

  let error;
  if (existing?.id) {
    ({ error } = await supabase
      .from("platform_settings")
      .update(payload)
      .eq("id", existing.id));
  } else {
    ({ error } = await supabase.from("platform_settings").insert(payload));
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await auditLog(supabase, {
    adminId,
    action: "settings_update",
    targetType: "platform_settings",
    targetId: existing?.id ?? "new",
    metadata: payload as Record<string, unknown>,
  });

  return NextResponse.json({ ok: true });
}
