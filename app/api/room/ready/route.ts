import { NextResponse } from "next/server";
import { z } from "zod";

import { markReady } from "@/lib/room";

const schema = z.object({
  participantId: z.string().uuid(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = schema.parse(body);
    await markReady(parsed.participantId);
    return NextResponse.json({ ok: true }, { status: 202 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to mark ready";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
