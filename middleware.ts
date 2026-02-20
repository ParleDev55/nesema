import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Routes that don't require authentication
const PUBLIC_ROUTES = ["/sign-in", "/sign-up", "/book", "/maintenance"];

// Routes only accessible by admin role
const ADMIN_ROUTES = ["/admin"];

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh session — IMPORTANT: do not remove
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // Skip middleware entirely for static files and API cron routes
  if (pathname.startsWith("/api/cron") || pathname.startsWith("/api/admin/seed")) {
    return supabaseResponse;
  }

  // ── Platform settings check ────────────────────────────────────────────────
  // Skip platform settings check for admin routes and API routes
  const isAdminRoute = ADMIN_ROUTES.some(
    (r) => pathname === r || pathname.startsWith(r + "/")
  );
  const isApiRoute = pathname.startsWith("/api/");
  const isMaintenancePage = pathname === "/maintenance";

  if (!isAdminRoute && !isApiRoute && !isMaintenancePage) {
    try {
      const { data: settings } = await supabase
        .from("platform_settings")
        .select("maintenance_mode, allow_practitioner_signup, allow_patient_signup")
        .limit(1)
        .single();

      if (settings) {
        // Maintenance mode: redirect all non-admin users to /maintenance
        if (settings.maintenance_mode && !pathname.startsWith("/sign-in")) {
          // If user is admin, let them through
          if (user) {
            const { data: profile } = await supabase
              .from("profiles")
              .select("role")
              .eq("id", user.id)
              .single();
            if (profile?.role !== "admin") {
              const url = request.nextUrl.clone();
              url.pathname = "/maintenance";
              return NextResponse.redirect(url);
            }
          } else {
            const url = request.nextUrl.clone();
            url.pathname = "/maintenance";
            return NextResponse.redirect(url);
          }
        }

        // Block sign-up for practitioners if toggle is off
        if (
          !settings.allow_practitioner_signup &&
          pathname === "/sign-up" &&
          request.nextUrl.searchParams.get("role") === "practitioner"
        ) {
          const url = request.nextUrl.clone();
          url.pathname = "/sign-in";
          url.searchParams.set("notice", "practitioner-signup-disabled");
          return NextResponse.redirect(url);
        }

        // Block sign-up for patients if toggle is off
        if (
          !settings.allow_patient_signup &&
          pathname === "/sign-up" &&
          request.nextUrl.searchParams.get("role") === "patient"
        ) {
          const url = request.nextUrl.clone();
          url.pathname = "/sign-in";
          url.searchParams.set("notice", "patient-signup-disabled");
          return NextResponse.redirect(url);
        }
      }
    } catch {
      // If platform_settings table doesn't exist yet, continue normally
    }
  }

  // ── Auth guard ─────────────────────────────────────────────────────────────
  const isPublic = PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route + "/")
  );

  if (!user && !isPublic) {
    const signInUrl = request.nextUrl.clone();
    signInUrl.pathname = "/sign-in";
    return NextResponse.redirect(signInUrl);
  }

  // ── Admin route guard ──────────────────────────────────────────────────────
  if (user && isAdminRoute) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "admin") {
      const url = request.nextUrl.clone();
      // Redirect practitioners/patients to their own dashboard
      url.pathname =
        profile?.role === "practitioner"
          ? "/practitioner/dashboard"
          : "/patient/dashboard";
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
