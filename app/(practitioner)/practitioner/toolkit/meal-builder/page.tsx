import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Utensils } from "lucide-react";
import Link from "next/link";

type MealPlan = {
  id: string;
  protocol_name: string | null;
  week_number: number | null;
  assigned_at: string;
  patient_id: string;
};

export default async function MealBuilderPage() {
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

  const { data: mealPlans } = (await supabase
    .from("meal_plans")
    .select("id, protocol_name, week_number, assigned_at, patient_id")
    .eq("practitioner_id", prac.id)
    .order("assigned_at", { ascending: false })
    .limit(50)) as { data: MealPlan[] | null; error: unknown };

  // Fetch patient names
  const patientIds = Array.from(
    new Set((mealPlans ?? []).map((m) => m.patient_id))
  );
  const patientNames: Record<string, string> = {};

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

      const pMap: Record<string, string> = {};
      for (const pr of profiles ?? []) {
        pMap[pr.id] =
          [pr.first_name, pr.last_name].filter(Boolean).join(" ") || "Patient";
      }
      for (const pt of pts ?? []) {
        patientNames[pt.id] = pMap[pt.profile_id] ?? "Patient";
      }
    }
  }

  const plans = mealPlans ?? [];

  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-serif text-3xl text-nesema-t1">Meal Builder</h1>
        <Link
          href="/practitioner/patients"
          className="text-xs text-nesema-bark border border-nesema-sage/30 px-4 py-2 rounded-full"
        >
          Assign via patient
        </Link>
      </div>

      <p className="text-sm text-nesema-t3 mb-6">
        Meal plans are created and assigned from each patient&apos;s profile.
        All assigned plans are listed below.
      </p>

      {plans.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-nesema-sage/40 p-10 text-center">
          <Utensils className="mx-auto mb-3 text-nesema-sage/50" size={36} />
          <p className="text-nesema-t1 font-medium mb-1">No meal plans yet</p>
          <p className="text-nesema-t3 text-sm max-w-sm mx-auto">
            Assign meal plans to patients from their individual profile pages.
          </p>
          <Link
            href="/practitioner/patients"
            className="mt-4 inline-block px-5 py-2 bg-nesema-bark text-white text-sm rounded-full"
          >
            View patients
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {plans.map((m) => (
            <div
              key={m.id}
              className="rounded-2xl bg-white border border-nesema-sage/20 p-4 flex items-center gap-4"
            >
              <div className="w-9 h-9 rounded-xl bg-nesema-sage/10 flex items-center justify-center text-nesema-bark shrink-0">
                <Utensils size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm text-nesema-t1">
                  {m.protocol_name ?? "Meal Plan"}
                  {m.week_number ? ` · Week ${m.week_number}` : ""}
                </p>
                <p className="text-xs text-nesema-t3 mt-0.5">
                  {patientNames[m.patient_id] ?? "Patient"} ·{" "}
                  {new Date(m.assigned_at).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </p>
              </div>
              <Link
                href={`/practitioner/patients/${m.patient_id}`}
                className="text-xs text-nesema-bark shrink-0"
              >
                View
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
