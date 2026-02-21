"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Calendar,
  Briefcase,
  FileText,
  BookOpen,
  CreditCard,
  MessageSquare,
  BarChart2,
  Bell,
  Settings,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

const NAV_GROUPS = [
  [
    { href: "/practitioner/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/practitioner/patients", label: "Patients", icon: Users },
    { href: "/practitioner/calendar", label: "Calendar", icon: Calendar },
  ],
  [
    { href: "/practitioner/toolkit", label: "Toolkit", icon: Briefcase },
    { href: "/practitioner/documents", label: "Documents", icon: FileText },
    { href: "/practitioner/education", label: "Education", icon: BookOpen },
  ],
  [
    { href: "/practitioner/payments", label: "Payments", icon: CreditCard },
    { href: "/practitioner/messages", label: "Messages", icon: MessageSquare },
    { href: "/practitioner/analytics", label: "Analytics", icon: BarChart2 },
  ],
  [
    { href: "/practitioner/notifications", label: "Notifications", icon: Bell },
    { href: "/practitioner/settings", label: "Settings", icon: Settings },
  ],
];

interface PractitionerSidebarProps {
  userName?: string;
  userEmail?: string;
  avatarUrl?: string;
}

export function PractitionerSidebar({
  userName = "Practitioner",
  userEmail = "",
  avatarUrl,
}: PractitionerSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const initials = userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/sign-in");
  }

  return (
    <aside className="flex h-screen w-60 flex-col bg-[#2A2118] text-white flex-shrink-0">
      {/* Logo */}
      <div className="px-6 py-7 border-b border-white/10">
        <span className="font-serif text-2xl font-semibold tracking-wide text-white">
          Nesema
        </span>
        <p className="text-[11px] text-white/40 mt-0.5 font-sans">
          Practitioner Portal
        </p>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {NAV_GROUPS.map((group, gi) => (
          <div key={gi}>
            {gi > 0 && (
              <div className="mx-1 my-2.5 border-t border-white/[0.08]" />
            )}
            <div className="space-y-0.5">
              {group.map(({ href, label, icon: Icon }) => {
                const isActive = pathname === href || pathname.startsWith(href + "/");
                return (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-nesema-sage text-white"
                        : "text-white/55 hover:text-white hover:bg-white/8"
                    )}
                  >
                    <Icon
                      size={18}
                      className={cn(isActive ? "text-white" : "text-white/55")}
                    />
                    {label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User footer */}
      <div className="border-t border-white/10 px-4 py-4">
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9 flex-shrink-0">
            {avatarUrl && <AvatarImage src={avatarUrl} alt={userName} />}
            <AvatarFallback className="bg-nesema-sage text-white text-xs">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{userName}</p>
            <p className="text-xs text-white/40 truncate">{userEmail}</p>
          </div>
          <button
            onClick={handleSignOut}
            className="text-white/40 hover:text-white transition-colors flex-shrink-0"
            title="Sign out"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  );
}
