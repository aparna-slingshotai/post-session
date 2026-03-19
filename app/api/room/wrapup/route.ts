import { NextResponse } from "next/server";
import { z } from "zod";

import { markWrapUp } from "@/lib/room";

const schema = z.object({
  participantId: z.string().uuid(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = schema.parse(body);
    await markWrapUp(parsed.participantId);
    return NextResponse.json({ ok: true }, { status: 202 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to wrap up";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
