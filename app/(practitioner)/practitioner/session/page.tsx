"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  PhoneOff,
  User,
  MapPin,
  Clock,
  FileText,
  AlertCircle,
} from "lucide-react";
import DailyIframe from "@daily-co/daily-js";
import type { DailyCall } from "@daily-co/daily-js";

type Appt = {
  id: string;
  scheduled_at: string;
  duration_mins: number;
  appointment_type: "initial" | "followup" | "review";
  status: "scheduled" | "completed" | "cancelled" | "no_show";
  location_type: "virtual" | "in_person";
  daily_room_url: string | null;
  patient_id: string;
  practitioner_notes: string | null;
};

type PatientInfo = {
  name: string;
  condition: string | null;
  notes: string | null;
};

const TYPE_LABEL: Record<string, string> = {
  initial: "Initial Consultation",
  followup: "Follow-up",
  review: "Review",
};

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function minutesUntil(iso: string) {
  return Math.round((new Date(iso).getTime() - Date.now()) / 60000);
}

export default function PractitionerSessionPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const appointmentId = searchParams.get("id");
  const supabase = createClient();

  const [appt, setAppt] = useState<Appt | null>(null);
  const [patient, setPatient] = useState<PatientInfo | null>(null);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [phase, setPhase] = useState<"pre" | "live" | "done">("pre");
  const [roomUrl, setRoomUrl] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [ending, setEnding] = useState(false);
  const [muted, setMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);


  const callRef = useRef<DailyCall | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const notesTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!appointmentId) { router.push("/practitioner/dashboard"); return; }
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/sign-in"); return; }

      const { data: raw } = (await supabase
        .from("appointments")
        .select(
          "id, scheduled_at, duration_mins, appointment_type, status, location_type, daily_room_url, patient_id, practitioner_notes"
        )
        .eq("id", appointmentId!)
        .single()) as { data: Appt | null; error: unknown };

      if (!raw) { router.push("/practitioner/dashboard"); return; }
      setAppt(raw);
      setNotes(raw.practitioner_notes ?? "");

      // Fetch patient info
      const { data: pt } = (await supabase
        .from("patients")
        .select("id, profile_id, presenting_complaint, internal_notes")
        .eq("id", raw.patient_id)
        .single()) as {
        data: {
          id: string;
          profile_id: string;
          presenting_complaint: string | null;
          internal_notes: string | null;
        } | null;
        error: unknown;
      };

      if (pt) {
        const { data: profile } = (await supabase
          .from("profiles")
          .select("first_name, last_name")
          .eq("id", pt.profile_id)
          .single()) as {
          data: { first_name: string | null; last_name: string | null } | null;
          error: unknown;
        };
        setPatient({
          name:
            [profile?.first_name, profile?.last_name]
              .filter(Boolean)
              .join(" ") || "Patient",
          condition: pt.presenting_complaint,
          notes: pt.internal_notes,
        });
      }

      setLoading(false);
    }
    load();

    return () => {
      if (callRef.current) callRef.current.destroy();
    };
  }, [appointmentId]);

  async function startSession() {
    if (!appt) return;
    setJoining(true);
    try {
      const res = await fetch("/api/daily/room", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appointmentId: appt.id }),
      });
      const data = await res.json();
      if (!data.url) throw new Error("No room URL");
      setRoomUrl(data.url);
      setPhase("live");

      // Init Daily call object
      if (frameRef.current) {
        const call = DailyIframe.createCallObject({
          url: data.url,
          dailyConfig: { experimentalChromeVideoMuteLightOff: true },
        });
        callRef.current = call;
        call.on("left-meeting", () => handleEnd());
        await call.join({ url: data.url });
      }
    } catch {
      // ignore – show error state
    }
    setJoining(false);
  }

  async function handleEnd() {
    if (ending) return;
    setEnding(true);
    if (callRef.current) {
      callRef.current.leave();
      callRef.current.destroy();
      callRef.current = null;
    }
    if (appt) {
      await supabase
        .from("appointments")
        .update({ status: "completed", practitioner_notes: notes })
        .eq("id", appt.id);
    }
    setPhase("done");
    setTimeout(() => router.push("/practitioner/dashboard"), 1500);
  }

  const saveNotes = useCallback(
    async (val: string) => {
      if (!appt) return;
      await supabase
        .from("appointments")
        .update({ practitioner_notes: val })
        .eq("id", appt.id);
    },
    [appt]
  );

  function handleNotesChange(val: string) {
    setNotes(val);
    if (notesTimer.current) clearTimeout(notesTimer.current);
    notesTimer.current = setTimeout(() => saveNotes(val), 1000);
  }

  function toggleMute() {
    if (!callRef.current) return;
    if (muted) { callRef.current.setLocalAudio(true); setMuted(false); }
    else { callRef.current.setLocalAudio(false); setMuted(true); }
  }

  function toggleCam() {
    if (!callRef.current) return;
    if (camOff) { callRef.current.setLocalVideo(true); setCamOff(false); }
    else { callRef.current.setLocalVideo(false); setCamOff(true); }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-nesema-bg">
        <div className="w-8 h-8 border-2 border-nesema-sage/30 border-t-nesema-sage rounded-full animate-spin" />
      </div>
    );
  }

  if (phase === "done") {
    return (
      <div className="flex items-center justify-center min-h-screen bg-nesema-bg">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <PhoneOff className="text-green-600" size={28} />
          </div>
          <p className="font-serif text-2xl text-nesema-t1 mb-1">
            Session complete
          </p>
          <p className="text-nesema-t3 text-sm">Redirecting to dashboard…</p>
        </div>
      </div>
    );
  }

  if (phase === "live" && roomUrl) {
    return (
      <div className="min-h-screen bg-[#1a1a1a] flex flex-col">
        {/* Patient name banner */}
        <div className="px-6 py-3 flex items-center justify-between">
          <div>
            <p className="text-white font-medium">{patient?.name ?? "Patient"}</p>
            <p className="text-white/50 text-sm">
              {appt ? TYPE_LABEL[appt.appointment_type] : ""}
            </p>
          </div>
          <p className="text-white/40 text-sm">{appt ? fmtTime(appt.scheduled_at) : ""}</p>
        </div>

        {/* Video area */}
        <div className="flex flex-1 gap-2 px-4 pb-2 min-h-0">
          {/* Remote participant */}
          <div className="flex-1 rounded-2xl bg-[#2a2a2a] flex items-center justify-center relative overflow-hidden">
            <div ref={frameRef} className="absolute inset-0" />
            <div className="text-center text-white/30 z-0">
              <User size={48} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">Waiting for patient…</p>
            </div>
          </div>

          {/* Notes sidebar */}
          <div className="w-72 shrink-0 flex flex-col gap-2">
            <div className="rounded-2xl bg-[#2a2a2a] p-3 flex-1 flex flex-col">
              <p className="text-white/60 text-xs font-medium mb-2 flex items-center gap-1">
                <FileText size={12} /> Session notes
              </p>
              <textarea
                value={notes}
                onChange={(e) => handleNotesChange(e.target.value)}
                placeholder="Add notes…"
                className="flex-1 bg-transparent text-white/80 text-sm resize-none focus:outline-none placeholder-white/20"
              />
              <p className="text-white/20 text-[10px] mt-1">Auto-saves</p>
            </div>
            {patient?.condition && (
              <div className="rounded-2xl bg-[#2a2a2a] p-3">
                <p className="text-white/60 text-xs font-medium mb-1">
                  Presenting complaint
                </p>
                <p className="text-white/80 text-sm">{patient.condition}</p>
              </div>
            )}
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-4 py-4">
          <button
            onClick={toggleMute}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
              muted ? "bg-red-500 text-white" : "bg-white/10 text-white hover:bg-white/20"
            }`}
          >
            {muted ? <MicOff size={20} /> : <Mic size={20} />}
          </button>
          <button
            onClick={toggleCam}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
              camOff ? "bg-red-500 text-white" : "bg-white/10 text-white hover:bg-white/20"
            }`}
          >
            {camOff ? <VideoOff size={20} /> : <Video size={20} />}
          </button>
          <button
            onClick={handleEnd}
            disabled={ending}
            className="w-14 h-14 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center transition-colors disabled:opacity-50"
          >
            <PhoneOff size={22} />
          </button>
        </div>
      </div>
    );
  }

  // Pre-session view
  const minsUntil = appt ? minutesUntil(appt.scheduled_at) : 999;
  const canJoin = minsUntil <= 5;

  return (
    <div className="min-h-screen bg-nesema-bg flex items-start justify-center pt-16 px-4">
      <div className="w-full max-w-2xl space-y-4">
        <h1 className="font-serif text-3xl text-nesema-t1">
          Upcoming Session
        </h1>

        {/* Appointment card */}
        <div className="rounded-2xl bg-white border border-nesema-sage/20 p-5">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-nesema-sage/10 flex items-center justify-center text-nesema-bark shrink-0">
              <User size={22} />
            </div>
            <div className="flex-1">
              <p className="font-medium text-nesema-t1 text-lg">
                {patient?.name ?? "Patient"}
              </p>
              {patient?.condition && (
                <p className="text-nesema-t3 text-sm">{patient.condition}</p>
              )}
              <div className="flex flex-wrap gap-4 mt-3 text-sm text-nesema-t2">
                <span className="flex items-center gap-1">
                  <Clock size={14} />
                  {appt ? fmtTime(appt.scheduled_at) : ""} ·{" "}
                  {appt?.duration_mins}m
                </span>
                <span className="flex items-center gap-1">
                  {appt?.location_type === "virtual" ? (
                    <>
                      <Video size={14} /> Virtual
                    </>
                  ) : (
                    <>
                      <MapPin size={14} /> In person
                    </>
                  )}
                </span>
                <span className="font-medium text-nesema-bark">
                  {appt ? TYPE_LABEL[appt.appointment_type] : ""}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="rounded-2xl bg-white border border-nesema-sage/20 p-5">
          <label className="block text-xs font-semibold text-nesema-t3 uppercase tracking-wider mb-3 flex items-center gap-1">
            <FileText size={12} /> Session notes
          </label>
          <textarea
            value={notes}
            onChange={(e) => handleNotesChange(e.target.value)}
            placeholder="Add pre-session notes, questions to ask, treatment plan…"
            rows={5}
            className="w-full border border-nesema-bdr rounded-xl px-3 py-2.5 text-sm text-nesema-t1 resize-none focus:outline-none focus:border-nesema-sage"
          />
        </div>

        {/* Patient notes if any */}
        {patient?.notes && (
          <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4">
            <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider mb-1">
              Internal notes
            </p>
            <p className="text-sm text-amber-800">{patient.notes}</p>
          </div>
        )}

        {/* No Daily key warning */}
        {!process.env.DAILY_API_KEY && appt?.location_type === "virtual" && (
          <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 flex items-start gap-3">
            <AlertCircle size={18} className="text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-800">
                Video not configured
              </p>
              <p className="text-xs text-amber-700 mt-0.5">
                Add DAILY_API_KEY to your environment to enable video sessions.
              </p>
            </div>
          </div>
        )}

        {/* Join button */}
        {appt?.location_type === "virtual" ? (
          <div className="flex items-center gap-4">
            <button
              onClick={startSession}
              disabled={joining || (!canJoin)}
              className="flex-1 bg-nesema-bark text-white py-3 rounded-xl font-medium flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Video size={18} />
              {joining ? "Joining…" : canJoin ? "Join session" : `Starts in ${minsUntil}m`}
            </button>
            {!canJoin && (
              <p className="text-xs text-nesema-t3">
                Join button unlocks 5 min before
              </p>
            )}
          </div>
        ) : (
          <div className="rounded-2xl bg-nesema-sage/10 p-4 text-center">
            <MapPin className="mx-auto mb-1 text-nesema-sage" size={20} />
            <p className="text-sm text-nesema-t2">In-person appointment — no video required</p>
          </div>
        )}
      </div>
    </div>
  );
}
