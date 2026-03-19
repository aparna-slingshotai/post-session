import { NextResponse } from "next/server";

import { getBridgeSession, getBridgeMessages } from "@/lib/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("sessionId");

  if (!sessionId) {
    return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
  }

  try {
    const session = getBridgeSession(sessionId);
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const messages = getBridgeMessages(sessionId);

    return NextResponse.json({
      session: { id: session.id, insight: session.insight },
      messages,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to get session";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
