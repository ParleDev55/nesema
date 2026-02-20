import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { ContentClient } from "@/components/admin/ContentClient";

function adminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export const dynamic = "force-dynamic";

export default async function AdminContentPage() {
  const supabase = adminClient();

  const [{ data: education }, { data: documents }] = await Promise.all([
    supabase
      .from("education_content")
      .select(`
        id,
        practitioner_id,
        title,
        content_type,
        category,
        duration_mins,
        url,
        created_at,
        practitioners (
          id,
          practice_name,
          profiles!practitioners_profile_id_fkey (
            first_name,
            last_name
          )
        )
      `)
      .order("created_at", { ascending: false }),

    supabase
      .from("documents")
      .select(`
        id,
        patient_id,
        practitioner_id,
        uploaded_by,
        document_type,
        title,
        storage_path,
        is_lab_result,
        requires_pin,
        created_at
      `)
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  return <ContentClient education={education ?? []} documents={documents ?? []} />;
}
