import { NextRequest } from "next/server";
import { streamCompletion } from "@/lib/anthropic";
import { checkAndLogAiUsage } from "@/lib/ai-rate-limit";

export const runtime = "nodejs";

const SYSTEM_PROMPT = `You are a friendly nutrition assistant. Explain this patient's weekly meal plan in plain English — why these foods were chosen, how they support their health goals, and any preparation tips. Keep it conversational and encouraging. 3–4 short paragraphs. No medical claims.`;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { userMessage } = body;

  if (!userMessage) {
    return Response.json({ error: "Missing userMessage" }, { status: 400 });
  }

  const { error } = await checkAndLogAiUsage("meal-explanation");
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
