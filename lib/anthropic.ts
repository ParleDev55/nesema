import Anthropic from "@anthropic-ai/sdk";

function getClient(): Anthropic {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY ?? "" });
}

/**
 * Streams a completion from Claude and returns a ReadableStream<Uint8Array>.
 * If ANTHROPIC_API_KEY is not set, returns a stream with a clear error message.
 */
export async function streamCompletion(
  systemPrompt: string,
  userMessage: string,
  maxTokens = 1024
): Promise<ReadableStream<Uint8Array>> {
  const encoder = new TextEncoder();

  if (!process.env.ANTHROPIC_API_KEY) {
    return new ReadableStream({
      start(controller) {
        controller.enqueue(
          encoder.encode(
            "ANTHROPIC_API_KEY is not configured. Please add it to your environment variables."
          )
        );
        controller.close();
      },
    });
  }

  const client = getClient();
  const stream = client.messages.stream({
    model: "claude-opus-4-6",
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  });

  return new ReadableStream({
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
      } catch (err) {
        controller.error(err);
      }
    },
  });
}
