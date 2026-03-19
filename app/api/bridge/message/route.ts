import { NextResponse } from "next/server";
import { z } from "zod";

import { generateResponse } from "@/lib/anthropic";
import { getBridgeSession, getBridgeMessages, addBridgeMessage } from "@/lib/db";
import { buildBridgeSystemPrompt } from "@/lib/prompts";

const schema = z.object({
  sessionId: z.string().uuid(),
  content: z.string().min(1).max(5000),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = schema.parse(body);

    const session = getBridgeSession(parsed.sessionId);
    if (!session) throw new Error("Session not found");

    // Save user message
    addBridgeMessage(session.id, "user", parsed.content);

    // Build message history
    const history = getBridgeMessages(session.id).map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.text,
    }));

    // Generate Ash response
    const systemPrompt = buildBridgeSystemPrompt(session.transcript);
    const response = await generateResponse(systemPrompt, history);

    // Save assistant message
    addBridgeMessage(session.id, "assistant", response);

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to send message";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
