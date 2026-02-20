import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { FolderOpen, FileText } from "lucide-react";

type Doc = {
  id: string;
  title: string;
  document_type: string | null;
  is_lab_result: boolean;
  created_at: string;
  patient_id: string | null;
};

const TYPE_EMOJI: Record<string, string> = {
  lab_result: "🧪",
  intake_form: "📋",
  consent: "✍️",
  report: "📄",
  other: "📁",
};

const TYPE_LABEL: Record<string, string> = {
  lab_result: "Lab result",
  intake_form: "Intake form",
  consent: "Consent form",
  report: "Report",
  other: "Other",
};

export default async function DocumentsPage() {
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

  const { data: docs } = (await supabase
    .from("documents")
    .select("id, title, document_type, is_lab_result, created_at, patient_id")
    .eq("practitioner_id", prac.id)
    .order("created_at", { ascending: false })
    .limit(100)) as { data: Doc[] | null; error: unknown };

  const all = docs ?? [];

  // Fetch patient names
  const patientIds = Array.from(
    new Set(
      all.filter((d) => d.patient_id).map((d) => d.patient_id as string)
    )
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

  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto">
      <h1 className="font-serif text-3xl text-nesema-t1 mb-6">Documents</h1>

      {all.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-nesema-sage/40 p-10 text-center">
          <FolderOpen className="mx-auto mb-3 text-nesema-sage/50" size={36} />
          <p className="text-nesema-t1 font-medium mb-1">No documents yet</p>
          <p className="text-nesema-t3 text-sm max-w-sm mx-auto">
            Upload documents from each patient&apos;s profile page.
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
          {all.map((d) => {
            const typeKey = d.document_type ?? "other";
            return (
              <div
                key={d.id}
                className="rounded-2xl bg-white border border-nesema-sage/20 p-4 flex items-center gap-4"
              >
                <div className="text-2xl w-10 text-center shrink-0">
                  {d.is_lab_result ? "🧪" : (TYPE_EMOJI[typeKey] ?? "📁")}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-nesema-t1 truncate">
                    {d.title}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-nesema-t3 flex-wrap">
                    {d.patient_id && (
                      <>
                        <Link
                          href={`/practitioner/patients/${d.patient_id}`}
                          className="text-nesema-bark hover:underline"
                        >
                          {patientNames[d.patient_id] ?? "Patient"}
                        </Link>
                        <span>·</span>
                      </>
                    )}
                    <span>
                      {d.is_lab_result
                        ? "Lab result"
                        : (TYPE_LABEL[typeKey] ?? "Other")}
                    </span>
                    <span>·</span>
                    <span>
                      {new Date(d.created_at).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                </div>
                <FileText className="text-nesema-t3 shrink-0" size={16} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
