import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/layout/AppShell";
import { PatientSidebar } from "@/components/layout/PatientSidebar";
import type { Profile } from "@/types/database";

export default async function PatientLayout({
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

  if (profile?.role !== "patient") {
    redirect("/dashboard");
  }

  const userName =
    [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
    user.email?.split("@")[0] ||
    "Patient";

  return (
    <AppShell
      sidebar={
        <PatientSidebar
          userName={userName}
          userEmail={profile?.email || user.email || ""}
          avatarUrl={profile?.avatar_url || undefined}
        />
      }
    >
      {children}
    </AppShell>
  );
}
