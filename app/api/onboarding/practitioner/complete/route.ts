import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { syncPractitionerSignup } from "@/lib/ghl-sync";
import type { Database } from "@/types/database";

export const runtime = "nodejs";

export async function POST() {
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

  // Look up practitioner ID via service-role (bypasses RLS)
  const adminDb = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data: prac } = await adminDb
    .from("practitioners")
    .select("id")
    .eq("profile_id", user.id)
    .single();

  if (!prac) return NextResponse.json({ error: "Practitioner not found" }, { status: 404 });

  // Fire-and-forget GHL sync — never block the response
  void syncPractitionerSignup(prac.id).catch(() => {});

  return NextResponse.json({ ok: true });
}
