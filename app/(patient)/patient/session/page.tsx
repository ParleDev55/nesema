"use client";

import { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  PhoneOff,
  Clock,
  MapPin,
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
  practitioner_id: string;
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

export default function PatientSessionPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const appointmentId = searchParams.get("id");
  const supabase = createClient();

  const [appt, setAppt] = useState<Appt | null>(null);
  const [pracName, setPracName] = useState("Your practitioner");
  const [loading, setLoading] = useState(true);
  const [phase, setPhase] = useState<"pre" | "live" | "done">("pre");
  const [joining, setJoining] = useState(false);
  const [ending, setEnding] = useState(false);
  const [muted, setMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);

  const callRef = useRef<DailyCall | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!appointmentId) { router.push("/patient/dashboard"); return; }
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/sign-in"); return; }

      const { data: raw } = (await supabase
        .from("appointments")
        .select(
          "id, scheduled_at, duration_mins, appointment_type, status, location_type, daily_room_url, practitioner_id"
        )
        .eq("id", appointmentId!)
        .single()) as { data: Appt | null; error: unknown };

      if (!raw) { router.push("/patient/dashboard"); return; }
      setAppt(raw);

      // Fetch practitioner name
      const { data: prac } = (await supabase
        .from("practitioners")
        .select("profile_id")
        .eq("id", raw.practitioner_id)
        .single()) as { data: { profile_id: string } | null; error: unknown };

      if (prac) {
        const { data: profile } = (await supabase
          .from("profiles")
          .select("first_name, last_name")
          .eq("id", prac.profile_id)
          .single()) as {
          data: { first_name: string | null; last_name: string | null } | null;
          error: unknown;
        };
        if (profile) {
          const name = [profile.first_name, profile.last_name]
            .filter(Boolean)
            .join(" ");
          if (name) setPracName(name);
        }
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

      setPhase("live");

      if (frameRef.current) {
        const call = DailyIframe.createCallObject({
          url: data.url,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          dailyConfig: { experimentalChromeVideoMuteLightOff: true } as any,
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
    setPhase("done");
    setTimeout(() => router.push("/patient/dashboard"), 1500);
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
            Session ended
          </p>
          <p className="text-nesema-t3 text-sm">Redirecting to dashboard…</p>
        </div>
      </div>
    );
  }

  if (phase === "live") {
    return (
      <div className="min-h-screen bg-[#1a1a1a] flex flex-col">
        {/* Header */}
        <div className="px-6 py-3 flex items-center justify-between">
          <div>
            <p className="text-white font-medium">{pracName}</p>
            <p className="text-white/50 text-sm">
              {appt ? TYPE_LABEL[appt.appointment_type] : ""}
            </p>
          </div>
          <p className="text-white/40 text-sm">
            {appt ? fmtTime(appt.scheduled_at) : ""}
          </p>
        </div>

        {/* Full-width video */}
        <div className="flex-1 relative px-4 pb-2">
          <div className="rounded-2xl bg-[#2a2a2a] w-full h-full min-h-[60vh] relative overflow-hidden">
            <div ref={frameRef} className="absolute inset-0" />
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-4 py-6">
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
      <div className="w-full max-w-lg space-y-4">
        <h1 className="font-serif text-3xl text-nesema-t1">Your session</h1>

        {/* Appointment card */}
        <div className="rounded-2xl bg-white border border-nesema-sage/20 p-6">
          <p className="text-lg font-medium text-nesema-t1 mb-1">{pracName}</p>
          <p className="text-nesema-t3 text-sm mb-4">
            {appt ? TYPE_LABEL[appt.appointment_type] : ""}
          </p>
          <div className="flex flex-wrap gap-4 text-sm text-nesema-t2">
            <span className="flex items-center gap-1.5">
              <Clock size={15} />
              {appt ? fmtTime(appt.scheduled_at) : ""} ·{" "}
              {appt?.duration_mins}m
            </span>
            <span className="flex items-center gap-1.5">
              {appt?.location_type === "virtual" ? (
                <>
                  <Video size={15} /> Virtual
                </>
              ) : (
                <>
                  <MapPin size={15} /> In person
                </>
              )}
            </span>
          </div>
        </div>

        {/* Video tips */}
        {appt?.location_type === "virtual" && (
          <div className="rounded-2xl bg-nesema-sage/8 border border-nesema-sage/20 p-4">
            <p className="text-sm font-medium text-nesema-t1 mb-2">
              Before you join
            </p>
            <ul className="text-sm text-nesema-t2 space-y-1 list-disc list-inside">
              <li>Check your camera and microphone are working</li>
              <li>Find a quiet, private space</li>
              <li>Use a stable internet connection</li>
            </ul>
          </div>
        )}

        {/* No Daily key warning */}
        {appt?.location_type === "virtual" && !appt?.daily_room_url && minsUntil > 60 && (
          <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 flex items-start gap-3">
            <AlertCircle size={18} className="text-amber-600 shrink-0 mt-0.5" />
            <p className="text-sm text-amber-800">
              Your video link will become available closer to your appointment time.
            </p>
          </div>
        )}

        {/* Join button */}
        {appt?.location_type === "virtual" ? (
          <button
            onClick={startSession}
            disabled={joining || !canJoin}
            className="w-full bg-nesema-bark text-white py-3.5 rounded-xl font-medium flex items-center justify-center gap-2 disabled:opacity-50 text-base"
          >
            <Video size={20} />
            {joining
              ? "Joining…"
              : canJoin
              ? "Join session"
              : `Starts in ${minsUntil} minute${minsUntil === 1 ? "" : "s"}`}
          </button>
        ) : (
          <div className="rounded-2xl bg-nesema-sage/10 p-4 text-center">
            <MapPin className="mx-auto mb-1 text-nesema-sage" size={20} />
            <p className="text-sm text-nesema-t2">
              In-person appointment — please attend at the scheduled time
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
