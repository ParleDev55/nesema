import { NextRequest } from "next/server";
import { streamCompletion } from "@/lib/anthropic";
import { checkAndLogAiUsage } from "@/lib/ai-rate-limit";

export const runtime = "nodejs";

const SYSTEM_PROMPT = `You are a warm and encouraging health coach assistant. Write a personalised weekly progress summary for a patient in a holistic health programme. Reference their actual scores — energy, sleep, mood, digestion. Highlight what went well, acknowledge any struggles with empathy, and offer one simple actionable encouragement for the coming week. Write directly to the patient using their first name. Keep it to 3 short paragraphs. Warm, human, never clinical.`;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { userMessage } = body;

  if (!userMessage) {
    return Response.json({ error: "Missing userMessage" }, { status: 400 });
  }

  const { error } = await checkAndLogAiUsage("weekly-summary");
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
