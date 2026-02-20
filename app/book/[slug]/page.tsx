import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import type { Database } from "@/types/database";
import { BookingClient } from "@/components/booking/BookingClient";

type AvailabilityRow = Database["public"]["Tables"]["availability"]["Row"];

type Props = { params: { slug: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const supabase = createClient();
  const { data: prac } = await supabase
    .from("practitioners")
    .select("practice_name, discipline, bio, booking_slug, profile_id")
    .eq("booking_slug", params.slug)
    .eq("is_live", true)
    .single();

  if (!prac) {
    return { title: "Book a session — Nesema" };
  }

  let avatarUrl: string | undefined;
  if (prac.profile_id) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("first_name, last_name, avatar_url")
      .eq("id", prac.profile_id)
      .single();
    avatarUrl = profile?.avatar_url ?? undefined;
  }

  const name = prac.practice_name ?? "Practitioner";
  const description = prac.bio
    ? prac.bio.slice(0, 160)
    : `Book a session with ${name} on Nesema — holistic health platform.`;
  const canonicalUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "https://nesema.com"}/book/${params.slug}`;

  return {
    title: `${name} — Book a session on Nesema`,
    description,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      title: `${name} — Book a session on Nesema`,
      description,
      url: canonicalUrl,
      images: avatarUrl ? [{ url: avatarUrl }] : [{ url: "/og-image.svg" }],
    },
  };
}

export default async function BookingPage({ params }: Props) {
  const supabase = createClient();

  const { data: prac } = await supabase
    .from("practitioners")
    .select(
      "id, profile_id, practice_name, discipline, bio, registration_body, registration_number, session_length_mins, buffer_mins, initial_fee, followup_fee, cancellation_hours, booking_slug, allows_self_booking"
    )
    .eq("booking_slug", params.slug)
    .eq("is_live", true)
    .single();

  if (!prac) notFound();

  // Fetch profile for person schema
  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, last_name, avatar_url")
    .eq("id", prac.profile_id)
    .single();

  const { data: availabilityRaw } = await supabase
    .from("availability")
    .select("*")
    .eq("practitioner_id", prac.id)
    .eq("is_active", true);

  const availability = (availabilityRaw ?? []) as AvailabilityRow[];

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

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://nesema.com";
  const canonicalUrl = `${appUrl}/book/${params.slug}`;

  // JSON-LD Person schema
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: prac.practice_name ?? `${profile?.first_name ?? ""} ${profile?.last_name ?? ""}`.trim(),
    description: prac.bio ?? undefined,
    jobTitle: prac.discipline ?? undefined,
    image: profile?.avatar_url ?? undefined,
    url: canonicalUrl,
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name: "Health sessions",
      itemListElement: [
        {
          "@type": "Offer",
          name: "Initial consultation",
          price: prac.initial_fee ? (prac.initial_fee / 100).toFixed(2) : undefined,
          priceCurrency: "GBP",
        },
        {
          "@type": "Offer",
          name: "Follow-up session",
          price: prac.followup_fee ? (prac.followup_fee / 100).toFixed(2) : undefined,
          priceCurrency: "GBP",
        },
      ],
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <BookingClient
        practitioner={prac}
        availability={availability}
        bookedSlots={bookedSlots}
      />
    </>
  );
}
