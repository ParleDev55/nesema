"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ArrowLeft, Send, SquarePen, X, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ConversationSummary {
  partnerId: string;
  partnerName: string;
  lastMessage: string;
  lastAt: string;
  unread: number;
}

export interface MessageRow {
  id: string;
  sender_id: string;
  recipient_id: string;
  body: string;
  read_at: string | null;
  created_at: string;
}

export interface PatientContact {
  profileId: string;
  name: string;
}

interface Props {
  currentUserId: string;
  initialConversations: ConversationSummary[];
  patients?: PatientContact[];
}

function formatDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const msgDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = (today.getTime() - msgDay.getTime()) / 86400000;
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function initials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function MessagesUI({ currentUserId, initialConversations, patients = [] }: Props) {
  const supabase = useRef(createClient()).current;

  const [conversations, setConversations] =
    useState<ConversationSummary[]>(initialConversations);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // ── Compose state
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeSearch, setComposeSearch] = useState("");

  // Load thread when conversation selected
  useEffect(() => {
    if (!selectedId) return;

    let cancelled = false;

    async function loadThread() {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .or(
          `and(sender_id.eq.${currentUserId},recipient_id.eq.${selectedId}),and(sender_id.eq.${selectedId},recipient_id.eq.${currentUserId})`
        )
        .order("created_at", { ascending: true });

      if (!cancelled) {
        setMessages((data ?? []) as MessageRow[]);
      }
    }

    loadThread();

    return () => {
      cancelled = true;
    };
  }, [selectedId, currentUserId, supabase]);

  // Mark messages as read
  useEffect(() => {
    if (!selectedId || messages.length === 0) return;

    const unreadIds = messages
      .filter((m) => m.recipient_id === currentUserId && !m.read_at)
      .map((m) => m.id);

    if (unreadIds.length === 0) return;

    supabase
      .from("messages")
      .update({ read_at: new Date().toISOString() })
      .in("id", unreadIds)
      .then(() => {
        setConversations((prev) =>
          prev.map((c) => (c.partnerId === selectedId ? { ...c, unread: 0 } : c))
        );
      });
  }, [messages, selectedId, currentUserId, supabase]);

  // Scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase.channel(`messages:${currentUserId}`);
    channel.on(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      "postgres_changes" as any,
      {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `recipient_id=eq.${currentUserId}`,
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (payload: any) => {
        const msg = payload.new as MessageRow;

          // If we're in that thread, add the message
          if (msg.sender_id === selectedId) {
            setMessages((prev) => [...prev, msg]);
          }

          // Update conversation list
          setConversations((prev) => {
            const existing = prev.find((c) => c.partnerId === msg.sender_id);
            if (existing) {
              return prev.map((c) =>
                c.partnerId === msg.sender_id
                  ? {
                      ...c,
                      lastMessage: msg.body,
                      lastAt: msg.created_at,
                      unread: msg.sender_id === selectedId ? 0 : c.unread + 1,
                    }
                  : c
              );
            }
            // New conversation — fetch partner name
            supabase
              .from("profiles")
              .select("id, first_name, last_name")
              .eq("id", msg.sender_id)
              .single()
              .then(({ data: profile }) => {
                if (!profile) return;
                const name = [profile.first_name, profile.last_name]
                  .filter(Boolean)
                  .join(" ");
                setConversations((p) => [
                  {
                    partnerId: msg.sender_id,
                    partnerName: name || "Unknown",
                    lastMessage: msg.body,
                    lastAt: msg.created_at,
                    unread: 1,
                  },
                  ...p,
                ]);
              });
            return prev;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId, selectedId, supabase]);

  async function sendMessage() {
    if (!input.trim() || !selectedId || sending) return;
    const body = input.trim();
    setInput("");
    setSending(true);

    const optimistic: MessageRow = {
      id: crypto.randomUUID(),
      sender_id: currentUserId,
      recipient_id: selectedId,
      body,
      read_at: null,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);

    const { data } = await supabase
      .from("messages")
      .insert({ sender_id: currentUserId, recipient_id: selectedId, body })
      .select()
      .single();

    if (data) {
      setMessages((prev) =>
        prev.map((m) => (m.id === optimistic.id ? (data as MessageRow) : m))
      );
      setConversations((prev) => {
        const existing = prev.find((c) => c.partnerId === selectedId);
        if (existing) {
          return prev.map((c) =>
            c.partnerId === selectedId
              ? { ...c, lastMessage: body, lastAt: optimistic.created_at }
              : c
          );
        }
        // New conversation (first message sent)
        const patient = patients.find((p) => p.profileId === selectedId);
        return [
          {
            partnerId: selectedId,
            partnerName: patient?.name ?? "Patient",
            lastMessage: body,
            lastAt: optimistic.created_at,
            unread: 0,
          },
          ...prev,
        ];
      });
    }

    setSending(false);
  }

  function openCompose(profileId: string, name: string) {
    setComposeOpen(false);
    setComposeSearch("");
    // If conversation already exists, just open it
    const existing = conversations.find((c) => c.partnerId === profileId);
    if (!existing) {
      // Add a placeholder so the thread header shows the name
      setConversations((prev) => {
        if (prev.find((c) => c.partnerId === profileId)) return prev;
        return [
          {
            partnerId: profileId,
            partnerName: name,
            lastMessage: "",
            lastAt: new Date().toISOString(),
            unread: 0,
          },
          ...prev,
        ];
      });
    }
    setSelectedId(profileId);
  }

  // Filtered patients for compose search
  const filteredPatients = patients.filter((p) =>
    p.name.toLowerCase().includes(composeSearch.toLowerCase())
  );

  // Group messages by date
  const grouped: { date: string; msgs: MessageRow[] }[] = [];
  for (const msg of messages) {
    const label = formatDate(msg.created_at);
    const last = grouped[grouped.length - 1];
    if (last && last.date === label) {
      last.msgs.push(msg);
    } else {
      grouped.push({ date: label, msgs: [msg] });
    }
  }

  const selectedConv = conversations.find((c) => c.partnerId === selectedId);

  // ── Mobile: show thread full-screen when a conversation is selected
  const threadOpen = !!selectedId;

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── Conversation list ──────────────────────────────────────────── */}
      <div
        className={cn(
          "flex flex-col w-full lg:w-80 lg:flex-shrink-0 border-r border-nesema-t1/10",
          threadOpen && "hidden lg:flex"
        )}
      >
        <div className="px-5 py-4 border-b border-nesema-t1/10 flex items-center justify-between">
          <h1 className="font-serif text-2xl text-nesema-t1">Messages</h1>
          {patients.length > 0 && (
            <button
              onClick={() => { setComposeOpen(true); setComposeSearch(""); }}
              title="New message"
              className="w-8 h-8 rounded-full bg-[#2E2620] text-white flex items-center justify-center hover:bg-[#4E3D30] transition-colors"
            >
              <SquarePen size={14} />
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-nesema-t1/5">
          {conversations.length === 0 && (
            <div className="p-6 text-center text-nesema-t3 text-sm">
              {patients.length > 0
                ? "No conversations yet. Click the compose button to start one."
                : "No conversations yet."}
            </div>
          )}
          {conversations
            .filter((c) => c.lastMessage !== "" || c.partnerId === selectedId)
            .map((conv) => (
            <button
              key={conv.partnerId}
              onClick={() => setSelectedId(conv.partnerId)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-nesema-t1/5",
                selectedId === conv.partnerId && "bg-nesema-sage/10"
              )}
            >
              {/* Avatar */}
              <div className="w-10 h-10 rounded-full bg-nesema-sage/20 flex items-center justify-center flex-shrink-0">
                <span className="text-sm font-semibold text-nesema-sage">
                  {initials(conv.partnerName)}
                </span>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-nesema-t1 truncate">
                    {conv.partnerName}
                  </span>
                  {conv.lastMessage && (
                    <span className="text-[11px] text-nesema-t3 ml-2 flex-shrink-0">
                      {formatDate(conv.lastAt) === "Today"
                        ? formatTime(conv.lastAt)
                        : formatDate(conv.lastAt)}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between mt-0.5">
                  <span className="text-xs text-nesema-t3 truncate">
                    {conv.lastMessage || "New conversation — say hello!"}
                  </span>
                  {conv.unread > 0 && (
                    <span className="ml-2 flex-shrink-0 w-5 h-5 rounded-full bg-nesema-sage flex items-center justify-center text-[10px] font-bold text-white">
                      {conv.unread > 9 ? "9+" : conv.unread}
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ── Thread ─────────────────────────────────────────────────────── */}
      <div
        className={cn(
          "flex-1 flex flex-col",
          !threadOpen && "hidden lg:flex"
        )}
      >
        {!selectedId ? (
          <div className="flex-1 flex flex-col items-center justify-center text-nesema-t3 gap-2">
            <span className="text-4xl">✉️</span>
            <p className="text-sm">Select a conversation to start messaging</p>
            {patients.length > 0 && (
              <button
                onClick={() => { setComposeOpen(true); setComposeSearch(""); }}
                className="mt-2 px-4 py-2 bg-[#2E2620] text-white text-xs font-medium rounded-full hover:bg-[#4E3D30] transition-colors"
              >
                New message
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Thread header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-nesema-t1/10 bg-nesema-bg">
              <button
                className="lg:hidden p-2 -ml-2 text-nesema-t2"
                onClick={() => setSelectedId(null)}
              >
                <ArrowLeft size={20} />
              </button>
              <div className="w-8 h-8 rounded-full bg-nesema-sage/20 flex items-center justify-center">
                <span className="text-xs font-semibold text-nesema-sage">
                  {selectedConv ? initials(selectedConv.partnerName) : "?"}
                </span>
              </div>
              <span className="font-medium text-nesema-t1">
                {selectedConv?.partnerName ?? ""}
              </span>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-nesema-t3 gap-2 py-16">
                  <span className="text-3xl">👋</span>
                  <p className="text-sm">Send a message to start the conversation</p>
                </div>
              )}
              {grouped.map(({ date, msgs }) => (
                <div key={date}>
                  {/* Date label */}
                  <div className="flex items-center gap-3 my-3">
                    <div className="flex-1 h-px bg-nesema-t1/10" />
                    <span className="text-[11px] text-nesema-t3">{date}</span>
                    <div className="flex-1 h-px bg-nesema-t1/10" />
                  </div>

                  <div className="space-y-2">
                    {msgs.map((msg) => {
                      const isMine = msg.sender_id === currentUserId;
                      return (
                        <div
                          key={msg.id}
                          className={cn(
                            "flex",
                            isMine ? "justify-end" : "justify-start"
                          )}
                        >
                          <div
                            className={cn(
                              "max-w-[75%] rounded-2xl px-4 py-2.5 text-sm",
                              isMine
                                ? "bg-nesema-sage text-white rounded-br-sm"
                                : "bg-nesema-t1/8 text-nesema-t1 rounded-bl-sm"
                            )}
                            style={
                              !isMine
                                ? { backgroundColor: "rgba(42,33,24,0.08)" }
                                : undefined
                            }
                          >
                            <p className="leading-relaxed">{msg.body}</p>
                            <p
                              className={cn(
                                "text-[10px] mt-1 text-right",
                                isMine
                                  ? "text-white/70"
                                  : "text-nesema-t3"
                              )}
                            >
                              {formatTime(msg.created_at)}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="px-4 py-3 border-t border-nesema-t1/10 bg-nesema-bg">
              <div className="flex items-end gap-2">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                  placeholder="Type a message…"
                  rows={1}
                  className="flex-1 resize-none rounded-xl border border-nesema-t1/15 bg-white/60 px-4 py-2.5 text-sm text-nesema-t1 placeholder:text-nesema-t3 focus:outline-none focus:ring-2 focus:ring-nesema-sage/30 max-h-32 overflow-y-auto"
                />
                <button
                  onClick={sendMessage}
                  disabled={!input.trim() || sending}
                  className="w-10 h-10 rounded-full bg-nesema-sage flex items-center justify-center text-white flex-shrink-0 disabled:opacity-40 transition-opacity"
                >
                  <Send size={16} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Compose modal ──────────────────────────────────────────────── */}
      {composeOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" onClick={() => setComposeOpen(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div
            className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#E6E0D8]">
              <h2 className="font-semibold text-[#1E1A16]">New Message</h2>
              <button onClick={() => setComposeOpen(false)} className="text-[#9C9087] hover:text-[#1E1A16] transition-colors">
                <X size={18} />
              </button>
            </div>

            {/* Search */}
            <div className="px-4 pt-3 pb-2">
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9C9087]" />
                <input
                  value={composeSearch}
                  onChange={(e) => setComposeSearch(e.target.value)}
                  placeholder="Search patients…"
                  autoFocus
                  className="w-full pl-8 pr-3 py-2 text-sm rounded-xl border border-[#E6E0D8] bg-[#F9F7F4] focus:outline-none focus:ring-2 focus:ring-[#4E7A5F]/25"
                />
              </div>
            </div>

            <div className="max-h-64 overflow-y-auto divide-y divide-[#E6E0D8]/60 pb-2">
              {filteredPatients.length === 0 ? (
                <p className="px-5 py-6 text-sm text-center text-[#9C9087]">No patients found</p>
              ) : (
                filteredPatients.map((p) => (
                  <button
                    key={p.profileId}
                    onClick={() => openCompose(p.profileId, p.name)}
                    className="w-full flex items-center gap-3 px-5 py-3 hover:bg-[#EBF2EE] transition-colors text-left"
                  >
                    <div className="w-8 h-8 rounded-full bg-[#4E7A5F]/20 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-semibold text-[#4E7A5F]">{initials(p.name)}</span>
                    </div>
                    <span className="text-sm font-medium text-[#1E1A16]">{p.name}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
