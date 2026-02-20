import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Utensils, BookOpen, ArrowRight } from "lucide-react";

export default async function ToolkitPage() {
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

  const [mealRes, eduRes] = await Promise.all([
    supabase
      .from("meal_plans")
      .select("id", { count: "exact", head: true })
      .eq("practitioner_id", prac.id),
    supabase
      .from("education_content")
      .select("id", { count: "exact", head: true })
      .eq("practitioner_id", prac.id),
  ]);

  const mealCount = mealRes.count ?? 0;
  const eduCount = eduRes.count ?? 0;

  const tools = [
    {
      href: "/practitioner/toolkit/meal-builder",
      icon: <Utensils className="text-nesema-bark" size={22} />,
      title: "Meal Builder",
      description:
        "Create and assign personalised meal plans and nutrition protocols to your patients.",
      count: mealCount,
      countLabel: "plans assigned",
      bg: "bg-amber-50",
    },
    {
      href: "/practitioner/education",
      icon: <BookOpen className="text-nesema-bark" size={22} />,
      title: "Education Library",
      description:
        "Manage your educational content — articles, videos, and courses — and assign them to patients.",
      count: eduCount,
      countLabel: "content items",
      bg: "bg-blue-50",
    },
  ];

  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto">
      <h1 className="font-serif text-3xl text-nesema-t1 mb-2">Toolkit</h1>
      <p className="text-nesema-t3 text-sm mb-8">
        Tools for creating and assigning content to your patients.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        {tools.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className={`rounded-2xl ${t.bg} p-6 flex flex-col gap-4 hover:shadow-sm transition-shadow group`}
          >
            <div className="flex items-start justify-between">
              <div className="w-11 h-11 rounded-xl bg-white/70 flex items-center justify-center">
                {t.icon}
              </div>
              <ArrowRight
                className="text-nesema-t3 group-hover:translate-x-0.5 transition-transform"
                size={18}
              />
            </div>
            <div>
              <p className="font-semibold text-nesema-t1 mb-1">{t.title}</p>
              <p className="text-xs text-nesema-t3 leading-relaxed">
                {t.description}
              </p>
            </div>
            {t.count > 0 && (
              <p className="text-xs font-medium text-nesema-bark">
                {t.count} {t.countLabel}
              </p>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
