import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { CalendarDays, Video, MapPin, Clock } from "lucide-react";

type Appt = {
  id: string;
  scheduled_at: string;
  duration_mins: number;
  appointment_type: "initial" | "followup" | "review";
  status: "scheduled" | "completed" | "cancelled" | "no_show";
  location_type: "virtual" | "in_person";
  daily_room_url: string | null;
};

const TYPE_LABEL: Record<string, string> = {
  initial: "Initial Consultation",
  followup: "Follow-up",
  review: "Review",
};

const STATUS_STYLES: Record<string, string> = {
  scheduled: "bg-blue-50 text-blue-700",
  completed: "bg-green-50 text-green-700",
  cancelled: "bg-red-50 text-red-700",
  no_show: "bg-amber-50 text-amber-700",
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isWithin15(iso: string) {
  const diff = new Date(iso).getTime() - Date.now();
  return diff >= -60_000 && diff <= 15 * 60_000;
}

export default async function AppointmentsPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: patient } = (await supabase
    .from("patients")
    .select("id")
    .eq("profile_id", user.id)
    .single()) as { data: { id: string } | null; error: unknown };

  if (!patient) redirect("/onboarding/patient");

  const { data: appts } = (await supabase
    .from("appointments")
    .select(
      "id, scheduled_at, duration_mins, appointment_type, status, location_type, daily_room_url"
    )
    .eq("patient_id", patient.id)
    .order("scheduled_at", { ascending: false })) as {
    data: Appt[] | null;
    error: unknown;
  };

  const now = new Date().toISOString();
  const all = appts ?? [];
  const upcoming = all.filter(
    (a) => a.scheduled_at > now && a.status === "scheduled"
  );
  const past = all.filter(
    (a) => a.scheduled_at <= now || a.status !== "scheduled"
  );

  function ApptCard({ a, dim }: { a: Appt; dim?: boolean }) {
    return (
      <div
        className={`rounded-2xl bg-white border border-nesema-sage/20 p-4 flex items-start gap-4 ${dim ? "opacity-75" : ""}`}
      >
        <div className="w-10 h-10 rounded-full bg-nesema-sage/10 flex items-center justify-center shrink-0">
          <CalendarDays
            className={dim ? "text-nesema-t3" : "text-nesema-sage"}
            size={18}
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-nesema-t1 text-sm">
              {TYPE_LABEL[a.appointment_type] ?? a.appointment_type}
            </span>
            <span
              className={`text-[11px] px-2 py-0.5 rounded-full capitalize ${STATUS_STYLES[a.status]}`}
            >
              {a.status.replace("_", " ")}
            </span>
          </div>
          <p className="text-sm text-nesema-t3 mt-0.5">
            {fmtDate(a.scheduled_at)} · {fmtTime(a.scheduled_at)}
          </p>
          <div className="flex items-center gap-3 mt-1 text-xs text-nesema-t3">
            <span className="flex items-center gap-1">
              <Clock size={12} />
              {a.duration_mins} min
            </span>
            <span className="flex items-center gap-1">
              {a.location_type === "virtual" ? (
                <Video size={12} />
              ) : (
                <MapPin size={12} />
              )}
              {a.location_type === "virtual" ? "Virtual" : "In person"}
            </span>
          </div>
          {a.location_type === "virtual" &&
            a.daily_room_url &&
            isWithin15(a.scheduled_at) && (
              <a
                href={a.daily_room_url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1.5 text-xs bg-nesema-bark text-white px-3 py-1.5 rounded-full"
              >
                <Video size={12} /> Join session
              </a>
            )}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto">
      <h1 className="font-serif text-3xl text-nesema-t1 mb-6">Appointments</h1>

      {/* Upcoming */}
      <section className="mb-10">
        <h2 className="text-xs font-semibold tracking-widest text-nesema-t3 uppercase mb-4">
          Upcoming
        </h2>
        {upcoming.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-nesema-sage/40 p-8 text-center">
            <CalendarDays
              className="mx-auto mb-3 text-nesema-sage/50"
              size={32}
            />
            <p className="text-nesema-t3 text-sm">No upcoming appointments.</p>
            <Link
              href="/book"
              className="mt-3 inline-block text-sm text-nesema-bark underline underline-offset-2"
            >
              Book a session
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {upcoming.map((a) => (
              <ApptCard key={a.id} a={a} />
            ))}
          </div>
        )}
      </section>

      {/* Past */}
      <section>
        <h2 className="text-xs font-semibold tracking-widest text-nesema-t3 uppercase mb-4">
          Past
        </h2>
        {past.length === 0 ? (
          <p className="text-nesema-t3 text-sm">No past appointments yet.</p>
        ) : (
          <div className="space-y-3">
            {past.map((a) => (
              <ApptCard key={a.id} a={a} dim />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
