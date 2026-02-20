import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Users, MessageSquare, CalendarDays } from "lucide-react";

type PracInfo = {
  profile_id: string;
  practice_name: string | null;
  discipline: string | null;
  bio: string | null;
  booking_slug: string | null;
};

type ProfInfo = {
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  email: string | null;
};

export default async function TeamPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: patient } = (await supabase
    .from("patients")
    .select("id, practitioner_id")
    .eq("profile_id", user.id)
    .single()) as {
    data: { id: string; practitioner_id: string | null } | null;
    error: unknown;
  };

  if (!patient) redirect("/onboarding/patient");

  let prac: PracInfo | null = null;
  let prof: ProfInfo | null = null;

  if (patient.practitioner_id) {
    const { data: p } = (await supabase
      .from("practitioners")
      .select("profile_id, practice_name, discipline, bio, booking_slug")
      .eq("id", patient.practitioner_id)
      .single()) as { data: PracInfo | null; error: unknown };

    prac = p;

    if (prac) {
      const { data: pr } = (await supabase
        .from("profiles")
        .select("first_name, last_name, avatar_url, email")
        .eq("id", prac.profile_id)
        .single()) as { data: ProfInfo | null; error: unknown };

      prof = pr;
    }
  }

  const fullName =
    [prof?.first_name, prof?.last_name].filter(Boolean).join(" ") ||
    "Your Practitioner";
  const initials = `${prof?.first_name?.[0] ?? ""}${prof?.last_name?.[0] ?? ""}`.toUpperCase() || "P";

  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto">
      <h1 className="font-serif text-3xl text-nesema-t1 mb-6">Care Team</h1>

      {!prac ? (
        <div className="rounded-2xl border border-dashed border-nesema-sage/40 p-10 text-center">
          <Users className="mx-auto mb-3 text-nesema-sage/50" size={36} />
          <p className="text-nesema-t1 font-medium mb-1">
            No practitioner assigned yet
          </p>
          <p className="text-nesema-t3 text-sm max-w-sm mx-auto">
            Once a practitioner accepts you as a patient, they will appear
            here.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl bg-white border border-nesema-sage/20 p-6">
          <div className="flex items-center gap-4 mb-6">
            {prof?.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={prof.avatar_url}
                alt={fullName}
                className="w-16 h-16 rounded-full object-cover"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-nesema-sage/20 flex items-center justify-center text-xl font-semibold text-nesema-bark">
                {initials}
              </div>
            )}
            <div>
              <p className="font-semibold text-nesema-t1 text-lg">{fullName}</p>
              {prac.discipline && (
                <p className="text-sm text-nesema-t3">{prac.discipline}</p>
              )}
              {prac.practice_name && (
                <p className="text-xs text-nesema-t3">{prac.practice_name}</p>
              )}
            </div>
          </div>

          {prac.bio && (
            <p className="text-sm text-nesema-t2 mb-6 leading-relaxed">
              {prac.bio}
            </p>
          )}

          <div className="flex flex-wrap gap-3">
            <Link
              href="/patient/messages"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-nesema-bark text-white text-sm rounded-full font-medium"
            >
              <MessageSquare size={15} /> Send message
            </Link>
            {prac.booking_slug && (
              <Link
                href={`/book/${prac.booking_slug}`}
                className="inline-flex items-center gap-2 px-4 py-2.5 border border-nesema-sage/40 text-nesema-bark text-sm rounded-full font-medium"
              >
                <CalendarDays size={15} /> Book appointment
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
