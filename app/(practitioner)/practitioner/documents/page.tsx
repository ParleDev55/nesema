import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { DocumentsClient } from "@/components/practitioner/DocumentsClient";
import type { DocRow, PatientOption } from "@/components/practitioner/DocumentsClient";

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

  // Fetch documents
  const { data: docs } = (await supabase
    .from("documents")
    .select("id, title, document_type, is_lab_result, created_at, patient_id")
    .eq("practitioner_id", prac.id)
    .order("created_at", { ascending: false })
    .limit(100)) as { data: DocRow[] | null; error: unknown };

  const all = docs ?? [];

  // Fetch all patients for this practitioner (for selector + name lookup)
  const { data: pts } = (await supabase
    .from("patients")
    .select("id, profile_id")
    .eq("practitioner_id", prac.id)) as {
    data: { id: string; profile_id: string }[] | null; error: unknown;
  };

  const allPts = pts ?? [];
  const profileIds = allPts.map((p) => p.profile_id);

  const patientNames: Record<string, string> = {};
  const patients: PatientOption[] = [];

  if (profileIds.length > 0) {
    const { data: profiles } = (await supabase
      .from("profiles")
      .select("id, first_name, last_name")
      .in("id", profileIds)) as {
      data: { id: string; first_name: string | null; last_name: string | null }[] | null; error: unknown;
    };

    const pMap: Record<string, string> = {};
    for (const pr of profiles ?? []) {
      pMap[pr.id] = [pr.first_name, pr.last_name].filter(Boolean).join(" ") || "Patient";
    }
    for (const pt of allPts) {
      const name = pMap[pt.profile_id] ?? "Patient";
      patientNames[pt.id] = name;
      patients.push({ id: pt.id, name });
    }
  }

  return (
    <DocumentsClient
      initialDocs={all}
      patientNames={patientNames}
      patients={patients}
      pracId={prac.id}
    />
  );
}
