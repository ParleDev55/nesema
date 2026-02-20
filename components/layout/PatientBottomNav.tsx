"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CheckCircle2,
  CalendarDays,
  MessageSquare,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/patient/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/patient/check-in", label: "Check-in", icon: CheckCircle2 },
  { href: "/patient/appointments", label: "Sessions", icon: CalendarDays },
  { href: "/patient/messages", label: "Messages", icon: MessageSquare },
  { href: "/patient/settings", label: "Settings", icon: Settings },
];

export function PatientBottomNav() {
  const pathname = usePathname();
  return (
    <nav
      className="bg-[#2A2118] border-t border-white/10 flex"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {items.map(({ href, label, icon: Icon }) => {
        const isActive = pathname === href || pathname.startsWith(href + "/");
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex-1 flex flex-col items-center justify-center gap-1 py-3 min-h-[56px] text-[10px] font-medium transition-colors",
              isActive ? "text-nesema-sage" : "text-white/50"
            )}
          >
            <Icon size={22} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
