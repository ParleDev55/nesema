import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import type { Database } from "@/types/database";
import { PatientProfileClient } from "@/components/practitioner/PatientProfileClient";

type PatientRow = Database["public"]["Tables"]["patients"]["Row"];
type CheckInRow = Database["public"]["Tables"]["check_ins"]["Row"];
type CarePlanRow = Database["public"]["Tables"]["care_plans"]["Row"];
type MealPlanRow = Database["public"]["Tables"]["meal_plans"]["Row"];
type DocumentRow = Database["public"]["Tables"]["documents"]["Row"];

type PracRow = { id: string; discipline: string | null };
type ProfileRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  avatar_url: string | null;
};

function calcAge(dob: string | null): number | null {
  if (!dob) return null;
  const diff = Date.now() - new Date(dob).getTime();
  return Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000));
}

function programmeWeek(start: string | null): number {
  if (!start) return 1;
  const diff = new Date().getTime() - new Date(start).getTime();
  return Math.max(1, Math.floor(diff / (7 * 24 * 60 * 60 * 1000)) + 1);
}

export default async function PatientProfilePage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  // Get practitioner ID
  const { data: prac } = (await supabase
    .from("practitioners")
    .select("id, discipline")
    .eq("profile_id", user.id)
    .single()) as { data: PracRow | null; error: unknown };

  if (!prac) redirect("/practitioner/dashboard");

  // Fetch patient
  const { data: patient } = (await supabase
    .from("patients")
    .select("*")
    .eq("id", params.id)
    .eq("practitioner_id", prac.id)
    .single()) as { data: PatientRow | null; error: unknown };

  if (!patient) notFound();

  // Fetch patient profile
  const { data: profile } = (await supabase
    .from("profiles")
    .select("first_name, last_name, email, avatar_url, id")
    .eq("id", patient.profile_id)
    .single()) as { data: ProfileRow | null; error: unknown };

  // Parallel fetches
  const [checkInsRes, carePlanRes, mealPlanRes, docsRes] = await Promise.all([
    supabase
      .from("check_ins")
      .select("*")
      .eq("patient_id", patient.id)
      .order("checked_in_at", { ascending: false })
      .limit(30),
    supabase
      .from("care_plans")
      .select("*")
      .eq("patient_id", patient.id)
      .order("week_number", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("meal_plans")
      .select("*")
      .eq("patient_id", patient.id)
      .order("assigned_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("documents")
      .select("*")
      .eq("patient_id", patient.id)
      .eq("is_lab_result", true)
      .order("created_at", { ascending: false }),
  ]);

  const checkIns = (checkInsRes.data ?? []) as CheckInRow[];
  const carePlan = (carePlanRes.data ?? null) as CarePlanRow | null;
  const mealPlan = (mealPlanRes.data ?? null) as MealPlanRow | null;
  const docs = (docsRes.data ?? []) as DocumentRow[];

  const name =
    [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
    profile?.email ||
    "Patient";
  const initials = name
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
  const age = calcAge(patient.date_of_birth);
  const week = programmeWeek(patient.programme_start);
  const discipline = prac.discipline ?? "";

  // Adherence: % of days checked in since programme_start
  let adherence = 0;
  if (patient.programme_start) {
    const startDate = new Date(patient.programme_start);
    const daysSinceStart = Math.max(
      1,
      Math.floor((Date.now() - startDate.getTime()) / 86400000)
    );
    const uniqueDays = new Set(
      checkIns.map((c) => c.checked_in_at.slice(0, 10))
    ).size;
    adherence = Math.round((uniqueDays / daysSinceStart) * 100);
  }

  // Avg metrics from last 14 check-ins
  const recent14 = checkIns.slice(0, 14);
  const avg = (arr: (number | null)[]): number => {
    const vals = arr.filter((v): v is number => v !== null);
    return vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10 : 0;
  };
  const avgMetrics = {
    energy: avg(recent14.map((c) => c.energy_score)),
    sleep: avg(recent14.map((c) => c.sleep_hours)),
    digestion: avg(recent14.map((c) => c.digestion_score)),
    mood: avg(recent14.map((c) => c.mood_score)),
  };

  return (
    <PatientProfileClient
      patientId={patient.id}
      practitionerId={prac.id}
      profileId={profile?.id ?? ""}
      name={name}
      initials={initials}
      age={age}
      week={week}
      discipline={discipline}
      email={profile?.email ?? ""}
      patient={patient as Database["public"]["Tables"]["patients"]["Row"]}
      checkIns={checkIns}
      last7CheckIns={checkIns.slice(0, 7)}
      adherence={adherence}
      avgMetrics={avgMetrics}
      carePlan={carePlan}
      mealPlan={mealPlan}
      docs={docs}
    />
  );
}
