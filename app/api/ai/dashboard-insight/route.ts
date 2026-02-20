import { NextRequest } from "next/server";
import { streamCompletion } from "@/lib/anthropic";
import { checkAndLogAiUsage } from "@/lib/ai-rate-limit";

export const runtime = "nodejs";

const SYSTEM_PROMPT = `You are a supportive health assistant. Based on this patient's recent check-in data, provide one specific, actionable insight they can act on today. It should relate directly to their symptoms or scores — for example, a sleep hygiene tip if sleep is low, a gentle movement suggestion if energy is low, or a positive reinforcement if scores are improving. Write 2–3 sentences maximum. Warm and encouraging tone. No medical advice.`;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { userMessage } = body;

  if (!userMessage) {
    return Response.json({ error: "Missing userMessage" }, { status: 400 });
  }

  const { error } = await checkAndLogAiUsage("dashboard-insight");
  if (error === "UNAUTHORIZED") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (error === "RATE_LIMIT") {
    return Response.json({ code: "RATE_LIMIT", error: "Rate limit exceeded" }, { status: 429 });
  }

  const stream = await streamCompletion(SYSTEM_PROMPT, String(userMessage));

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
