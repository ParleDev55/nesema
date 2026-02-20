import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AdminSidebar } from "@/components/admin/AdminSidebar";

export default async function AdminLayout({
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

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, first_name, last_name, email")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    redirect("/sign-in");
  }

  const userName =
    [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
    user.email?.split("@")[0] ||
    "Admin";

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: "#1A120C" }}>
      <AdminSidebar
        userName={userName}
        userEmail={profile?.email || user.email || ""}
      />
      {/* Main content area */}
      <main
        className="flex-1 overflow-y-auto"
        style={{ backgroundColor: "#F6F3EE" }}
      >
        {children}
      </main>
    </div>
  );
}
