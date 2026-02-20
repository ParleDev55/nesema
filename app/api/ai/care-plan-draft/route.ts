import { NextRequest } from "next/server";
import { streamCompletion } from "@/lib/anthropic";
import { checkAndLogAiUsage } from "@/lib/ai-rate-limit";
import { adminDb, auditLog } from "@/lib/admin-api";

export const runtime = "nodejs";

const SYSTEM_PROMPT = `You are an expert holistic health practitioner assistant. Based on this patient's profile and recent progress, draft a care plan for their current week. Include: 4–6 specific weekly goals written as actionable tasks, a supplement protocol with realistic dosages and timing, and 2–3 dietary recommendations aligned with their protocol. Write as if you are the practitioner — clear, warm, and specific. Format with clear sections: Weekly Goals, Supplements, Dietary Focus. Do not include medical diagnoses or prescriptions.`;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { userMessage, practitionerId } = body;

  if (!userMessage) {
    return Response.json({ error: "Missing userMessage" }, { status: 400 });
  }

  const { userId, error } = await checkAndLogAiUsage("care-plan-draft");
  if (error === "UNAUTHORIZED") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (error === "RATE_LIMIT") {
    return Response.json({ code: "RATE_LIMIT", error: "Rate limit exceeded" }, { status: 429 });
  }

  // Log to admin audit log
  try {
    const db = adminDb();
    await auditLog(db, {
      adminId: userId,
      action: "ai_care_plan_generated",
      targetType: "care_plan",
      targetId: String(practitionerId ?? userId),
    });
  } catch {
    // non-critical — continue
  }

  const stream = await streamCompletion(SYSTEM_PROMPT, String(userMessage));

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
