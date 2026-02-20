import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import type { Database } from "@/types/database";
import { BookingClient } from "@/components/booking/BookingClient";

type AvailabilityRow = Database["public"]["Tables"]["availability"]["Row"];

export default async function BookingPage({
  params,
}: {
  params: { slug: string };
}) {
  const supabase = createClient();

  // Fetch practitioner by slug — public route, no auth required
  const { data: prac } = await supabase
    .from("practitioners")
    .select(
      "id, profile_id, practice_name, discipline, bio, registration_body, registration_number, session_length_mins, buffer_mins, initial_fee, followup_fee, cancellation_hours, booking_slug, allows_self_booking"
    )
    .eq("booking_slug", params.slug)
    .eq("is_live", true)
    .single();

  if (!prac) notFound();

  // Fetch active availability
  const { data: availabilityRaw } = await supabase
    .from("availability")
    .select("*")
    .eq("practitioner_id", prac.id)
    .eq("is_active", true);

  const availability = (availabilityRaw ?? []) as AvailabilityRow[];

  // Fetch booked slots for next 28 days
  const from = new Date().toISOString();
  const to = new Date(Date.now() + 28 * 86400000).toISOString();

  const { data: bookedRaw } = await supabase
    .from("appointments")
    .select("scheduled_at, duration_mins")
    .eq("practitioner_id", prac.id)
    .in("status", ["scheduled"])
    .gte("scheduled_at", from)
    .lte("scheduled_at", to);

  const bookedSlots = (bookedRaw ?? []).map((b) => ({
    scheduled_at: b.scheduled_at,
    duration_mins: b.duration_mins,
  }));

  return (
    <BookingClient
      practitioner={prac}
      availability={availability}
      bookedSlots={bookedSlots}
    />
  );
}
