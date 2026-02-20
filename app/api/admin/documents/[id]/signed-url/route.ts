import { NextResponse } from "next/server";
import { adminDb, requireAdmin } from "@/lib/admin-api";

export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    await requireAdmin();
  } catch (err) {
    return err as NextResponse;
  }

  const supabase = adminDb();
  const { id } = params;

  const { data: doc } = await supabase
    .from("documents")
    .select("storage_path")
    .eq("id", id)
    .single();

  if (!doc?.storage_path) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  const { data, error } = await supabase.storage
    .from("documents")
    .createSignedUrl(doc.storage_path, 300); // 5 min expiry

  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: error?.message ?? "Failed to create URL" }, { status: 500 });
  }

  return NextResponse.json({ url: data.signedUrl });
}
