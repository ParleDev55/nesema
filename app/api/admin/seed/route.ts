import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * One-time endpoint to create the first super-admin account.
 * Protected by SEED_SECRET env var — must be provided as Bearer token.
 * Set ADMIN_EMAIL and ADMIN_PASSWORD in env vars.
 */
export async function POST(req: Request) {
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace("Bearer ", "");
  const seedSecret = process.env.SEED_SECRET;

  if (!seedSecret || token !== seedSecret) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    return NextResponse.json(
      { error: "ADMIN_EMAIL and ADMIN_PASSWORD env vars are required" },
      { status: 400 }
    );
  }

  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Create the auth user
  const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (authErr) {
    return NextResponse.json({ error: authErr.message }, { status: 400 });
  }

  const userId = authData.user.id;

  // Upsert the profile with role = 'admin'
  const { error: profileErr } = await supabase.from("profiles").upsert({
    id: userId,
    role: "admin",
    first_name: "Admin",
    last_name: "User",
    email,
    suspended: false,
  });

  if (profileErr) {
    // Clean up auth user on profile failure
    await supabase.auth.admin.deleteUser(userId).catch(() => {});
    return NextResponse.json({ error: profileErr.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    message: `Admin account created for ${email}. This endpoint should now be disabled or removed.`,
  });
}
