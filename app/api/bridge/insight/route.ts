import { NextResponse } from "next/server";
import { z } from "zod";

import { generateResponse } from "@/lib/anthropic";
import { getBridgeSession, getBridgeMessages, updateBridgeSession } from "@/lib/db";
import { BRIDGE_INSIGHT_PROMPT } from "@/lib/prompts";

const schema = z.object({
  sessionId: z.string().uuid(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = schema.parse(body);

    const session = getBridgeSession(parsed.sessionId);
    if (!session) throw new Error("Session not found");

    const messages = getBridgeMessages(session.id);
    if (messages.length === 0) throw new Error("No conversation to summarize");

    const transcript = messages
      .map((m) => (m.role === "assistant" ? `Ash: ${m.text}` : `User: ${m.text}`))
      .join("\n\n");

    const rawInsight = await generateResponse(BRIDGE_INSIGHT_PROMPT, [
      { role: "user", content: transcript },
    ]);

    updateBridgeSession(session.id, { insight: rawInsight });

    return NextResponse.json({ insight: rawInsight });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to generate insights";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
