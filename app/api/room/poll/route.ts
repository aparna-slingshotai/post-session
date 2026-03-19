import { NextResponse } from "next/server";

import { pollRoom } from "@/lib/room";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const participantId = searchParams.get("participantId");

  if (!participantId) {
    return NextResponse.json({ error: "participantId is required" }, { status: 400 });
  }

  try {
    const result = await pollRoom(participantId);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to poll";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
