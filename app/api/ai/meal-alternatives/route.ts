import { NextRequest } from "next/server";
import { streamCompletion } from "@/lib/anthropic";
import { checkAndLogAiUsage } from "@/lib/ai-rate-limit";

export const runtime = "nodejs";

function buildSystemPrompt(foodName: string) {
  return `You are a nutrition assistant. Suggest 3 alternative foods that could replace ${foodName} in this patient's meal plan, keeping within their dietary restrictions. For each alternative give the name, why it works for their protocol, and roughly equivalent portion size. Be specific and practical.`;
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { userMessage, foodName } = body;

  if (!userMessage || !foodName) {
    return Response.json({ error: "Missing userMessage or foodName" }, { status: 400 });
  }

  const { error } = await checkAndLogAiUsage("meal-alternatives");
  if (error === "UNAUTHORIZED") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (error === "RATE_LIMIT") {
    return Response.json({ code: "RATE_LIMIT", error: "Rate limit exceeded" }, { status: 429 });
  }

  const stream = await streamCompletion(
    buildSystemPrompt(String(foodName)),
    String(userMessage)
  );

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
