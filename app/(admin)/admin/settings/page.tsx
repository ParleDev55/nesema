import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { SettingsClient } from "@/components/admin/SettingsClient";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

function adminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const supabase = adminClient();

  // Get current settings (first row, or defaults)
  const { data: settingsRaw } = await supabase
    .from("platform_settings")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const settings = settingsRaw as import("@/types/database").PlatformSettings | null;

  // Get current admin profile
  const cookieStore = cookies();
  const anonClient = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll() {},
      },
    }
  );
  const { data: { user } } = await anonClient.auth.getUser();

  return (
    <SettingsClient
      settings={settings ?? {
        id: "",
        allow_practitioner_signup: true,
        allow_patient_signup: true,
        maintenance_mode: false,
        updated_at: new Date().toISOString(),
        updated_by: null,
      }}
      adminId={user?.id ?? null}
    />
  );
}
