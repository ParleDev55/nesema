import { createClient } from "@/lib/supabase/server";

export const RATE_LIMIT_MAX = 20;
export const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

interface RateLimitResult {
  userId: string;
  error?: "UNAUTHORIZED" | "RATE_LIMIT";
}

/**
 * Checks the AI rate limit for the current user.
 * If within limit, logs the usage and returns the userId.
 * Returns an error string if unauthorized or rate limited.
 *
 * Note: ai_usage_log is a new table added via migration. We cast to `any`
 * because it is not yet reflected in the auto-generated types/database.ts.
 */
export async function checkAndLogAiUsage(
  feature: string
): Promise<RateLimitResult> {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { userId: "", error: "UNAUTHORIZED" };
  }

  const windowStart = new Date(
    Date.now() - RATE_LIMIT_WINDOW_MS
  ).toISOString();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  const { count } = await db
    .from("ai_usage_log")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("created_at", windowStart);

  if ((count ?? 0) >= RATE_LIMIT_MAX) {
    return { userId: user.id, error: "RATE_LIMIT" };
  }

  // Log usage (non-blocking, best-effort)
  await db.from("ai_usage_log").insert({ user_id: user.id, feature });

  return { userId: user.id };
}
