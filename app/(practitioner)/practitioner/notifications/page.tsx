"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { BellOff, CheckCheck, Send, X, ChevronDown, Users, User } from "lucide-react";

type NotifType = "all" | "unread" | "lab_result" | "appointment" | "message" | "payment";

type Notif = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  read: boolean;
  link: string | null;
  created_at: string;
};

type Patient = { id: string; name: string };

const TABS: { key: NotifType; label: string }[] = [
  { key: "all", label: "All" },
  { key: "unread", label: "Unread" },
  { key: "appointment", label: "Appointments" },
  { key: "message", label: "Messages" },
  { key: "payment", label: "Payments" },
  { key: "lab_result", label: "Lab Results" },
];

const TYPE_ICON: Record<string, string> = {
  appointment: "📅",
  message: "💬",
  payment: "💷",
  lab_result: "🧪",
  general: "📢",
  default: "🔔",
};

const SEND_TYPE_OPTIONS = [
  { value: "general", label: "📢 General announcement" },
  { value: "appointment", label: "📅 Appointment reminder" },
  { value: "message", label: "💬 Message" },
  { value: "lab_result", label: "🧪 Lab result ready" },
];

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

export default function PractitionerNotificationsPage() {
  const supabase = createClient();
  const router = useRouter();
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [activeTab, setActiveTab] = useState<NotifType>("all");
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);

  // ── Send notification state
  const [sendOpen, setSendOpen] = useState(false);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [sendTarget, setSendTarget] = useState<"all" | string>("all");
  const [sendType, setSendType] = useState("general");
  const [sendTitle, setSendTitle] = useState("");
  const [sendBody, setSendBody] = useState("");
  const [sending, setSending] = useState(false);
  const [sendSuccess, setSendSuccess] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

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

  // Load patients for the send modal
  const loadPatients = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: prac } = (await supabase
      .from("practitioners")
      .select("id")
      .eq("profile_id", user.id)
      .single()) as { data: { id: string } | null; error: unknown };
    if (!prac) return;

    const { data: pts } = (await supabase
      .from("patients")
      .select("id, profile_id")
      .eq("practitioner_id", prac.id)) as {
      data: { id: string; profile_id: string }[] | null; error: unknown;
    };
    if (!pts || pts.length === 0) return;

    const profileIds = pts.map((p) => p.profile_id);
    const { data: profiles } = (await supabase
      .from("profiles")
      .select("id, first_name, last_name")
      .in("id", profileIds)) as {
      data: { id: string; first_name: string | null; last_name: string | null }[] | null; error: unknown;
    };

    const pMap: Record<string, string> = {};
    for (const pr of profiles ?? []) {
      pMap[pr.id] = [pr.first_name, pr.last_name].filter(Boolean).join(" ") || "Patient";
    }
    setPatients(pts.map((p) => ({ id: p.id, name: pMap[p.profile_id] ?? "Patient" })));
  }, [supabase]);

  useEffect(() => {
    loadNotifs();
    loadPatients();

    // Realtime subscription
    let channel: ReturnType<typeof supabase.channel> | null = null;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      channel = supabase
        .channel("practitioner-notifications")
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
  }, [loadNotifs, loadPatients, supabase]);

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

  function openSend() {
    setSendOpen(true);
    setSendTarget("all");
    setSendType("general");
    setSendTitle("");
    setSendBody("");
    setSendError(null);
    setSendSuccess(false);
  }

  async function handleSend() {
    if (!sendTitle.trim()) { setSendError("Please enter a notification title."); return; }
    setSending(true);
    setSendError(null);

    try {
      const res = await fetch("/api/notifications/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target: sendTarget,
          type: sendType,
          title: sendTitle.trim(),
          body: sendBody.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSendError(data.error ?? "Something went wrong.");
      } else {
        setSendSuccess(true);
        setTimeout(() => { setSendOpen(false); setSendSuccess(false); }, 1500);
      }
    } catch {
      setSendError("Network error — please try again.");
    } finally {
      setSending(false);
    }
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
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-serif text-3xl text-[#1E1A16]">Notifications</h1>
          {unreadCount > 0 && (
            <p className="text-xs text-[#9C9087] mt-0.5">{unreadCount} unread</p>
          )}
        </div>
        <div className="flex items-center gap-2">
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
          <button
            onClick={openSend}
            className="flex items-center gap-1.5 text-xs font-medium text-white bg-[#2E2620] px-3 py-1.5 rounded-full hover:bg-[#4E3D30] transition-colors"
          >
            <Send size={13} />
            Send
          </button>
        </div>
      </div>

      {/* Filter tabs */}
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

      {/* List */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#4E7A5F]/30 p-10 text-center">
          <BellOff className="mx-auto mb-3 text-[#4E7A5F]/40" size={32} />
          <p className="text-[#1E1A16] font-medium mb-1">
            {activeTab === "unread" ? "All caught up" : "Nothing here yet"}
          </p>
          <p className="text-[#9C9087] text-sm">
            {activeTab === "unread"
              ? "You have no unread notifications."
              : "Notifications will appear here as activity happens."}
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

      {/* ── Send Notification Modal ──────────────────────────────────────────── */}
      {sendOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
          onClick={() => setSendOpen(false)}
        >
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div
            className="relative bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E6E0D8]">
              <h2 className="font-semibold text-[#1E1A16]">Send Notification</h2>
              <button onClick={() => setSendOpen(false)} className="text-[#9C9087] hover:text-[#1E1A16] transition-colors">
                <X size={18} />
              </button>
            </div>

            {sendSuccess ? (
              <div className="px-6 py-10 text-center">
                <div className="text-4xl mb-3">✅</div>
                <p className="font-medium text-[#1E1A16]">Notification sent!</p>
                <p className="text-sm text-[#9C9087] mt-1">
                  {sendTarget === "all"
                    ? `Sent to all ${patients.length} patient${patients.length !== 1 ? "s" : ""}`
                    : `Sent to ${patients.find((p) => p.id === sendTarget)?.name ?? "patient"}`}
                </p>
              </div>
            ) : (
              <div className="p-6 space-y-4">
                {/* Target */}
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-[#5C5248] mb-2 block">
                    Send to
                  </label>
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <button
                      onClick={() => setSendTarget("all")}
                      className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border text-sm font-medium transition-all ${
                        sendTarget === "all"
                          ? "border-[#4E7A5F] bg-[#EBF2EE] text-[#2E5C45]"
                          : "border-[#E6E0D8] bg-[#FDFCFA] text-[#5C5248] hover:bg-[#F6F3EE]"
                      }`}
                    >
                      <Users size={15} />
                      All patients
                      {patients.length > 0 && (
                        <span className="ml-auto text-[11px] text-[#9C9087]">{patients.length}</span>
                      )}
                    </button>
                    <button
                      onClick={() => setSendTarget(sendTarget === "all" ? (patients[0]?.id ?? "all") : sendTarget)}
                      className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border text-sm font-medium transition-all ${
                        sendTarget !== "all"
                          ? "border-[#4E7A5F] bg-[#EBF2EE] text-[#2E5C45]"
                          : "border-[#E6E0D8] bg-[#FDFCFA] text-[#5C5248] hover:bg-[#F6F3EE]"
                      }`}
                    >
                      <User size={15} />
                      Specific patient
                    </button>
                  </div>

                  {/* Patient picker */}
                  {sendTarget !== "all" && (
                    <div className="relative">
                      <select
                        value={sendTarget}
                        onChange={(e) => setSendTarget(e.target.value)}
                        className="w-full appearance-none text-sm border border-[#E6E0D8] rounded-xl px-4 py-2.5 pr-9 focus:outline-none focus:ring-2 focus:ring-[#4E7A5F]/25 bg-white"
                      >
                        {patients.length === 0 ? (
                          <option value="">No patients found</option>
                        ) : (
                          patients.map((p) => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))
                        )}
                      </select>
                      <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9C9087] pointer-events-none" />
                    </div>
                  )}
                </div>

                {/* Type */}
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-[#5C5248] mb-2 block">
                    Type
                  </label>
                  <div className="relative">
                    <select
                      value={sendType}
                      onChange={(e) => setSendType(e.target.value)}
                      className="w-full appearance-none text-sm border border-[#E6E0D8] rounded-xl px-4 py-2.5 pr-9 focus:outline-none focus:ring-2 focus:ring-[#4E7A5F]/25 bg-white"
                    >
                      {SEND_TYPE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9C9087] pointer-events-none" />
                  </div>
                </div>

                {/* Title */}
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-[#5C5248] mb-2 block">
                    Title
                  </label>
                  <input
                    value={sendTitle}
                    onChange={(e) => setSendTitle(e.target.value)}
                    placeholder="e.g. Your lab results are ready"
                    className="w-full text-sm border border-[#E6E0D8] rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#4E7A5F]/25 bg-white"
                  />
                </div>

                {/* Body */}
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-[#5C5248] mb-2 block">
                    Message <span className="text-[#9C9087] normal-case font-normal">(optional)</span>
                  </label>
                  <textarea
                    value={sendBody}
                    onChange={(e) => setSendBody(e.target.value)}
                    placeholder="Add more detail here…"
                    rows={3}
                    className="w-full text-sm border border-[#E6E0D8] rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#4E7A5F]/25 bg-white resize-none"
                  />
                </div>

                {sendError && (
                  <p className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">
                    {sendError}
                  </p>
                )}

                {/* Actions */}
                <div className="flex gap-3 pt-1">
                  <button
                    onClick={() => setSendOpen(false)}
                    className="flex-1 py-2.5 rounded-full border border-[#E6E0D8] text-sm text-[#5C5248] hover:bg-[#F6F3EE] transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSend}
                    disabled={sending || !sendTitle.trim() || (sendTarget !== "all" && patients.length === 0)}
                    className="flex-1 py-2.5 rounded-full bg-[#2E2620] text-white text-sm font-medium hover:bg-[#4E3D30] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {sending ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                        Sending…
                      </>
                    ) : (
                      <>
                        <Send size={13} />
                        {sendTarget === "all"
                          ? `Send to all${patients.length > 0 ? ` (${patients.length})` : ""}`
                          : "Send"}
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
