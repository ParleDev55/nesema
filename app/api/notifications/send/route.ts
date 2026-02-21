import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

interface SendBody {
  target: "all" | string; // "all" or a patient UUID from patients table
  title: string;
  body?: string;
  type?: string;
  link?: string;
}

export async function POST(request: NextRequest) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  let payload: SendBody;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { target, title, body, type = "general", link } = payload;

  if (!title?.trim()) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }

  // Verify sender is a practitioner
  const { data: prac } = (await supabase
    .from("practitioners")
    .select("id")
    .eq("profile_id", user.id)
    .single()) as { data: { id: string } | null; error: unknown };

  if (!prac) {
    return NextResponse.json({ error: "Practitioner record not found" }, { status: 403 });
  }

  // Resolve recipient profile IDs
  let recipientProfileIds: string[] = [];

  if (target === "all") {
    // All patients for this practitioner
    const { data: pts } = (await supabase
      .from("patients")
      .select("profile_id")
      .eq("practitioner_id", prac.id)) as {
      data: { profile_id: string }[] | null; error: unknown;
    };
    recipientProfileIds = (pts ?? []).map((p) => p.profile_id);
  } else {
    // Specific patient — target is the patient UUID
    const { data: pt } = (await supabase
      .from("patients")
      .select("profile_id")
      .eq("id", target)
      .eq("practitioner_id", prac.id)
      .single()) as { data: { profile_id: string } | null; error: unknown };

    if (!pt) {
      return NextResponse.json({ error: "Patient not found" }, { status: 404 });
    }
    recipientProfileIds = [pt.profile_id];
  }

  if (recipientProfileIds.length === 0) {
    return NextResponse.json({ error: "No recipients found" }, { status: 400 });
  }

  // Insert one notification row per recipient
  const rows = recipientProfileIds.map((profileId) => ({
    user_id: profileId,
    type,
    title: title.trim(),
    body: body?.trim() || null,
    link: link || null,
    read: false,
  }));

  const { error: insertErr } = await supabase.from("notifications").insert(rows);

  if (insertErr) {
    return NextResponse.json({ error: "Failed to send notifications" }, { status: 500 });
  }

  return NextResponse.json({ sent: recipientProfileIds.length });
}
