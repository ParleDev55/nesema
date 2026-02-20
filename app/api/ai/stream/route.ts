import { NextRequest } from "next/server";
import { streamCompletion } from "@/lib/anthropic";
import { checkAndLogAiUsage } from "@/lib/ai-rate-limit";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { systemPrompt, userMessage, feature = "stream" } =
    await req.json().catch(() => ({}));

  if (!systemPrompt || !userMessage) {
    return Response.json({ error: "Missing systemPrompt or userMessage" }, { status: 400 });
  }

  const { error } = await checkAndLogAiUsage(String(feature));
  if (error === "UNAUTHORIZED") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (error === "RATE_LIMIT") {
    return Response.json({ code: "RATE_LIMIT", error: "Rate limit exceeded" }, { status: 429 });
  }

  const stream = await streamCompletion(String(systemPrompt), String(userMessage));

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
