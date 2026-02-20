import { requireAdmin, adminDb } from "@/lib/admin-api";
import { syncPractitionerSignup } from "@/lib/ghl-sync";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

interface PracRow {
  id: string;
  profile_id: string;
  profiles: { ghl_contact_id: string | null } | null;
}

export async function POST() {
  try {
    await requireAdmin();
  } catch (err) {
    return err as NextResponse;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = adminDb() as any;

  const { data: practitioners } = (await supabase
    .from("practitioners")
    .select("id, profile_id, profiles ( ghl_contact_id )")
    .order("created_at", { ascending: true })) as { data: PracRow[] | null };

  const all = practitioners ?? [];
  // Prioritise those with no GHL contact ID
  const toSync = all.filter((p) => {
    const prof = Array.isArray(p.profiles) ? p.profiles[0] : p.profiles;
    return !(prof as { ghl_contact_id?: string | null } | null)?.ghl_contact_id;
  });
  const total = toSync.length;

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      controller.enqueue(enc.encode(`{"total":${total}}\n`));
      let done = 0;
      for (const prac of toSync) {
        await syncPractitionerSignup(prac.id).catch(() => {});
        done++;
        controller.enqueue(enc.encode(`{"done":${done},"total":${total}}\n`));
      }
      controller.enqueue(enc.encode(`{"complete":true,"synced":${done}}\n`));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8" },
  });
}
