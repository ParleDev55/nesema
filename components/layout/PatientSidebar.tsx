"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ClipboardList,
  CheckCircle2,
  TrendingUp,
  CalendarDays,
  Lock,
  BookOpen,
  HeartHandshake,
  MessageSquare,
  Settings,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/plan", label: "My Plan", icon: ClipboardList },
  { href: "/check-in", label: "Check-in", icon: CheckCircle2 },
  { href: "/progress", label: "Progress", icon: TrendingUp },
  { href: "/appointments", label: "Appointments", icon: CalendarDays },
  { href: "/vault", label: "Results Vault", icon: Lock },
  { href: "/learn", label: "Learn", icon: BookOpen },
  { href: "/team", label: "Care Team", icon: HeartHandshake },
  { href: "/messages", label: "Messages", icon: MessageSquare },
  { href: "/settings", label: "Settings", icon: Settings },
];

interface PatientSidebarProps {
  userName?: string;
  userEmail?: string;
  avatarUrl?: string;
}

export function PatientSidebar({
  userName = "Patient",
  userEmail = "",
  avatarUrl,
}: PatientSidebarProps) {
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
          My Health Journey
        </p>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {navItems.map(({ href, label, icon: Icon }) => {
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
