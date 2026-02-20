"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  Video,
  GraduationCap,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";
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

const TYPE_COLOR: Record<string, string> = {
  article: "bg-nesema-sage/10 text-nesema-sage",
  video: "bg-amber-100 text-amber-700",
  course: "bg-purple-100 text-purple-700",
};

export default function LearnPage() {
  const router = useRouter();
  const supabase = createClient();

  const [items, setItems] = useState<AssignmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/sign-in"); return; }

      const { data: patient } = (await supabase
        .from("patients")
        .select("id")
        .eq("profile_id", user.id)
        .single()) as { data: { id: string } | null; error: unknown };

      if (!patient) { router.push("/onboarding/patient"); return; }

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

      setItems(assignments ?? []);
      setLoading(false);
    }
    load();
  }, []);

  async function markComplete(assignmentId: string) {
    setCompleting(assignmentId);
    await supabase
      .from("education_assignments")
      .update({ completed_at: new Date().toISOString(), progress: 100 })
      .eq("id", assignmentId);

    setItems((prev) =>
      prev.map((a) =>
        a.id === assignmentId
          ? { ...a, completed_at: new Date().toISOString(), progress: 100 }
          : a
      )
    );
    setCompleting(null);
  }

  const todo = items.filter((a) => !a.completed_at);
  const done = items.filter((a) => !!a.completed_at);

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-nesema-sage/30 border-t-nesema-sage rounded-full animate-spin" />
      </div>
    );
  }

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
                  const type = c?.content_type ?? "article";
                  return (
                    <div
                      key={a.id}
                      className="rounded-2xl bg-white border border-nesema-sage/20 p-4 flex items-start gap-3"
                    >
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                          TYPE_COLOR[type] ?? "bg-nesema-sage/10 text-nesema-sage"
                        }`}
                      >
                        {TYPE_ICON[type] ?? <BookOpen size={16} />}
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
                      <div className="flex items-center gap-2 shrink-0 self-start">
                        {c?.url && (
                          <a
                            href={c.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-8 h-8 flex items-center justify-center border border-nesema-sage/30 rounded-lg text-nesema-bark hover:bg-nesema-sage/5"
                          >
                            <ExternalLink size={13} />
                          </a>
                        )}
                        <button
                          onClick={() => markComplete(a.id)}
                          disabled={completing === a.id}
                          className="text-xs text-nesema-bark border border-nesema-sage/30 px-3 py-1.5 rounded-full hover:bg-nesema-sage/5 transition-colors disabled:opacity-50 whitespace-nowrap"
                        >
                          {completing === a.id ? "Saving…" : "Mark done"}
                        </button>
                      </div>
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
                      {c?.url && (
                        <a
                          href={c.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-7 h-7 flex items-center justify-center text-nesema-t3"
                        >
                          <ExternalLink size={13} />
                        </a>
                      )}
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
