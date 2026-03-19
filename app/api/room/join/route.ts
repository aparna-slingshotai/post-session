import { NextResponse } from "next/server";
import { z } from "zod";

import { joinRoom } from "@/lib/room";

const schema = z.object({
  roomId: z.string().uuid(),
  name: z.string().min(1).max(80),
  participantId: z.string().uuid().optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = schema.parse(body);
    const result = await joinRoom(parsed.roomId, parsed.name, parsed.participantId);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to join room";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
