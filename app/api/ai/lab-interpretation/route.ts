import { NextRequest } from "next/server";
import { streamCompletion } from "@/lib/anthropic";
import { checkAndLogAiUsage } from "@/lib/ai-rate-limit";

export const runtime = "nodejs";

const SYSTEM_PROMPT = `You are a clinical assistant helping a holistic health practitioner understand their patient's lab results. Based on the available information, provide a plain English interpretation of what these results may indicate in the context of this patient's health history and goals. Flag anything that appears out of range or warrants follow-up. Do not provide a medical diagnosis. Remind the practitioner to use their clinical judgement. Keep your response to 3–5 short paragraphs.`;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { userMessage } = body;

  if (!userMessage) {
    return Response.json({ error: "Missing userMessage" }, { status: 400 });
  }

  const { error } = await checkAndLogAiUsage("lab-interpretation");
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
