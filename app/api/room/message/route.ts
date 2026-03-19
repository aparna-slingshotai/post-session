import { NextResponse } from "next/server";
import { z } from "zod";

import { sendMessage } from "@/lib/room";

const schema = z.object({
  participantId: z.string().uuid(),
  content: z.string().min(1).max(5000),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = schema.parse(body);
    await sendMessage(parsed.participantId, parsed.content);
    return NextResponse.json({ ok: true }, { status: 202 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to send message";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
