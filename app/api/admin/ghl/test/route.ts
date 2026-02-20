import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-api";
import { testConnection } from "@/lib/ghl";

export async function POST() {
  try {
    await requireAdmin();
  } catch (err) {
    return err as NextResponse;
  }

  const result = await testConnection();
  return NextResponse.json(result);
}
