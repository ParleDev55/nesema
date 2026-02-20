"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Video,
  MapPin,
  Plus,
  X,
  CalendarDays,
} from "lucide-react";

type Appt = {
  id: string;
  scheduled_at: string;
  duration_mins: number;
  appointment_type: "initial" | "followup" | "review";
  status: "scheduled" | "completed" | "cancelled" | "no_show";
  location_type: "virtual" | "in_person";
  daily_room_url: string | null;
  patient_id: string;
  patient_name?: string;
};

type Patient = { id: string; name: string };

const TYPE_COLOR: Record<string, string> = {
  initial: "bg-nesema-sage",
  followup: "bg-[#C4885A]",
  review: "bg-[#7E9DB7]",
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
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const HOURS = Array.from({ length: 13 }, (_, i) => i + 8); // 8–20

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}
function dayKey(iso: string) {
  return iso.slice(0, 10);
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
function mondayOf(d: Date): Date {
  const day = d.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day;
  const m = new Date(d);
  m.setDate(d.getDate() + diff);
  m.setHours(0, 0, 0, 0);
  return m;
}
function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

// Build 6-week grid for a given month (year/month 0-indexed)
function buildMonthGrid(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  const start = mondayOf(first);
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

export default function CalendarPage() {
  const router = useRouter();
  const supabase = createClient();

  const [appts, setAppts] = useState<Appt[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);

  const today = useMemo(() => new Date(), []);
  const [viewMode, setViewMode] = useState<"month" | "week">("month");
  const [currentMonth, setCurrentMonth] = useState(
    new Date(today.getFullYear(), today.getMonth(), 1)
  );
  const [weekStart, setWeekStart] = useState(mondayOf(today));
  const [selectedDay, setSelectedDay] = useState<string>(isoDate(today));

  // Add appointment modal
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    patient_id: "",
    appointment_type: "initial" as "initial" | "followup" | "review",
    scheduled_at: "",
    duration_mins: 60,
    location_type: "virtual" as "virtual" | "in_person",
  });
  const [saving, setSaving] = useState(false);

  // Load data
  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) { router.push("/sign-in"); return; }

      const { data: prac } = (await supabase
        .from("practitioners")
        .select("id")
        .eq("profile_id", user.id)
        .single()) as { data: { id: string } | null; error: unknown };
      if (!prac) { router.push("/onboarding/practitioner"); return; }

      const from = new Date(Date.now() - 60 * 86400000).toISOString();
      const to = new Date(Date.now() + 90 * 86400000).toISOString();

      const { data: raw } = (await supabase
        .from("appointments")
        .select(
          "id, scheduled_at, duration_mins, appointment_type, status, location_type, daily_room_url, patient_id"
        )
        .eq("practitioner_id", prac.id)
        .gte("scheduled_at", from)
        .lte("scheduled_at", to)
        .order("scheduled_at", { ascending: true })) as {
        data: Appt[] | null;
        error: unknown;
      };

      const rawAppts = raw ?? [];

      // Fetch patient names
      const patientIds = Array.from(new Set(rawAppts.map((a) => a.patient_id)));
      const nameMap: Record<string, string> = {};
      if (patientIds.length > 0) {
        const { data: pts } = (await supabase
          .from("patients")
          .select("id, profile_id")
          .in("id", patientIds)) as {
          data: { id: string; profile_id: string }[] | null;
          error: unknown;
        };
        const profileIds = (pts ?? []).map((p) => p.profile_id);
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
          const pm: Record<string, string> = {};
          for (const pr of profiles ?? []) {
            pm[pr.id] =
              [pr.first_name, pr.last_name].filter(Boolean).join(" ") ||
              "Patient";
          }
          for (const pt of pts ?? []) {
            nameMap[pt.id] = pm[pt.profile_id] ?? "Patient";
          }
        }
      }

      setAppts(
        rawAppts.map((a) => ({ ...a, patient_name: nameMap[a.patient_id] ?? "Patient" }))
      );

      // Load patients for modal
      const { data: myPts } = (await supabase
        .from("patients")
        .select("id, profile_id")
        .eq("practitioner_id", prac.id)) as {
        data: { id: string; profile_id: string }[] | null;
        error: unknown;
      };
      const myProfileIds = (myPts ?? []).map((p) => p.profile_id);
      if (myProfileIds.length > 0) {
        const { data: profs } = (await supabase
          .from("profiles")
          .select("id, first_name, last_name")
          .in("id", myProfileIds)) as {
          data: { id: string; first_name: string | null; last_name: string | null }[] | null;
          error: unknown;
        };
        const pfMap: Record<string, string> = {};
        for (const pr of profs ?? []) {
          pfMap[pr.id] =
            [pr.first_name, pr.last_name].filter(Boolean).join(" ") || "Patient";
        }
        setPatients(
          (myPts ?? []).map((p) => ({
            id: p.id,
            name: pfMap[p.profile_id] ?? "Patient",
          }))
        );
      }

      setLoading(false);
    }
    load();
  }, []);

  const apptsByDay = useMemo(() => {
    const m: Record<string, Appt[]> = {};
    for (const a of appts) {
      const k = dayKey(a.scheduled_at);
      if (!m[k]) m[k] = [];
      m[k].push(a);
    }
    return m;
  }, [appts]);

  const selectedDayAppts = useMemo(
    () => apptsByDay[selectedDay] ?? [],
    [apptsByDay, selectedDay]
  );

  // Month navigation
  const prevMonth = () =>
    setCurrentMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1));
  const nextMonth = () =>
    setCurrentMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1));

  // Week navigation
  const prevWeek = () => setWeekStart((w) => addDays(w, -7));
  const nextWeek = () => setWeekStart((w) => addDays(w, 7));

  const monthGrid = useMemo(
    () => buildMonthGrid(currentMonth.getFullYear(), currentMonth.getMonth()),
    [currentMonth]
  );

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );

  async function saveAppointment() {
    if (!form.patient_id || !form.scheduled_at) return;
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: prac } = (await supabase
      .from("practitioners")
      .select("id")
      .eq("profile_id", user.id)
      .single()) as { data: { id: string } | null; error: unknown };
    if (!prac) return;

    const { data: newAppt } = (await supabase
      .from("appointments")
      .insert({
        practitioner_id: prac.id,
        patient_id: form.patient_id,
        appointment_type: form.appointment_type,
        scheduled_at: new Date(form.scheduled_at).toISOString(),
        duration_mins: form.duration_mins,
        location_type: form.location_type,
        status: "scheduled",
      })
      .select(
        "id, scheduled_at, duration_mins, appointment_type, status, location_type, daily_room_url, patient_id"
      )
      .single()) as { data: Appt | null; error: unknown };

    if (newAppt) {
      const patient = patients.find((p) => p.id === form.patient_id);
      setAppts((prev) => [
        ...prev,
        { ...newAppt, patient_name: patient?.name ?? "Patient" },
      ]);
      setSelectedDay(dayKey(newAppt.scheduled_at));
    }
    setSaving(false);
    setShowModal(false);
    setForm({
      patient_id: "",
      appointment_type: "initial",
      scheduled_at: "",
      duration_mins: 60,
      location_type: "virtual",
    });
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-nesema-sage/30 border-t-nesema-sage rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <h1 className="font-serif text-3xl text-nesema-t1">Calendar</h1>
        <div className="flex items-center gap-3">
          <div className="flex rounded-xl border border-nesema-sage/20 overflow-hidden">
            <button
              onClick={() => setViewMode("month")}
              className={`px-4 py-1.5 text-sm font-medium transition-colors ${
                viewMode === "month"
                  ? "bg-nesema-bark text-white"
                  : "text-nesema-t2 hover:bg-nesema-sage/10"
              }`}
            >
              Month
            </button>
            <button
              onClick={() => setViewMode("week")}
              className={`px-4 py-1.5 text-sm font-medium transition-colors ${
                viewMode === "week"
                  ? "bg-nesema-bark text-white"
                  : "text-nesema-t2 hover:bg-nesema-sage/10"
              }`}
            >
              Week
            </button>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 bg-nesema-bark text-white text-sm px-4 py-1.5 rounded-xl"
          >
            <Plus size={16} /> Add
          </button>
        </div>
      </div>

      <div className="flex gap-6">
        {/* Main calendar */}
        <div className="flex-1 min-w-0">
          {viewMode === "month" ? (
            <MonthView
              grid={monthGrid}
              currentMonth={currentMonth}
              today={today}
              selectedDay={selectedDay}
              apptsByDay={apptsByDay}
              onSelectDay={setSelectedDay}
              onPrev={prevMonth}
              onNext={nextMonth}
            />
          ) : (
            <WeekView
              weekDays={weekDays}
              today={today}
              selectedDay={selectedDay}
              apptsByDay={apptsByDay}
              onSelectDay={setSelectedDay}
              onPrev={prevWeek}
              onNext={nextWeek}
            />
          )}
        </div>

        {/* Day detail panel */}
        <DayPanel
          selectedDay={selectedDay}
          appts={selectedDayAppts}
          onAdd={() => {
            setForm((f) => ({
              ...f,
              scheduled_at: selectedDay + "T09:00",
            }));
            setShowModal(true);
          }}
        />
      </div>

      {/* Add appointment modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-serif text-xl text-nesema-t1">
                Add Appointment
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-nesema-t3 hover:text-nesema-t1"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-nesema-t2 mb-1">
                  Patient
                </label>
                <select
                  value={form.patient_id}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, patient_id: e.target.value }))
                  }
                  className="w-full border border-nesema-bdr rounded-xl px-3 py-2 text-sm text-nesema-t1 bg-white focus:outline-none focus:border-nesema-sage"
                >
                  <option value="">Select patient…</option>
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-nesema-t2 mb-1">
                  Type
                </label>
                <div className="flex gap-2">
                  {(["initial", "followup", "review"] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() =>
                        setForm((f) => ({ ...f, appointment_type: t }))
                      }
                      className={`flex-1 py-1.5 rounded-xl text-xs font-medium border transition-colors ${
                        form.appointment_type === t
                          ? "bg-nesema-bark text-white border-nesema-bark"
                          : "border-nesema-bdr text-nesema-t2"
                      }`}
                    >
                      {TYPE_LABEL[t]}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-nesema-t2 mb-1">
                  Date & Time
                </label>
                <input
                  type="datetime-local"
                  value={form.scheduled_at}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, scheduled_at: e.target.value }))
                  }
                  className="w-full border border-nesema-bdr rounded-xl px-3 py-2 text-sm text-nesema-t1 focus:outline-none focus:border-nesema-sage"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-nesema-t2 mb-1">
                  Duration
                </label>
                <select
                  value={form.duration_mins}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      duration_mins: Number(e.target.value),
                    }))
                  }
                  className="w-full border border-nesema-bdr rounded-xl px-3 py-2 text-sm text-nesema-t1 bg-white focus:outline-none focus:border-nesema-sage"
                >
                  {[15, 30, 45, 60, 90].map((m) => (
                    <option key={m} value={m}>
                      {m} minutes
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-nesema-t2 mb-1">
                  Location
                </label>
                <div className="flex gap-2">
                  {(["virtual", "in_person"] as const).map((lt) => (
                    <button
                      key={lt}
                      onClick={() =>
                        setForm((f) => ({ ...f, location_type: lt }))
                      }
                      className={`flex-1 py-1.5 rounded-xl text-xs font-medium border transition-colors flex items-center justify-center gap-1 ${
                        form.location_type === lt
                          ? "bg-nesema-bark text-white border-nesema-bark"
                          : "border-nesema-bdr text-nesema-t2"
                      }`}
                    >
                      {lt === "virtual" ? (
                        <>
                          <Video size={12} /> Virtual
                        </>
                      ) : (
                        <>
                          <MapPin size={12} /> In person
                        </>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 border border-nesema-bdr text-nesema-t2 py-2 rounded-xl text-sm"
              >
                Cancel
              </button>
              <button
                onClick={saveAppointment}
                disabled={saving || !form.patient_id || !form.scheduled_at}
                className="flex-1 bg-nesema-bark text-white py-2 rounded-xl text-sm font-medium disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Month View ----
function MonthView({
  grid,
  currentMonth,
  today,
  selectedDay,
  apptsByDay,
  onSelectDay,
  onPrev,
  onNext,
}: {
  grid: Date[];
  currentMonth: Date;
  today: Date;
  selectedDay: string;
  apptsByDay: Record<string, Appt[]>;
  onSelectDay: (d: string) => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  const todayKey = isoDate(today);
  return (
    <div className="rounded-2xl bg-white border border-nesema-sage/20 overflow-hidden">
      {/* Month nav */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-nesema-sage/10">
        <button onClick={onPrev} className="p-1 rounded-lg hover:bg-nesema-sage/10">
          <ChevronLeft size={18} className="text-nesema-t2" />
        </button>
        <span className="font-medium text-nesema-t1">
          {currentMonth.toLocaleDateString("en-GB", {
            month: "long",
            year: "numeric",
          })}
        </span>
        <button onClick={onNext} className="p-1 rounded-lg hover:bg-nesema-sage/10">
          <ChevronRight size={18} className="text-nesema-t2" />
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-nesema-sage/10">
        {DAYS.map((d) => (
          <div
            key={d}
            className="text-center text-[11px] font-semibold text-nesema-t3 uppercase py-2"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7">
        {grid.map((date, i) => {
          const key = isoDate(date);
          const isCurrentMonth =
            date.getMonth() === currentMonth.getMonth();
          const isToday = key === todayKey;
          const isSelected = key === selectedDay;
          const dayAppts = apptsByDay[key] ?? [];

          return (
            <button
              key={i}
              onClick={() => onSelectDay(key)}
              className={`min-h-[72px] p-1.5 text-left border-b border-r border-nesema-sage/10 transition-colors ${
                isSelected ? "bg-nesema-sage/10" : "hover:bg-nesema-sage/5"
              } ${!isCurrentMonth ? "opacity-40" : ""}`}
            >
              <span
                className={`inline-flex w-6 h-6 items-center justify-center rounded-full text-xs font-medium ${
                  isToday
                    ? "bg-nesema-sage text-white"
                    : isSelected
                    ? "text-nesema-bark font-semibold"
                    : "text-nesema-t2"
                }`}
              >
                {date.getDate()}
              </span>
              {/* Appointment dots */}
              {dayAppts.length > 0 && (
                <div className="flex flex-wrap gap-0.5 mt-1">
                  {dayAppts.slice(0, 3).map((a) => (
                    <span
                      key={a.id}
                      className={`w-1.5 h-1.5 rounded-full ${TYPE_COLOR[a.appointment_type]}`}
                    />
                  ))}
                  {dayAppts.length > 3 && (
                    <span className="text-[9px] text-nesema-t3 leading-none">
                      +{dayAppts.length - 3}
                    </span>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---- Week View ----
function WeekView({
  weekDays,
  today,
  selectedDay,
  apptsByDay,
  onSelectDay,
  onPrev,
  onNext,
}: {
  weekDays: Date[];
  today: Date;
  selectedDay: string;
  apptsByDay: Record<string, Appt[]>;
  onSelectDay: (d: string) => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  const todayKey = isoDate(today);
  const start = weekDays[0];
  const end = weekDays[6];
  const label =
    start.getMonth() === end.getMonth()
      ? `${start.toLocaleDateString("en-GB", { day: "numeric" })} – ${end.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}`
      : `${start.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} – ${end.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`;

  return (
    <div className="rounded-2xl bg-white border border-nesema-sage/20 overflow-hidden">
      {/* Week nav */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-nesema-sage/10">
        <button onClick={onPrev} className="p-1 rounded-lg hover:bg-nesema-sage/10">
          <ChevronLeft size={18} className="text-nesema-t2" />
        </button>
        <span className="font-medium text-nesema-t1 text-sm">{label}</span>
        <button onClick={onNext} className="p-1 rounded-lg hover:bg-nesema-sage/10">
          <ChevronRight size={18} className="text-nesema-t2" />
        </button>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[600px]">
          {/* Day headers */}
          <div className="grid grid-cols-[48px_repeat(7,1fr)] border-b border-nesema-sage/10">
            <div />
            {weekDays.map((d) => {
              const k = isoDate(d);
              const isToday = k === todayKey;
              return (
                <button
                  key={k}
                  onClick={() => onSelectDay(k)}
                  className={`py-2 text-center transition-colors ${
                    isToday ? "bg-nesema-sage/10" : ""
                  }`}
                >
                  <div className="text-[11px] font-semibold text-nesema-t3 uppercase">
                    {DAYS[d.getDay() === 0 ? 6 : d.getDay() - 1]}
                  </div>
                  <div
                    className={`text-sm font-medium ${
                      isToday ? "text-nesema-sage" : "text-nesema-t1"
                    }`}
                  >
                    {d.getDate()}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Hourly rows */}
          {HOURS.map((h) => (
            <div
              key={h}
              className="grid grid-cols-[48px_repeat(7,1fr)] border-b border-nesema-sage/10 min-h-[48px]"
            >
              <div className="text-[10px] text-nesema-t3 pt-1 pl-2">
                {String(h).padStart(2, "0")}:00
              </div>
              {weekDays.map((d) => {
                const k = isoDate(d);
                const hAppts = (apptsByDay[k] ?? []).filter(
                  (a) => new Date(a.scheduled_at).getHours() === h
                );
                return (
                  <div
                    key={k}
                    className="border-l border-nesema-sage/10 p-0.5 space-y-0.5"
                  >
                    {hAppts.map((a) => (
                      <div
                        key={a.id}
                        onClick={() => onSelectDay(k)}
                        className={`text-[10px] rounded px-1 py-0.5 cursor-pointer text-white truncate ${TYPE_COLOR[a.appointment_type]}`}
                      >
                        {a.patient_name}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---- Day Detail Panel ----
function DayPanel({
  selectedDay,
  appts,
  onAdd,
}: {
  selectedDay: string;
  appts: Appt[];
  onAdd: () => void;
}) {
  const d = new Date(selectedDay + "T12:00:00");
  const todayKey = isoDate(new Date());
  const label =
    selectedDay === todayKey
      ? "Today"
      : d.toLocaleDateString("en-GB", {
          weekday: "long",
          day: "numeric",
          month: "long",
        });

  return (
    <div className="w-72 shrink-0 hidden lg:block">
      <div className="rounded-2xl bg-white border border-nesema-sage/20 p-4 sticky top-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-medium text-sm text-nesema-t1">{label}</h2>
          <button
            onClick={onAdd}
            className="w-7 h-7 flex items-center justify-center rounded-lg bg-nesema-sage/10 text-nesema-bark hover:bg-nesema-sage/20"
          >
            <Plus size={14} />
          </button>
        </div>

        {appts.length === 0 ? (
          <div className="text-center py-8">
            <CalendarDays
              className="mx-auto mb-2 text-nesema-sage/30"
              size={28}
            />
            <p className="text-xs text-nesema-t3">No appointments</p>
          </div>
        ) : (
          <div className="space-y-2">
            {appts.map((a) => (
              <div
                key={a.id}
                className="rounded-xl border border-nesema-sage/15 p-3"
              >
                <div className="flex items-start gap-2">
                  <span
                    className={`w-2 h-2 rounded-full mt-1 shrink-0 ${TYPE_COLOR[a.appointment_type]}`}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-nesema-t1 truncate">
                      {a.patient_name}
                    </p>
                    <p className="text-[11px] text-nesema-t3">
                      {fmtTime(a.scheduled_at)} · {a.duration_mins}m ·{" "}
                      {TYPE_LABEL[a.appointment_type]}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-full capitalize ${STATUS_STYLES[a.status]}`}
                      >
                        {a.status.replace("_", " ")}
                      </span>
                      <span className="text-[10px] text-nesema-t3 flex items-center gap-0.5">
                        {a.location_type === "virtual" ? (
                          <>
                            <Video size={9} /> Virtual
                          </>
                        ) : (
                          <>
                            <MapPin size={9} /> In person
                          </>
                        )}
                      </span>
                    </div>
                    {a.location_type === "virtual" &&
                      a.daily_room_url &&
                      isWithin15(a.scheduled_at) && (
                        <a
                          href={a.daily_room_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1.5 inline-flex items-center gap-1 text-[10px] bg-nesema-bark text-white px-2 py-1 rounded-full"
                        >
                          <Video size={9} /> Join
                        </a>
                      )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
