import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { MessagesUI } from "@/components/shared/MessagesUI";
import type { ConversationSummary, PatientContact } from "@/components/shared/MessagesUI";

export default async function PractitionerMessagesPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Fetch all messages involving this user
  const { data: msgs } = await supabase
    .from("messages")
    .select("id, sender_id, recipient_id, body, read_at, created_at")
    .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
    .order("created_at", { ascending: false });

  const messages = msgs ?? [];

  // Build a map: partnerId → latest message + unread count
  const convMap = new Map<
    string,
    {
      lastMessage: string;
      lastAt: string;
      unread: number;
    }
  >();

  for (const msg of messages) {
    const partnerId =
      msg.sender_id === user.id ? msg.recipient_id : msg.sender_id;

    if (!convMap.has(partnerId)) {
      convMap.set(partnerId, {
        lastMessage: msg.body,
        lastAt: msg.created_at,
        unread: 0,
      });
    }

    if (msg.recipient_id === user.id && !msg.read_at) {
      convMap.get(partnerId)!.unread += 1;
    }
  }

  // Fetch partner profiles
  const partnerIds = Array.from(convMap.keys());

  const conversations: ConversationSummary[] = [];

  if (partnerIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, first_name, last_name")
      .in("id", partnerIds);

    const profileMap = new Map(
      (profiles ?? []).map((p) => [p.id, p])
    );

    for (const [partnerId, conv] of Array.from(convMap.entries())) {
      const profile = profileMap.get(partnerId);
      const name = profile
        ? [profile.first_name, profile.last_name].filter(Boolean).join(" ")
        : "Unknown";

      conversations.push({
        partnerId,
        partnerName: name || "Unknown",
        lastMessage: conv.lastMessage,
        lastAt: conv.lastAt,
        unread: conv.unread,
      });
    }
  }

  // Fetch this practitioner's patients (for compose modal)
  const patients: PatientContact[] = [];

  const { data: prac } = (await supabase
    .from("practitioners")
    .select("id")
    .eq("profile_id", user.id)
    .single()) as { data: { id: string } | null; error: unknown };

  if (prac) {
    const { data: pts } = (await supabase
      .from("patients")
      .select("id, profile_id")
      .eq("practitioner_id", prac.id)) as {
      data: { id: string; profile_id: string }[] | null; error: unknown;
    };

    const allPts = pts ?? [];
    const profileIds = allPts.map((p) => p.profile_id);

    if (profileIds.length > 0) {
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

      for (const pt of allPts) {
        patients.push({
          profileId: pt.profile_id,
          name: pMap[pt.profile_id] ?? "Patient",
        });
      }
    }
  }

  return (
    <div className="h-full flex flex-col">
      <MessagesUI
        currentUserId={user.id}
        initialConversations={conversations}
        patients={patients}
      />
    </div>
  );
}
