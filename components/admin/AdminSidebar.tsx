"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Stethoscope,
  Users,
  CalendarDays,
  CreditCard,
  FileText,
  ScrollText,
  Settings,
  LogOut,
  ShieldCheck,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

const navItems = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/admin/practitioners", label: "Practitioners", icon: Stethoscope },
  { href: "/admin/patients", label: "Patients", icon: Users },
  { href: "/admin/appointments", label: "Appointments", icon: CalendarDays },
  { href: "/admin/payments", label: "Payments", icon: CreditCard },
  { href: "/admin/content", label: "Content", icon: FileText },
  { href: "/admin/audit-log", label: "Audit Log", icon: ScrollText },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

interface AdminSidebarProps {
  userName: string;
  userEmail: string;
}

export function AdminSidebar({ userName, userEmail }: AdminSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/sign-in");
  }

  return (
    <aside className="w-64 flex-shrink-0 h-full flex flex-col" style={{ backgroundColor: "#1A120C" }}>
      {/* Logo / wordmark */}
      <div className="px-6 pt-8 pb-6 border-b border-white/10">
        <div className="flex items-center gap-2 mb-1">
          <ShieldCheck size={18} className="text-amber-400" style={{ color: "#C27D30" }} />
          <span className="font-serif text-xl text-white">Nesema</span>
        </div>
        <span
          className="text-xs font-semibold uppercase tracking-widest"
          style={{ color: "#C27D30" }}
        >
          Admin Console
        </span>
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map(({ href, label, icon: Icon, exact }) => {
          const isActive = exact ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                isActive
                  ? "text-white"
                  : "text-white/50 hover:text-white/80 hover:bg-white/5"
              }`}
              style={isActive ? { backgroundColor: "#C27D30" + "33", color: "#F5C97C" } : {}}
            >
              <Icon
                size={16}
                style={isActive ? { color: "#C27D30" } : {}}
                className={isActive ? "" : "text-white/40"}
              />
              {label}
              {isActive && (
                <span
                  className="ml-auto w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: "#C27D30" }}
                />
              )}
            </Link>
          );
        })}
      </nav>

      {/* User footer */}
      <div className="px-4 py-4 border-t border-white/10">
        <div className="flex items-center gap-3 mb-3">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
            style={{ backgroundColor: "#C27D30", color: "#1A120C" }}
          >
            {userName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-white truncate">{userName}</p>
            <p className="text-xs text-white/40 truncate">{userEmail}</p>
          </div>
        </div>
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-white/50 hover:text-white/80 hover:bg-white/5 transition-colors"
        >
          <LogOut size={14} />
          Sign out
        </button>
      </div>
    </aside>
  );
}
