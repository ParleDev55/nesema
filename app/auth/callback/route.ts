import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next");

  if (code) {
    const cookieStore = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          },
        },
      }
    );

    const {
      data: { user },
      error,
    } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && user) {
      // Honour an explicit `next` param (e.g. password-reset redirect)
      if (next) {
        return NextResponse.redirect(new URL(next, origin));
      }

      // Route by profile role
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (profile?.role === "practitioner") {
        return NextResponse.redirect(new URL("/practitioner/dashboard", origin));
      }
      if (profile?.role === "admin") {
        return NextResponse.redirect(new URL("/admin", origin));
      }
      return NextResponse.redirect(new URL("/patient/dashboard", origin));
    }
  }

  return NextResponse.redirect(new URL("/sign-in?error=auth", origin));
}
