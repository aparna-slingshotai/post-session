import { NextResponse } from "next/server";
import { z } from "zod";

import { createBridgeSession } from "@/lib/db";

const schema = z.object({
  transcript: z.string().min(1).max(100000),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = schema.parse(body);
    const session = createBridgeSession(parsed.transcript);
    return NextResponse.json({ sessionId: session.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create session";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
