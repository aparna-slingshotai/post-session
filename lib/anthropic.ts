import Anthropic from "@anthropic-ai/sdk";
import type { MessageParam } from "@anthropic-ai/sdk/resources/messages/messages";

const getClient = () => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("Missing ANTHROPIC_API_KEY");
  return new Anthropic({ apiKey });
};

const getModel = () => process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";

export async function generateResponse(
  system: string,
  messages: MessageParam[],
  options?: { thinking?: boolean },
): Promise<string> {
  const client = getClient();

  const useThinking = options?.thinking ?? false;

  // When extended thinking is enabled, the model's internal reasoning goes into
  // hidden "thinking" blocks. We only capture "text_delta" events below, so the
  // reasoning is never included in the returned text. This prevents the model
  // from exposing private intake notes or clinician-level deliberation to users.
  const stream = await client.messages.create({
    model: getModel(),
    max_tokens: useThinking ? 16000 : 1000,
    system,
    messages,
    stream: true,
    ...(useThinking ? { thinking: { type: "enabled" as const, budget_tokens: 10000 } } : {}),
  });

  let fullText = "";
  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      fullText += event.delta.text;
    }
  }

  return fullText;
}

export async function summarize(system: string, transcript: string): Promise<string> {
  const client = getClient();

  const response = await client.messages.create({
    model: getModel(),
    max_tokens: 300,
    system,
    messages: [{ role: "user", content: transcript }],
  });

  const firstText = response.content.find((block) => block.type === "text");
  return firstText?.type === "text" ? firstText.text.trim() : "";
}
