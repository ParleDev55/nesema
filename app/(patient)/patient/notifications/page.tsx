"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { BellOff, CheckCheck } from "lucide-react";

type NotifType = "all" | "unread" | "lab_result" | "appointment" | "message";

type Notif = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  read: boolean;
  link: string | null;
  created_at: string;
};

const TABS: { key: NotifType; label: string }[] = [
  { key: "all", label: "All" },
  { key: "unread", label: "Unread" },
  { key: "appointment", label: "Appointments" },
  { key: "message", label: "Messages" },
  { key: "lab_result", label: "Lab Results" },
];

const TYPE_ICON: Record<string, string> = {
  appointment: "📅",
  message: "💬",
  lab_result: "🧪",
  payment: "💷",
  default: "🔔",
};

function fmtRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export default function PatientNotificationsPage() {
  const supabase = createClient();
  const router = useRouter();
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [activeTab, setActiveTab] = useState<NotifType>("all");
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);

  const loadNotifs = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = (await supabase
      .from("notifications")
      .select("id, type, title, body, read, link, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100)) as { data: Notif[] | null; error: unknown };
    setNotifs(data ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadNotifs();

    let channel: ReturnType<typeof supabase.channel> | null = null;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      channel = supabase
        .channel("patient-notifications")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
          (payload) => {
            setNotifs((prev) => [payload.new as Notif, ...prev]);
          }
        )
        .subscribe();
    })();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [loadNotifs, supabase]);

  async function markAllRead() {
    setMarkingAll(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setMarkingAll(false); return; }
    await supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", user.id)
      .eq("read", false);
    setNotifs((prev) => prev.map((n) => ({ ...n, read: true })));
    setMarkingAll(false);
  }

  async function handleClick(notif: Notif) {
    if (!notif.read) {
      await supabase.from("notifications").update({ read: true }).eq("id", notif.id);
      setNotifs((prev) => prev.map((n) => n.id === notif.id ? { ...n, read: true } : n));
    }
    if (notif.link) router.push(notif.link);
  }

  const filtered = notifs.filter((n) => {
    if (activeTab === "all") return true;
    if (activeTab === "unread") return !n.read;
    return n.type === activeTab;
  });

  const unreadCount = notifs.filter((n) => !n.read).length;

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-[#4E7A5F] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-serif text-3xl text-[#1E1A16]">Notifications</h1>
          {unreadCount > 0 && (
            <p className="text-xs text-[#9C9087] mt-0.5">{unreadCount} unread</p>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            disabled={markingAll}
            className="flex items-center gap-1.5 text-xs text-[#4E7A5F] border border-[#4E7A5F]/30 px-3 py-1.5 rounded-full hover:bg-[#EBF2EE] transition-colors disabled:opacity-50"
          >
            <CheckCheck size={13} />
            Mark all read
          </button>
        )}
      </div>

      <div className="flex gap-1 mb-6 overflow-x-auto pb-1">
        {TABS.map(({ key, label }) => {
          const count = key === "unread"
            ? notifs.filter((n) => !n.read).length
            : key === "all"
            ? notifs.length
            : notifs.filter((n) => n.type === key).length;
          if (key !== "all" && key !== "unread" && count === 0) return null;
          return (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                activeTab === key
                  ? "bg-[#2E2620] text-white"
                  : "bg-[#F6F3EE] text-[#5C5248] hover:bg-[#E6E0D8]"
              }`}
            >
              {label}
              {count > 0 && (
                <span className={`text-[10px] px-1.5 rounded-full ${
                  activeTab === key ? "bg-white/20 text-white" : "bg-[#E6E0D8] text-[#9C9087]"
                }`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#4E7A5F]/30 p-10 text-center">
          <BellOff className="mx-auto mb-3 text-[#4E7A5F]/40" size={32} />
          <p className="text-[#1E1A16] font-medium mb-1">
            {activeTab === "unread" ? "All caught up" : "Nothing here yet"}
          </p>
          <p className="text-[#9C9087] text-sm">
            {activeTab === "unread"
              ? "No unread notifications."
              : "Your practitioner will send updates and alerts here."}
          </p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {filtered.map((n) => (
            <button
              key={n.id}
              onClick={() => handleClick(n)}
              className={`w-full text-left rounded-2xl border px-4 py-3.5 flex items-start gap-3 transition-colors ${
                n.read
                  ? "bg-white border-[#E6E0D8] opacity-70 hover:opacity-100"
                  : "bg-[#EBF2EE]/40 border-[#4E7A5F]/20 hover:bg-[#EBF2EE]/60"
              }`}
            >
              <span className="text-base shrink-0 mt-0.5">
                {TYPE_ICON[n.type] ?? TYPE_ICON.default}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p className={`text-sm font-medium ${n.read ? "text-[#5C5248]" : "text-[#1E1A16]"}`}>
                    {n.title}
                  </p>
                  {!n.read && (
                    <span className="w-2 h-2 rounded-full bg-[#4E7A5F] shrink-0 mt-1.5" />
                  )}
                </div>
                {n.body && (
                  <p className="text-xs text-[#9C9087] mt-0.5 line-clamp-2">{n.body}</p>
                )}
                <p className="text-[11px] text-[#BFB8B0] mt-1">{fmtRelative(n.created_at)}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
