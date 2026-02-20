import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createRoom } from "@/lib/daily";

export async function POST(req: NextRequest) {
  if (!process.env.DAILY_API_KEY) {
    return NextResponse.json(
      { error: "DAILY_API_KEY not configured" },
      { status: 503 }
    );
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { appointmentId } = await req.json();
  if (!appointmentId) {
    return NextResponse.json(
      { error: "appointmentId required" },
      { status: 400 }
    );
  }

  // Fetch appointment
  const { data: appt } = (await supabase
    .from("appointments")
    .select("id, daily_room_url, practitioner_id, patient_id")
    .eq("id", appointmentId)
    .single()) as {
    data: {
      id: string;
      daily_room_url: string | null;
      practitioner_id: string;
      patient_id: string;
    } | null;
    error: unknown;
  };

  if (!appt) {
    return NextResponse.json({ error: "Appointment not found" }, { status: 404 });
  }

  // Verify user is practitioner or patient for this appointment
  const { data: prac } = (await supabase
    .from("practitioners")
    .select("id")
    .eq("profile_id", user.id)
    .single()) as { data: { id: string } | null; error: unknown };

  const { data: patient } = (await supabase
    .from("patients")
    .select("id")
    .eq("profile_id", user.id)
    .single()) as { data: { id: string } | null; error: unknown };

  const isPractitioner = prac && appt.practitioner_id === prac.id;
  const isPatient = patient && appt.patient_id === patient.id;

  if (!isPractitioner && !isPatient) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Return existing room URL if already created
  if (appt.daily_room_url) {
    return NextResponse.json({ url: appt.daily_room_url });
  }

  // Create new Daily room
  const roomName = `nesema-${appointmentId}`;
  const room = await createRoom(roomName);

  if (!room.url) {
    return NextResponse.json(
      { error: "Failed to create video room" },
      { status: 500 }
    );
  }

  // Save room URL to appointment
  await supabase
    .from("appointments")
    .update({ daily_room_url: room.url })
    .eq("id", appointmentId);

  return NextResponse.json({ url: room.url });
}
