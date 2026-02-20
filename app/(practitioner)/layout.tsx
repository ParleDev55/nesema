import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/layout/AppShell";
import { PractitionerSidebar } from "@/components/layout/PractitionerSidebar";
import { PractitionerBottomNav } from "@/components/layout/PractitionerBottomNav";
import type { Profile } from "@/types/database";

export default async function PractitionerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  const profile = data as Profile | null;

  if (profile?.role !== "practitioner") {
    redirect("/patient/dashboard");
  }

  const { data: platformSettings } = await supabase
    .from("platform_settings")
    .select("maintenance_mode")
    .limit(1)
    .maybeSingle();

  if (platformSettings?.maintenance_mode) {
    redirect("/maintenance");
  }

  const userName =
    [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
    user.email?.split("@")[0] ||
    "Practitioner";

  return (
    <AppShell
      sidebar={
        <PractitionerSidebar
          userName={userName}
          userEmail={profile?.email || user.email || ""}
          avatarUrl={profile?.avatar_url || undefined}
        />
      }
      bottomNav={<PractitionerBottomNav />}
    >
      {children}
    </AppShell>
  );
}
