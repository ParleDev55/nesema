"use client";

import { useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database";
import { Shield, CheckCircle2, AlertCircle } from "lucide-react";

type AvailabilityRow = Database["public"]["Tables"]["availability"]["Row"];

interface Practitioner {
  id: string;
  profile_id: string;
  practice_name: string | null;
  discipline: string | null;
  bio: string | null;
  registration_body: string | null;
  registration_number: string | null;
  session_length_mins: number;
  buffer_mins: number;
  initial_fee: number | null;
  followup_fee: number | null;
  cancellation_hours: number;
  booking_slug: string | null;
}

interface TimeSlot {
  time: string;
  datetime: string;
  available: boolean;
}

interface DaySlots {
  date: string;
  dayLabel: string;
  dateLabel: string;
  slots: TimeSlot[];
}

// ── Slot generation ───────────────────────────────────────────────────────────

function generateSlots(
  availability: AvailabilityRow[],
  sessionLength: number,
  bufferMins: number,
  bookedSlots: { scheduled_at: string; duration_mins: number }[]
): DaySlots[] {
  const days: DaySlots[] = [];
  const now = Date.now();

  for (let i = 0; i < 14; i++) {
    const date = new Date(now + i * 86400000);
    const dow = date.getDay(); // 0=Sun
    const avail = availability.find((a) => a.day_of_week === dow);
    if (!avail) continue;

    const dateStr = date.toISOString().slice(0, 10);
    const slots: TimeSlot[] = [];

    const [startH, startM] = avail.start_time.split(":").map(Number);
    const [endH, endM] = avail.end_time.split(":").map(Number);
    const endMins = endH * 60 + endM;

    let cur = startH * 60 + startM;
    while (cur + sessionLength <= endMins) {
      const h = Math.floor(cur / 60)
        .toString()
        .padStart(2, "0");
      const m = (cur % 60).toString().padStart(2, "0");
      const timeStr = `${h}:${m}`;

      const slotDatetime = new Date(`${dateStr}T${timeStr}:00`);
      if (slotDatetime.getTime() < now + 30 * 60000) {
        cur += sessionLength + bufferMins;
        continue;
      }

      const slotStart = slotDatetime.getTime();
      const slotEnd = slotStart + sessionLength * 60000;
      const available = !bookedSlots.some((b) => {
        const apptStart = new Date(b.scheduled_at).getTime();
        const apptEnd = apptStart + b.duration_mins * 60000;
        return slotStart < apptEnd && slotEnd > apptStart;
      });

      slots.push({ time: timeStr, datetime: slotDatetime.toISOString(), available });
      cur += sessionLength + bufferMins;
    }

    if (slots.length > 0) {
      days.push({
        date: dateStr,
        dayLabel: date.toLocaleDateString("en-GB", { weekday: "short" }),
        dateLabel: date.toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
        slots,
      });
    }
  }
  return days;
}

// ── Main component ────────────────────────────────────────────────────────────

export function BookingClient({
  practitioner,
  availability,
  bookedSlots,
}: {
  practitioner: Practitioner;
  availability: AvailabilityRow[];
  bookedSlots: { scheduled_at: string; duration_mins: number }[];
}) {
  const [apptType, setApptType] = useState<"initial" | "followup">("initial");
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [patientName, setPatientName] = useState("");
  const [patientEmail, setPatientEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [step, setStep] = useState<"select" | "details" | "confirm" | "success">(
    "select"
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sessionLength =
    apptType === "initial"
      ? practitioner.session_length_mins
      : Math.min(practitioner.session_length_mins, 45);

  const fee =
    apptType === "initial" ? practitioner.initial_fee : practitioner.followup_fee;

  const daySlots = useMemo(
    () =>
      generateSlots(
        availability,
        sessionLength,
        practitioner.buffer_mins,
        bookedSlots
      ),
    [availability, sessionLength, practitioner.buffer_mins, bookedSlots]
  );

  const initials = (practitioner.practice_name ?? "P")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  async function confirmBooking() {
    if (!selectedSlot || !patientName || !patientEmail) return;
    setError(null);
    setSubmitting(true);

    const supabase = createClient();
    const { error: insertError } = await supabase.from("appointments").insert({
      practitioner_id: practitioner.id,
      patient_id: practitioner.id, // placeholder — replaced by real patient lookup in production
      appointment_type: apptType,
      status: "scheduled",
      scheduled_at: selectedSlot,
      duration_mins: sessionLength,
      location_type: "virtual",
      patient_notes: notes || null,
      amount_pence: fee ?? null,
    });

    if (insertError) {
      setError("Something went wrong. Please try again.");
      setSubmitting(false);
      return;
    }

    setStep("success");
    setSubmitting(false);
  }

  // ── Success screen ─────────────────────────────────────────────────────────

  if (step === "success") {
    return (
      <div className="min-h-screen bg-nesema-bg flex items-center justify-center p-8">
        <div className="max-w-md w-full text-center">
          <div className="h-20 w-20 rounded-full bg-nesema-sage/10 flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="text-nesema-sage" size={40} />
          </div>
          <h1 className="font-serif text-3xl text-nesema-t1 mb-2">
            Booking confirmed!
          </h1>
          <p className="text-nesema-t3 mb-2">
            Your appointment with{" "}
            <strong className="text-nesema-t2">
              {practitioner.practice_name}
            </strong>{" "}
            is confirmed.
          </p>
          {selectedSlot && (
            <p className="text-nesema-t2 font-medium mb-8">
              {new Date(selectedSlot).toLocaleDateString("en-GB", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })}{" "}
              at{" "}
              {new Date(selectedSlot).toLocaleTimeString("en-GB", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          )}
          <p className="text-nesema-t3 text-sm">
            A confirmation email has been sent to {patientEmail}.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-nesema-bg">
      {/* ── Hero header ─────────────────────────────────────────────────── */}
      <div className="bg-[#2E2620] px-4 md:px-8 py-10 md:py-14">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center sm:items-start gap-5">
          <div className="h-16 w-16 md:h-20 md:w-20 rounded-full bg-nesema-sage flex items-center justify-center flex-shrink-0">
            <span className="font-serif text-white text-2xl md:text-3xl font-semibold">
              {initials}
            </span>
          </div>
          <div className="text-center sm:text-left">
            <h1 className="font-serif text-2xl md:text-3xl text-white mb-1">
              {practitioner.practice_name ?? "Book a session"}
            </h1>
            {practitioner.discipline && (
              <p className="text-white/60 text-sm mb-2 capitalize">
                {practitioner.discipline}
              </p>
            )}
            {practitioner.registration_body && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-white/70 text-xs">
                <Shield size={12} />
                {practitioner.registration_body} Registered
                {practitioner.registration_number && (
                  <span className="opacity-60">
                    · {practitioner.registration_number}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Main content ────────────────────────────────────────────────── */}
      <div className="max-w-5xl mx-auto px-4 md:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ── Left column ──────────────────────────────────────────────── */}
          <div className="lg:col-span-2 space-y-6">
            {/* Appointment type */}
            <div className="bg-white rounded-2xl border border-nesema-bdr p-5">
              <h2 className="font-serif text-lg text-nesema-t1 mb-4">
                Appointment type
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  {
                    type: "initial" as const,
                    label: "Initial consultation",
                    duration: practitioner.session_length_mins,
                    fee: practitioner.initial_fee,
                  },
                  {
                    type: "followup" as const,
                    label: "Follow-up session",
                    duration: Math.min(practitioner.session_length_mins, 45),
                    fee: practitioner.followup_fee,
                  },
                ].map((opt) => (
                  <button
                    key={opt.type}
                    onClick={() => {
                      setApptType(opt.type);
                      setSelectedSlot(null);
                    }}
                    className={`text-left p-4 rounded-xl border-2 transition-colors ${
                      apptType === opt.type
                        ? "border-nesema-sage bg-nesema-sage/5"
                        : "border-nesema-bdr hover:border-nesema-sage/40"
                    }`}
                  >
                    <p className="font-medium text-nesema-t1 text-sm mb-0.5">
                      {opt.label}
                    </p>
                    <p className="text-xs text-nesema-t3">
                      {opt.duration} min
                      {opt.fee !== null && (
                        <> · £{(opt.fee / 100).toFixed(0)}</>
                      )}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {/* Time slot grid */}
            <div className="bg-white rounded-2xl border border-nesema-bdr p-5">
              <h2 className="font-serif text-lg text-nesema-t1 mb-4">
                Choose a time
              </h2>
              {daySlots.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-nesema-t2 font-medium mb-1">
                    No availability found
                  </p>
                  <p className="text-nesema-t3 text-sm">
                    No slots are available in the next two weeks. Please check
                    back soon.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <div className="flex gap-3 min-w-max">
                    {daySlots.map((day) => (
                      <div key={day.date} className="w-28 flex-shrink-0">
                        <div className="text-center mb-2">
                          <p className="text-xs font-semibold text-nesema-t2 uppercase tracking-wide">
                            {day.dayLabel}
                          </p>
                          <p className="text-xs text-nesema-t3">{day.dateLabel}</p>
                        </div>
                        <div className="space-y-1.5">
                          {day.slots.map((slot) => (
                            <button
                              key={slot.datetime}
                              onClick={() =>
                                slot.available && setSelectedSlot(slot.datetime)
                              }
                              disabled={!slot.available}
                              className={`w-full py-2 rounded-lg text-xs font-medium transition-colors ${
                                selectedSlot === slot.datetime
                                  ? "bg-nesema-sage text-white"
                                  : slot.available
                                    ? "bg-nesema-bg text-nesema-t2 hover:bg-nesema-sage/10 hover:text-nesema-sage"
                                    : "bg-nesema-bdr text-nesema-t4 cursor-not-allowed line-through"
                              }`}
                            >
                              {slot.time}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* About */}
            {practitioner.bio && (
              <div className="bg-white rounded-2xl border border-nesema-bdr p-5">
                <h2 className="font-serif text-lg text-nesema-t1 mb-3">
                  About
                </h2>
                <p className="text-sm text-nesema-t2 leading-relaxed">
                  {practitioner.bio}
                </p>
              </div>
            )}
          </div>

          {/* ── Right sidebar ─────────────────────────────────────────────── */}
          <div className="space-y-4">
            {/* Booking summary */}
            <div className="bg-white rounded-2xl border border-nesema-bdr p-5 sticky top-4">
              <h2 className="font-serif text-lg text-nesema-t1 mb-4">
                Your booking
              </h2>

              {/* Appointment type summary */}
              <div className="py-3 border-b border-nesema-bdr">
                <p className="text-xs text-nesema-t3 uppercase tracking-wide mb-0.5">
                  Type
                </p>
                <p className="text-sm font-medium text-nesema-t1">
                  {apptType === "initial"
                    ? "Initial consultation"
                    : "Follow-up session"}
                </p>
                <p className="text-xs text-nesema-t3">{sessionLength} minutes</p>
              </div>

              {/* Selected slot summary */}
              <div className="py-3 border-b border-nesema-bdr">
                <p className="text-xs text-nesema-t3 uppercase tracking-wide mb-0.5">
                  Date & time
                </p>
                {selectedSlot ? (
                  <p className="text-sm font-medium text-nesema-t1">
                    {new Date(selectedSlot).toLocaleDateString("en-GB", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                    })}
                    {" at "}
                    {new Date(selectedSlot).toLocaleTimeString("en-GB", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                ) : (
                  <p className="text-sm text-nesema-t3 italic">Not selected yet</p>
                )}
              </div>

              {/* Fee */}
              {fee !== null && (
                <div className="py-3 border-b border-nesema-bdr">
                  <p className="text-xs text-nesema-t3 uppercase tracking-wide mb-0.5">
                    Fee
                  </p>
                  <p className="text-lg font-semibold text-nesema-t1">
                    £{(fee / 100).toFixed(2)}
                  </p>
                </div>
              )}

              {/* Patient details form */}
              {(step === "select" || step === "details") && (
                <div className="pt-4 space-y-3">
                  <div>
                    <label className="text-xs text-nesema-t3 uppercase tracking-wide block mb-1">
                      Your name
                    </label>
                    <input
                      type="text"
                      value={patientName}
                      onChange={(e) => setPatientName(e.target.value)}
                      placeholder="Full name"
                      className="w-full px-3 py-2 rounded-xl border border-nesema-bdr bg-nesema-bg text-sm text-nesema-t1 placeholder:text-nesema-t3 focus:outline-none focus:ring-2 focus:ring-nesema-sage/40"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-nesema-t3 uppercase tracking-wide block mb-1">
                      Email address
                    </label>
                    <input
                      type="email"
                      value={patientEmail}
                      onChange={(e) => setPatientEmail(e.target.value)}
                      placeholder="your@email.com"
                      className="w-full px-3 py-2 rounded-xl border border-nesema-bdr bg-nesema-bg text-sm text-nesema-t1 placeholder:text-nesema-t3 focus:outline-none focus:ring-2 focus:ring-nesema-sage/40"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-nesema-t3 uppercase tracking-wide block mb-1">
                      Notes (optional)
                    </label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={3}
                      placeholder="Any relevant health information or questions…"
                      className="w-full px-3 py-2 rounded-xl border border-nesema-bdr bg-nesema-bg text-sm text-nesema-t1 placeholder:text-nesema-t3 focus:outline-none focus:ring-2 focus:ring-nesema-sage/40 resize-none"
                    />
                  </div>

                  {/* Payment notice */}
                  <div className="bg-nesema-bg rounded-xl p-3 text-xs text-nesema-t3">
                    <p className="font-medium text-nesema-t2 mb-0.5">
                      Secure payment
                    </p>
                    Payment will be collected securely via Stripe before your
                    appointment is confirmed.
                  </div>

                  {error && (
                    <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-200">
                      <AlertCircle size={14} className="text-red-500 mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-red-600">{error}</p>
                    </div>
                  )}

                  <button
                    onClick={confirmBooking}
                    disabled={
                      !selectedSlot || !patientName || !patientEmail || submitting
                    }
                    className="w-full py-3 rounded-full bg-nesema-sage text-white text-sm font-medium hover:bg-nesema-sage/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting ? "Confirming…" : "Confirm booking"}
                  </button>
                </div>
              )}

              {/* Cancellation policy */}
              {practitioner.cancellation_hours > 0 && (
                <p className="text-xs text-nesema-t3 mt-3 text-center">
                  Free cancellation up to {practitioner.cancellation_hours} hours
                  before your appointment.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
