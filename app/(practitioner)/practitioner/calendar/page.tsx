import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { CalendarDays, Video, MapPin } from "lucide-react";

type RawAppt = {
  id: string;
  scheduled_at: string;
  duration_mins: number;
  appointment_type: "initial" | "followup" | "review";
  status: "scheduled" | "completed" | "cancelled" | "no_show";
  location_type: "virtual" | "in_person";
  daily_room_url: string | null;
  patient_id: string;
};

const TYPE_LABEL: Record<string, string> = {
  initial: "Initial",
  followup: "Follow-up",
  review: "Review",
};

const STATUS_STYLES: Record<string, string> = {
  scheduled: "bg-blue-50 text-blue-700",
  completed: "bg-green-50 text-green-700",
  cancelled: "bg-red-50 text-red-700",
  no_show: "bg-amber-50 text-amber-700",
};

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

function dayKey(iso: string) {
  return iso.slice(0, 10);
}

function fmtDayHeading(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00");
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  if (dateStr === today) return "Today";
  if (dateStr === tomorrow) return "Tomorrow";
  return d.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export default async function CalendarPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: prac } = (await supabase
    .from("practitioners")
    .select("id")
    .eq("profile_id", user.id)
    .single()) as { data: { id: string } | null; error: unknown };

  if (!prac) redirect("/onboarding/practitioner");

  const from = new Date(Date.now() - 7 * 86400000).toISOString();
  const to = new Date(Date.now() + 28 * 86400000).toISOString();

  const { data: raw } = (await supabase
    .from("appointments")
    .select(
      "id, scheduled_at, duration_mins, appointment_type, status, location_type, daily_room_url, patient_id"
    )
    .eq("practitioner_id", prac.id)
    .gte("scheduled_at", from)
    .lte("scheduled_at", to)
    .order("scheduled_at", { ascending: true })) as {
    data: RawAppt[] | null;
    error: unknown;
  };

  const appts = raw ?? [];

  // Fetch patient names in bulk
  const patientIds = Array.from(new Set(appts.map((a) => a.patient_id)));
  const patientNames: Record<string, string> = {};

  if (patientIds.length > 0) {
    const { data: patients } = (await supabase
      .from("patients")
      .select("id, profile_id")
      .in("id", patientIds)) as {
      data: { id: string; profile_id: string }[] | null;
      error: unknown;
    };

    const profileIds = (patients ?? []).map((p) => p.profile_id);
    if (profileIds.length > 0) {
      const { data: profiles } = (await supabase
        .from("profiles")
        .select("id, first_name, last_name")
        .in("id", profileIds)) as {
        data: {
          id: string;
          first_name: string | null;
          last_name: string | null;
        }[] | null;
        error: unknown;
      };

      const profileMap: Record<string, string> = {};
      for (const pr of profiles ?? []) {
        profileMap[pr.id] =
          [pr.first_name, pr.last_name].filter(Boolean).join(" ") || "Patient";
      }
      for (const pt of patients ?? []) {
        patientNames[pt.id] = profileMap[pt.profile_id] ?? "Patient";
      }
    }
  }

  // Group by day
  const grouped: Record<string, RawAppt[]> = {};
  for (const a of appts) {
    const d = dayKey(a.scheduled_at);
    if (!grouped[d]) grouped[d] = [];
    grouped[d].push(a);
  }
  const days = Object.keys(grouped).sort();

  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto">
      <h1 className="font-serif text-3xl text-nesema-t1 mb-6">Calendar</h1>

      {days.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-nesema-sage/40 p-10 text-center">
          <CalendarDays
            className="mx-auto mb-3 text-nesema-sage/50"
            size={36}
          />
          <p className="text-nesema-t1 font-medium mb-1">No appointments</p>
          <p className="text-nesema-t3 text-sm">
            No appointments scheduled for the next four weeks.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {days.map((day) => (
            <section key={day}>
              <h2 className="text-xs font-semibold tracking-widest text-nesema-t3 uppercase mb-3">
                {fmtDayHeading(day)}
              </h2>
              <div className="space-y-2">
                {grouped[day].map((a) => (
                  <div
                    key={a.id}
                    className="rounded-2xl bg-white border border-nesema-sage/20 p-4 flex items-start gap-4"
                  >
                    <div className="w-14 text-center shrink-0">
                      <p className="text-sm font-semibold text-nesema-t1">
                        {fmtTime(a.scheduled_at)}
                      </p>
                      <p className="text-[11px] text-nesema-t3">
                        {a.duration_mins}m
                      </p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm text-nesema-t1">
                          {patientNames[a.patient_id] ?? "Patient"}
                        </span>
                        <span className="text-xs text-nesema-t3">
                          · {TYPE_LABEL[a.appointment_type]}
                        </span>
                        <span
                          className={`text-[11px] px-2 py-0.5 rounded-full capitalize ${STATUS_STYLES[a.status]}`}
                        >
                          {a.status.replace("_", " ")}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-xs text-nesema-t3">
                        {a.location_type === "virtual" ? (
                          <span className="flex items-center gap-1">
                            <Video size={11} /> Virtual
                          </span>
                        ) : (
                          <span className="flex items-center gap-1">
                            <MapPin size={11} /> In person
                          </span>
                        )}
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
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
