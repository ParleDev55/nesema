import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { syncAppointmentCompleted } from "@/lib/ghl-sync";
import type { Database } from "@/types/database";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const cookieStore = cookies();
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {}
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { appointmentId } = (await req.json().catch(() => ({}))) as {
    appointmentId?: string;
  };
  if (!appointmentId) {
    return NextResponse.json({ error: "appointmentId required" }, { status: 400 });
  }

  // Fire-and-forget GHL sync
  void syncAppointmentCompleted(appointmentId).catch(() => {});

  return NextResponse.json({ ok: true });
}
