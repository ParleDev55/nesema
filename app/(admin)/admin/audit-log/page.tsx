import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { AuditLogClient } from "@/components/admin/AuditLogClient";

function adminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export const dynamic = "force-dynamic";

export default async function AdminAuditLogPage({
  searchParams,
}: {
  searchParams: { page?: string };
}) {
  const supabase = adminClient();
  const page = Math.max(1, parseInt(searchParams.page ?? "1"));
  const pageSize = 50;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data: entries, count } = await supabase
    .from("admin_audit_log")
    .select(
      `
      id,
      action,
      target_type,
      target_id,
      metadata,
      created_at,
      profiles ( first_name, last_name, email )
    `,
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range(from, to);

  const totalPages = Math.ceil((count ?? 0) / pageSize);

  return (
    <AuditLogClient
      entries={entries ?? []}
      page={page}
      totalPages={totalPages}
      totalCount={count ?? 0}
    />
  );
}
