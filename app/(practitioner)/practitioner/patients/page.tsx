import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { Database } from "@/types/database";
import { PatientListClient } from "@/components/practitioner/PatientListClient";

type PatientRow = Database["public"]["Tables"]["patients"]["Row"];
type CheckInRow = Database["public"]["Tables"]["check_ins"]["Row"];

export interface PatientListItem {
  id: string;
  name: string;
  initials: string;
  email: string;
  week: number;
  lastCheckIn: string | null;
  adherence: number;
  moodTrend: (number | null)[];
  createdAt: string;
}

function programmeWeek(start: string | null): number {
  if (!start) return 1;
  const diff = new Date().getTime() - new Date(start).getTime();
  return Math.max(1, Math.floor(diff / (7 * 24 * 60 * 60 * 1000)) + 1);
}

function calcAdherence(start: string | null, checkInDates: string[]): number {
  if (!start) return 0;
  const daysSince = Math.max(
    1,
    Math.floor((Date.now() - new Date(start).getTime()) / 86400000)
  );
  const unique = new Set(checkInDates.map((d) => d.slice(0, 10))).size;
  return Math.min(100, Math.round((unique / daysSince) * 100));
}

export default async function PatientsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: prac } = await supabase
    .from("practitioners")
    .select("id")
    .eq("profile_id", user.id)
    .single();

  if (!prac) redirect("/practitioner/dashboard");

  const { data: patientsRaw } = await supabase
    .from("patients")
    .select("*")
    .eq("practitioner_id", prac.id)
    .order("created_at", { ascending: false });

  const patients = (patientsRaw ?? []) as PatientRow[];

  if (patients.length === 0) {
    return <PatientListClient patients={[]} />;
  }

  const profileIds = patients.map((p) => p.profile_id);
  const patientIds = patients.map((p) => p.id);

  // Profiles + check-ins in parallel
  const [profilesRes, checkInsRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, first_name, last_name, email")
      .in("id", profileIds),
    supabase
      .from("check_ins")
      .select("patient_id, checked_in_at, mood_score")
      .in("patient_id", patientIds)
      .order("checked_in_at", { ascending: false })
      .limit(500),
  ]);

  const profiles = profilesRes.data ?? [];
  const checkIns = (checkInsRes.data ?? []) as Pick<
    CheckInRow,
    "patient_id" | "checked_in_at" | "mood_score"
  >[];

  // Group check-ins by patient
  const checkInsByPatient: Record<string, typeof checkIns> = {};
  for (const ci of checkIns) {
    if (!checkInsByPatient[ci.patient_id]) checkInsByPatient[ci.patient_id] = [];
    checkInsByPatient[ci.patient_id].push(ci);
  }

  const profileMap: Record<
    string,
    { first_name: string | null; last_name: string | null; email: string | null }
  > = {};
  for (const p of profiles) {
    profileMap[p.id] = p;
  }

  const items: PatientListItem[] = patients.map((p) => {
    const prof = profileMap[p.profile_id] ?? {};
    const name =
      [prof.first_name, prof.last_name].filter(Boolean).join(" ") ||
      prof.email ||
      "Patient";
    const initials = name
      .split(" ")
      .map((n: string) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

    const cis = checkInsByPatient[p.id] ?? [];
    const lastCheckIn = cis[0]?.checked_in_at ?? null;
    const adherence = calcAdherence(
      p.programme_start,
      cis.map((c) => c.checked_in_at)
    );
    const moodTrend = cis.slice(0, 3).map((c) => c.mood_score);

    return {
      id: p.id,
      name,
      initials,
      email: prof.email ?? "",
      week: programmeWeek(p.programme_start),
      lastCheckIn,
      adherence,
      moodTrend,
      createdAt: p.created_at,
    };
  });

  return <PatientListClient patients={items} />;
}
