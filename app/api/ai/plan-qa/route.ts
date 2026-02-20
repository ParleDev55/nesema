import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { checkAndLogAiUsage } from "@/lib/ai-rate-limit";

export const runtime = "nodejs";

type Message = { role: "user" | "assistant"; content: string };

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const {
    systemContext,
    messages,
  }: { systemContext: string; messages: Message[] } = body;

  if (!systemContext || !messages?.length) {
    return Response.json({ error: "Missing systemContext or messages" }, { status: 400 });
  }

  const { error } = await checkAndLogAiUsage("plan-qa");
  if (error === "UNAUTHORIZED") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (error === "RATE_LIMIT") {
    return Response.json({ code: "RATE_LIMIT", error: "Rate limit exceeded" }, { status: 429 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    const encoder = new TextEncoder();
    return new Response(
      new ReadableStream({
        start(c) {
          c.enqueue(
            encoder.encode("AI is not configured. Please contact support.")
          );
          c.close();
        },
      }),
      { headers: { "Content-Type": "text/plain; charset=utf-8" } }
    );
  }

  const systemPrompt = `You are a helpful assistant for a patient following a personalised holistic health programme. Answer their questions about their care plan, supplements, and meal plan based only on the information provided below. Be warm, clear, and encouraging. If a question falls outside the scope of their plan or requires medical advice, say so kindly and suggest they message their practitioner directly. Never invent supplement dosages or medical information not present in their plan.

${systemContext}`;

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  // Keep last 10 messages
  const history = messages.slice(-10) as Anthropic.MessageParam[];

  const stream = client.messages.stream({
    model: "claude-opus-4-6",
    max_tokens: 1024,
    system: systemPrompt,
    messages: history,
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          if (
            chunk.type === "content_block_delta" &&
            chunk.delta.type === "text_delta"
          ) {
            controller.enqueue(encoder.encode(chunk.delta.text));
          }
        }
        controller.close();
      } catch {
        controller.error(new Error("Stream failed"));
      }
    },
  });

  return new Response(readable, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
