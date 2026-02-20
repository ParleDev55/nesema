import { NextResponse } from "next/server";
import { requireAdmin, adminDb } from "@/lib/admin-api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    await requireAdmin();
  } catch (err) {
    return err as NextResponse;
  }

  const supabase = adminDb();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("ghl_sync_log")
    .select(
      "id, event_type, ghl_contact_id, success, error, created_at, user_id, profiles ( first_name, last_name, email )"
    )
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ rows: data ?? [] });
}
