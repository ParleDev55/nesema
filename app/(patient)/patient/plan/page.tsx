import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { PlanPageClient } from "@/components/patient/PlanPageClient";
import type { Json } from "@/types/database";

type CarePlan = {
  id: string;
  week_number: number;
  goals: string[] | null;
  supplements: Json | null;
  notes: string | null;
  updated_at: string;
};

type MealPlan = {
  id: string;
  protocol_name: string | null;
  week_number: number | null;
  notes: string | null;
  days: Json | null;
  assigned_at: string;
};

type PatientInfo = {
  id: string;
  practitioner_id: string | null;
  diagnosed_conditions: string | null;
  allergies: string | null;
  goals: string[] | null;
  diet_type: string | null;
};

export default async function PlanPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: patient } = (await supabase
    .from("patients")
    .select("id, practitioner_id, diagnosed_conditions, allergies, goals, diet_type")
    .eq("profile_id", user.id)
    .single()) as { data: PatientInfo | null; error: unknown };

  if (!patient) redirect("/onboarding/patient");

  const [cpRes, mpRes] = await Promise.all([
    supabase
      .from("care_plans")
      .select("id, week_number, goals, supplements, notes, updated_at")
      .eq("patient_id", patient.id)
      .order("week_number", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("meal_plans")
      .select("id, protocol_name, week_number, notes, days, assigned_at")
      .eq("patient_id", patient.id)
      .order("assigned_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const carePlan = cpRes.data as CarePlan | null;
  const mealPlan = mpRes.data as MealPlan | null;

  // Build Q&A system context
  type Supp = { name?: string; dose?: string; timing?: string } | string;
  const suppList = Array.isArray(carePlan?.supplements)
    ? (carePlan!.supplements as Supp[])
        .map((s) => {
          if (typeof s === "string") return s;
          const parts = [
            s.name,
            s.dose ? `dose: ${s.dose}` : null,
            s.timing ? `timing: ${s.timing}` : null,
          ];
          return parts.filter(Boolean).join(", ");
        })
        .join("; ")
    : "None";

  const systemContext = [
    "CARE PLAN:",
    `  Week: ${carePlan?.week_number ?? "N/A"}`,
    `  Goals: ${(carePlan?.goals ?? []).join("; ") || "None"}`,
    `  Supplements: ${suppList}`,
    `  Notes: ${carePlan?.notes ?? "None"}`,
    "",
    "MEAL PLAN:",
    `  Protocol: ${mealPlan?.protocol_name ?? "Standard"}`,
    `  Notes: ${mealPlan?.notes ?? "None"}`,
    mealPlan?.days
      ? `  Days: ${JSON.stringify(mealPlan.days)}`
      : "",
    "",
    "PATIENT HEALTH INFORMATION:",
    `  Diagnosed conditions: ${patient.diagnosed_conditions ?? "None"}`,
    `  Allergies: ${patient.allergies ?? "None"}`,
    `  Goals: ${(patient.goals ?? []).join(", ") || "None"}`,
    `  Diet type: ${patient.diet_type ?? "Not specified"}`,
  ]
    .filter((l) => l !== undefined)
    .join("\n");

  return (
    <PlanPageClient
      carePlan={carePlan}
      mealPlan={mealPlan}
      patient={{
        diagnosed_conditions: patient.diagnosed_conditions,
        allergies: patient.allergies,
        goals: patient.goals,
        diet_type: patient.diet_type,
      }}
      systemContext={systemContext}
    />
  );
}
