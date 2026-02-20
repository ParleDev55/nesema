"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Calendar,
  MessageSquare,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/practitioner/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/practitioner/patients", label: "Patients", icon: Users },
  { href: "/practitioner/calendar", label: "Calendar", icon: Calendar },
  { href: "/practitioner/messages", label: "Messages", icon: MessageSquare },
  { href: "/practitioner/settings", label: "Settings", icon: Settings },
];

export function PractitionerBottomNav() {
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
