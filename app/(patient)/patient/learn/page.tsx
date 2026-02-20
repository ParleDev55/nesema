import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { BookOpen, Video, GraduationCap, CheckCircle2 } from "lucide-react";
import type React from "react";

type ContentRow = {
  id: string;
  title: string;
  content_type: "article" | "video" | "course" | null;
  category: string | null;
  duration_mins: number | null;
  url: string | null;
};

type AssignmentRow = {
  id: string;
  content_id: string | null;
  assigned_at: string;
  completed_at: string | null;
  progress: number;
  education_content: ContentRow | null;
};

const TYPE_ICON: Record<string, React.ReactNode> = {
  article: <BookOpen size={16} />,
  video: <Video size={16} />,
  course: <GraduationCap size={16} />,
};

export default async function LearnPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: patient } = (await supabase
    .from("patients")
    .select("id")
    .eq("profile_id", user.id)
    .single()) as { data: { id: string } | null; error: unknown };

  if (!patient) redirect("/onboarding/patient");

  const { data: assignments } = (await supabase
    .from("education_assignments")
    .select(
      "id, content_id, assigned_at, completed_at, progress, education_content:content_id(id, title, content_type, category, duration_mins, url)"
    )
    .eq("patient_id", patient.id)
    .order("assigned_at", { ascending: false })) as {
    data: AssignmentRow[] | null;
    error: unknown;
  };

  const items = assignments ?? [];
  const todo = items.filter((a) => !a.completed_at);
  const done = items.filter((a) => !!a.completed_at);

  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto">
      <h1 className="font-serif text-3xl text-nesema-t1 mb-6">Learn</h1>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-nesema-sage/40 p-10 text-center">
          <BookOpen className="mx-auto mb-3 text-nesema-sage/50" size={36} />
          <p className="text-nesema-t1 font-medium mb-1">
            No content assigned yet
          </p>
          <p className="text-nesema-t3 text-sm max-w-sm mx-auto">
            Your practitioner will assign educational articles, videos and
            courses here.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {todo.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold tracking-widest text-nesema-t3 uppercase mb-4">
                Assigned
              </h2>
              <div className="space-y-3">
                {todo.map((a) => {
                  const c = a.education_content;
                  return (
                    <div
                      key={a.id}
                      className="rounded-2xl bg-white border border-nesema-sage/20 p-4 flex items-start gap-3"
                    >
                      <div className="w-9 h-9 rounded-xl bg-nesema-sage/10 flex items-center justify-center text-nesema-bark shrink-0">
                        {TYPE_ICON[c?.content_type ?? "article"] ?? (
                          <BookOpen size={16} />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-nesema-t1">
                          {c?.title ?? "Content"}
                        </p>
                        <div className="flex items-center gap-3 mt-0.5 text-xs text-nesema-t3">
                          {c?.category && <span>{c.category}</span>}
                          {c?.duration_mins && (
                            <span>{c.duration_mins} min</span>
                          )}
                        </div>
                        {a.progress > 0 && (
                          <div className="mt-2">
                            <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-nesema-sage rounded-full"
                                style={{ width: `${a.progress}%` }}
                              />
                            </div>
                            <p className="text-[10px] text-nesema-t3 mt-0.5">
                              {a.progress}% complete
                            </p>
                          </div>
                        )}
                      </div>
                      {c?.url && (
                        <a
                          href={c.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-nesema-bark border border-nesema-sage/30 px-3 py-1.5 rounded-full shrink-0 self-start"
                        >
                          Open
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {done.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold tracking-widest text-nesema-t3 uppercase mb-4">
                Completed
              </h2>
              <div className="space-y-2">
                {done.map((a) => {
                  const c = a.education_content;
                  return (
                    <div
                      key={a.id}
                      className="rounded-2xl bg-white border border-nesema-sage/10 p-4 flex items-center gap-3 opacity-70"
                    >
                      <CheckCircle2
                        className="text-nesema-sage shrink-0"
                        size={18}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-nesema-t1 truncate">
                          {c?.title ?? "Content"}
                        </p>
                        {a.completed_at && (
                          <p className="text-xs text-nesema-t3">
                            Completed{" "}
                            {new Date(a.completed_at).toLocaleDateString(
                              "en-GB",
                              { day: "numeric", month: "short" }
                            )}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
