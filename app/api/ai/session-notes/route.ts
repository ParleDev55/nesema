import { NextRequest } from "next/server";
import { streamCompletion } from "@/lib/anthropic";
import { checkAndLogAiUsage } from "@/lib/ai-rate-limit";

export const runtime = "nodejs";

const SYSTEM_PROMPT = `You are a clinical documentation assistant for a holistic health practitioner. The practitioner has provided rough bullet-point notes from a patient session. Expand these into well-structured, professional session notes suitable for a health record. Include: session summary, patient-reported progress, clinical observations, agreed actions and next steps. Write in third person. Be concise and clinically appropriate. Do not invent details not present in the bullet points.`;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { userMessage } = body;

  if (!userMessage) {
    return Response.json({ error: "Missing userMessage" }, { status: 400 });
  }

  const { error } = await checkAndLogAiUsage("session-notes");
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
