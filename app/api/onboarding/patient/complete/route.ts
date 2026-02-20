import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { syncPatientSignup } from "@/lib/ghl-sync";
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

  const adminDb = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data: patient } = await adminDb
    .from("patients")
    .select("id")
    .eq("profile_id", user.id)
    .single();

  if (!patient) return NextResponse.json({ error: "Patient not found" }, { status: 404 });

  // Fire-and-forget GHL sync
  void syncPatientSignup(patient.id).catch(() => {});

  return NextResponse.json({ ok: true });
}
