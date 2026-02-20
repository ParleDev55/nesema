import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { BookOpen, Video, GraduationCap, Users } from "lucide-react";

type EduContent = {
  id: string;
  title: string;
  content_type: "article" | "video" | "course" | null;
  category: string | null;
  duration_mins: number | null;
  url: string | null;
  created_at: string;
};

const TYPE_ICON = {
  article: BookOpen,
  video: Video,
  course: GraduationCap,
} as const;

const TYPE_LABEL: Record<string, string> = {
  article: "Article",
  video: "Video",
  course: "Course",
};

export default async function EducationPage() {
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

  const { data: content } = (await supabase
    .from("education_content")
    .select(
      "id, title, content_type, category, duration_mins, url, created_at"
    )
    .eq("practitioner_id", prac.id)
    .order("created_at", { ascending: false })) as {
    data: EduContent[] | null;
    error: unknown;
  };

  const contentIds = (content ?? []).map((c) => c.id);
  const assignmentCounts: Record<string, number> = {};

  if (contentIds.length > 0) {
    const { data: assignments } = (await supabase
      .from("education_assignments")
      .select("content_id")
      .in("content_id", contentIds)) as {
      data: { content_id: string | null }[] | null;
      error: unknown;
    };

    for (const a of assignments ?? []) {
      if (a.content_id) {
        assignmentCounts[a.content_id] =
          (assignmentCounts[a.content_id] ?? 0) + 1;
      }
    }
  }

  const items = content ?? [];

  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto">
      <h1 className="font-serif text-3xl text-nesema-t1 mb-6">Education</h1>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-nesema-sage/40 p-10 text-center">
          <BookOpen className="mx-auto mb-3 text-nesema-sage/50" size={36} />
          <p className="text-nesema-t1 font-medium mb-1">
            No content in your library
          </p>
          <p className="text-nesema-t3 text-sm max-w-sm mx-auto">
            Add educational content to assign to your patients — articles,
            videos, and courses.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((c) => {
            const IconComp =
              TYPE_ICON[c.content_type ?? "article"] ?? BookOpen;
            const count = assignmentCounts[c.id] ?? 0;
            return (
              <div
                key={c.id}
                className="rounded-2xl bg-white border border-nesema-sage/20 p-4 flex items-start gap-3"
              >
                <div className="w-9 h-9 rounded-xl bg-nesema-sage/10 flex items-center justify-center text-nesema-bark shrink-0">
                  <IconComp size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-nesema-t1 truncate">
                    {c.title}
                  </p>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-nesema-t3 flex-wrap">
                    <span>
                      {TYPE_LABEL[c.content_type ?? "article"] ?? "Content"}
                    </span>
                    {c.category && (
                      <>
                        <span>·</span>
                        <span>{c.category}</span>
                      </>
                    )}
                    {c.duration_mins && (
                      <>
                        <span>·</span>
                        <span>{c.duration_mins} min</span>
                      </>
                    )}
                  </div>
                  {count > 0 && (
                    <div className="flex items-center gap-1 mt-1 text-xs text-nesema-t3">
                      <Users size={10} />
                      <span>
                        Assigned to {count} patient{count !== 1 ? "s" : ""}
                      </span>
                    </div>
                  )}
                </div>
                {c.url && (
                  <a
                    href={c.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-nesema-bark border border-nesema-sage/30 px-3 py-1.5 rounded-full shrink-0 self-start"
                  >
                    View
                  </a>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
