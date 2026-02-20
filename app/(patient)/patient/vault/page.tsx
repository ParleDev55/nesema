import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { FlaskConical, FileText } from "lucide-react";

type Doc = {
  id: string;
  title: string;
  document_type: "lab_result" | "intake_form" | "consent" | "report" | "other" | null;
  is_lab_result: boolean;
  created_at: string;
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

export default async function VaultPage() {
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

  const { data: docs } = (await supabase
    .from("documents")
    .select("id, title, document_type, is_lab_result, created_at")
    .eq("patient_id", patient.id)
    .order("created_at", { ascending: false })) as {
    data: Doc[] | null;
    error: unknown;
  };

  const all = docs ?? [];
  const labResults = all.filter(
    (d) => d.is_lab_result || d.document_type === "lab_result"
  );
  const others = all.filter(
    (d) => !d.is_lab_result && d.document_type !== "lab_result"
  );

  function DocRow({ doc }: { doc: Doc }) {
    const typeKey = doc.document_type ?? "other";
    return (
      <div className="rounded-2xl bg-white border border-nesema-sage/20 p-4 flex items-center gap-4">
        <div className="text-2xl w-10 text-center shrink-0">
          {TYPE_EMOJI[typeKey] ?? "📁"}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm text-nesema-t1 truncate">
            {doc.title}
          </p>
          <div className="flex items-center gap-2 mt-0.5 text-xs text-nesema-t3">
            <span>{TYPE_LABEL[typeKey] ?? "Other"}</span>
            <span>·</span>
            <span>
              {new Date(doc.created_at).toLocaleDateString("en-GB", {
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
  }

  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto">
      <h1 className="font-serif text-3xl text-nesema-t1 mb-6">
        Results Vault
      </h1>

      {all.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-nesema-sage/40 p-10 text-center">
          <FlaskConical className="mx-auto mb-3 text-nesema-sage/50" size={36} />
          <p className="text-nesema-t1 font-medium mb-1">No documents yet</p>
          <p className="text-nesema-t3 text-sm max-w-sm mx-auto">
            Your practitioner will upload lab results and documents here as
            your programme progresses.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {labResults.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold tracking-widest text-nesema-t3 uppercase mb-4">
                Lab Results
              </h2>
              <div className="space-y-2">
                {labResults.map((d) => (
                  <DocRow key={d.id} doc={d} />
                ))}
              </div>
            </section>
          )}
          {others.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold tracking-widest text-nesema-t3 uppercase mb-4">
                Documents
              </h2>
              <div className="space-y-2">
                {others.map((d) => (
                  <DocRow key={d.id} doc={d} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
