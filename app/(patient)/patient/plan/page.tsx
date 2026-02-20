import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ClipboardList, Leaf, Utensils } from "lucide-react";
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
  assigned_at: string;
};

export default async function PlanPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: patient } = (await supabase
    .from("patients")
    .select("id, practitioner_id")
    .eq("profile_id", user.id)
    .single()) as {
    data: { id: string; practitioner_id: string | null } | null;
    error: unknown;
  };

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
      .select("id, protocol_name, week_number, notes, assigned_at")
      .eq("patient_id", patient.id)
      .order("assigned_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const carePlan = cpRes.data as CarePlan | null;
  const mealPlan = mpRes.data as MealPlan | null;

  const supplements: Array<{ name?: string; dose?: string } | string> =
    Array.isArray(carePlan?.supplements)
      ? (carePlan!.supplements as Array<{ name?: string; dose?: string } | string>)
      : [];

  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto">
      <h1 className="font-serif text-3xl text-nesema-t1 mb-6">My Plan</h1>

      {!carePlan && !mealPlan ? (
        <div className="rounded-2xl border border-dashed border-nesema-sage/40 p-10 text-center">
          <ClipboardList className="mx-auto mb-3 text-nesema-sage/50" size={36} />
          <p className="text-nesema-t1 font-medium mb-1">No plan yet</p>
          <p className="text-nesema-t3 text-sm max-w-sm mx-auto">
            Your practitioner will create a personalised care plan for you
            after your initial consultation.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {carePlan && (
            <div className="rounded-2xl bg-white border border-nesema-sage/20 p-6">
              <div className="flex items-center gap-2 mb-5">
                <ClipboardList className="text-nesema-sage" size={20} />
                <h2 className="font-semibold text-nesema-t1">
                  Care Plan · Week {carePlan.week_number}
                </h2>
              </div>

              {carePlan.goals && carePlan.goals.length > 0 && (
                <div className="mb-5">
                  <p className="text-xs font-semibold tracking-widest text-nesema-t3 uppercase mb-3">
                    Goals
                  </p>
                  <ul className="space-y-2">
                    {carePlan.goals.map((g, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-2.5 text-sm text-nesema-t2"
                      >
                        <span className="mt-0.5 w-5 h-5 rounded-full bg-nesema-sage/15 flex items-center justify-center shrink-0 text-[10px] text-nesema-bark font-bold">
                          {i + 1}
                        </span>
                        {g}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {supplements.length > 0 && (
                <div className="mb-5">
                  <p className="text-xs font-semibold tracking-widest text-nesema-t3 uppercase mb-3">
                    Supplements
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {supplements.map((s, i) => {
                      const name =
                        typeof s === "string" ? s : (s?.name ?? "");
                      const dose =
                        typeof s === "object" && s?.dose ? s.dose : null;
                      return (
                        <span
                          key={i}
                          className="inline-flex items-center gap-1.5 text-xs bg-nesema-sage/10 text-nesema-bark px-3 py-1.5 rounded-full"
                        >
                          <Leaf size={11} />
                          {name}
                          {dose ? ` · ${dose}` : ""}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              {carePlan.notes && (
                <div>
                  <p className="text-xs font-semibold tracking-widest text-nesema-t3 uppercase mb-3">
                    Practitioner Notes
                  </p>
                  <p className="text-sm text-nesema-t2 whitespace-pre-wrap leading-relaxed">
                    {carePlan.notes}
                  </p>
                </div>
              )}

              <p className="mt-5 text-[11px] text-nesema-t3">
                Last updated{" "}
                {new Date(carePlan.updated_at).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </p>
            </div>
          )}

          {mealPlan && (
            <div className="rounded-2xl bg-white border border-nesema-sage/20 p-6">
              <div className="flex items-center gap-2 mb-5">
                <Utensils className="text-nesema-sage" size={20} />
                <h2 className="font-semibold text-nesema-t1">
                  Meal Plan
                  {mealPlan.protocol_name
                    ? ` · ${mealPlan.protocol_name}`
                    : ""}
                </h2>
              </div>
              {mealPlan.notes ? (
                <p className="text-sm text-nesema-t2 whitespace-pre-wrap leading-relaxed">
                  {mealPlan.notes}
                </p>
              ) : (
                <p className="text-sm text-nesema-t3">
                  No notes from your practitioner yet.
                </p>
              )}
              <p className="mt-5 text-[11px] text-nesema-t3">
                Assigned{" "}
                {new Date(mealPlan.assigned_at).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
