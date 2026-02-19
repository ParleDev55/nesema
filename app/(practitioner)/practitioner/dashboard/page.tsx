import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import type { Profile, Practitioner } from "@/types/database";
import {
  Users,
  CalendarCheck,
  TrendingUp,
  AlertCircle,
  Video,
  Clock,
  ChevronRight,
} from "lucide-react";

function formatTime(isoString: string) {
  return new Date(isoString).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(date: Date) {
  return date.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

// Typed shapes for joined query results
interface AppointmentWithPatient {
  id: string;
  scheduled_at: string;
  duration_mins: number;
  appointment_type: "initial" | "followup" | "review";
  status: string;
  location_type: "virtual" | "in_person";
  daily_room_url: string | null;
  patients: {
    id: string;
    profiles: {
      first_name: string | null;
      last_name: string | null;
      avatar_url: string | null;
    };
  };
}

interface PatientWithCheckins {
  id: string;
  profiles: {
    first_name: string | null;
    last_name: string | null;
    avatar_url: string | null;
  };
  check_ins: { checked_in_at: string }[];
}

export default async function PractitionerDashboardPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/sign-in");

  // Fetch profile
  const { data: profileData } = await supabase
    .from("profiles")
    .select("first_name, last_name")
    .eq("id", user.id)
    .single();
  const profile = profileData as Pick<Profile, "first_name" | "last_name"> | null;

  // Fetch practitioner record
  const { data: practitionerData } = await supabase
    .from("practitioners")
    .select("id, practice_name, discipline")
    .eq("profile_id", user.id)
    .single();
  const practitioner = practitionerData as Pick<Practitioner, "id" | "practice_name" | "discipline"> | null;

  const firstName = profile?.first_name || "there";
  const today = new Date();
  const todayStart = new Date(today);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(today);
  todayEnd.setHours(23, 59, 59, 999);

  // Fetch today's appointments
  const { data: todayAppointmentsRaw } = practitioner
    ? await supabase
        .from("appointments")
        .select(
          `id, scheduled_at, duration_mins, appointment_type, status, location_type, daily_room_url,
          patients!inner ( id, profiles!inner (first_name, last_name, avatar_url) )`
        )
        .eq("practitioner_id", practitioner.id)
        .gte("scheduled_at", todayStart.toISOString())
        .lte("scheduled_at", todayEnd.toISOString())
        .order("scheduled_at", { ascending: true })
    : { data: [] };

  const todayAppointments = (todayAppointmentsRaw || []) as unknown as AppointmentWithPatient[];

  // Fetch active patient count
  const { count: patientCount } = practitioner
    ? await supabase
        .from("patients")
        .select("*", { count: "exact", head: true })
        .eq("practitioner_id", practitioner.id)
    : { count: 0 };

  // Fetch completed appointments this month
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const { count: completedThisMonth } = practitioner
    ? await supabase
        .from("appointments")
        .select("*", { count: "exact", head: true })
        .eq("practitioner_id", practitioner.id)
        .eq("status", "completed")
        .gte("scheduled_at", monthStart.toISOString())
    : { count: 0 };

  // Fetch patients who may need attention (no recent check-in)
  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(today.getDate() - 3);

  const { data: patientsRaw } = practitioner
    ? await supabase
        .from("patients")
        .select(`id, profiles!inner (first_name, last_name, avatar_url), check_ins (checked_in_at)`)
        .eq("practitioner_id", practitioner.id)
        .limit(10)
    : { data: [] };

  const allPatients = (patientsRaw || []) as unknown as PatientWithCheckins[];

  const attentionList = allPatients
    .filter((p) => {
      const lastCheckIn = p.check_ins?.[0]?.checked_in_at;
      if (!lastCheckIn) return true;
      return new Date(lastCheckIn) < threeDaysAgo;
    })
    .slice(0, 4);

  const stats = [
    { label: "Active Patients", value: patientCount ?? 0, icon: Users, color: "text-nesema-sage", bg: "bg-nesema-sage-p" },
    { label: "Today's Sessions", value: todayAppointments.length, icon: CalendarCheck, color: "text-nesema-sky", bg: "bg-nesema-sky-p" },
    { label: "Sessions This Month", value: completedThisMonth ?? 0, icon: TrendingUp, color: "text-nesema-amber", bg: "bg-nesema-amb-p" },
    { label: "Needing Attention", value: attentionList.length, icon: AlertCircle, color: "text-nesema-clay", bg: "bg-nesema-clay-p" },
  ];

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-serif text-3xl text-nesema-t1 mb-1">
          Good morning, {firstName}.
        </h1>
        <p className="text-nesema-t3 text-sm">{formatDate(today)}</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((stat) => (
          <Card key={stat.label} className="border-nesema-bdr">
            <CardContent className="p-5">
              <div className={`inline-flex items-center justify-center h-10 w-10 rounded-xl ${stat.bg} mb-4`}>
                <stat.icon size={20} className={stat.color} />
              </div>
              <p className="text-[11px] font-medium uppercase tracking-widest text-nesema-t3 mb-1">
                {stat.label}
              </p>
              <p className="font-serif text-4xl font-semibold text-nesema-t1">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Today's sessions */}
        <div className="lg:col-span-2">
          <Card className="border-nesema-bdr h-full">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold text-nesema-t1">
                  Today&apos;s Sessions
                </CardTitle>
                <Button variant="ghost" size="sm" className="text-nesema-t3 text-xs h-7 px-2">
                  View calendar <ChevronRight size={14} />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {todayAppointments.length === 0 ? (
                <div className="text-center py-12">
                  <CalendarCheck size={40} className="text-nesema-t4 mx-auto mb-3" />
                  <p className="text-nesema-t2 font-medium mb-1">No sessions today</p>
                  <p className="text-nesema-t3 text-sm">
                    Enjoy the breathing room — or check your upcoming week.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {todayAppointments.map((appt) => {
                    const pp = appt.patients?.profiles;
                    const patientName =
                      [pp?.first_name, pp?.last_name].filter(Boolean).join(" ") ||
                      "Unknown Patient";
                    const isUpcoming = new Date(appt.scheduled_at) > new Date();
                    const isVirtual = appt.location_type === "virtual";

                    return (
                      <div
                        key={appt.id}
                        className="flex items-center gap-4 p-4 rounded-xl border border-nesema-bdr bg-nesema-surf hover:border-nesema-sage-m transition-colors"
                      >
                        <Avatar className="h-10 w-10 flex-shrink-0">
                          {pp?.avatar_url && (
                            <AvatarImage src={pp.avatar_url} alt={patientName} />
                          )}
                          <AvatarFallback className="bg-nesema-sage-p text-nesema-sage text-sm font-medium">
                            {getInitials(patientName)}
                          </AvatarFallback>
                        </Avatar>

                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-nesema-t1 truncate">{patientName}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <Clock size={12} className="text-nesema-t3" />
                            <span className="text-xs text-nesema-t3">
                              {formatTime(appt.scheduled_at)} · {appt.duration_mins} min
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Badge variant={appt.appointment_type === "initial" ? "clay" : "sage"}>
                            {appt.appointment_type === "initial"
                              ? "Initial"
                              : appt.appointment_type === "followup"
                              ? "Follow-up"
                              : "Review"}
                          </Badge>
                          {isVirtual && isUpcoming && (
                            <Button size="sm" className="h-7 text-xs gap-1 px-3">
                              <Video size={12} /> Join
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Patients needing attention */}
        <div>
          <Card className="border-nesema-bdr h-full">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold text-nesema-t1">
                  Needs Attention
                </CardTitle>
                <Button variant="ghost" size="sm" className="text-nesema-t3 text-xs h-7 px-2">
                  All patients <ChevronRight size={14} />
                </Button>
              </div>
              <p className="text-xs text-nesema-t3 mt-0.5">Patients with no recent check-in</p>
            </CardHeader>
            <CardContent>
              {attentionList.length === 0 ? (
                <div className="text-center py-10">
                  <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-nesema-sage-p mb-3">
                    <Users size={22} className="text-nesema-sage" />
                  </div>
                  <p className="text-nesema-t2 font-medium text-sm mb-1">All patients on track</p>
                  <p className="text-nesema-t3 text-xs">Everyone has checked in recently.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {attentionList.map((patient) => {
                    const pp = patient.profiles;
                    const patientName =
                      [pp?.first_name, pp?.last_name].filter(Boolean).join(" ") || "Unknown";
                    const lastCheckIn = patient.check_ins?.[0]?.checked_in_at;
                    const daysAgo = lastCheckIn
                      ? Math.floor(
                          (today.getTime() - new Date(lastCheckIn).getTime()) /
                            (1000 * 60 * 60 * 24)
                        )
                      : null;

                    return (
                      <div
                        key={patient.id}
                        className="flex items-center gap-3 p-3 rounded-xl hover:bg-nesema-bg transition-colors cursor-pointer"
                      >
                        <Avatar className="h-9 w-9 flex-shrink-0">
                          {pp?.avatar_url && (
                            <AvatarImage src={pp.avatar_url} alt={patientName} />
                          )}
                          <AvatarFallback className="bg-nesema-clay-p text-nesema-clay text-xs font-medium">
                            {getInitials(patientName)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-nesema-t1 truncate">{patientName}</p>
                          <p className="text-xs text-nesema-t3">
                            {daysAgo === null
                              ? "Never checked in"
                              : `Last check-in ${daysAgo}d ago`}
                          </p>
                        </div>
                        <AlertCircle size={16} className="text-nesema-clay flex-shrink-0" />
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
