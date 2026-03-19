import { NextRequest, NextResponse } from "next/server";

import { getRoom, getParticipantsByRoom } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const roomId = request.nextUrl.searchParams.get("roomId");
    if (!roomId) return NextResponse.json({ error: "Missing roomId" }, { status: 400 });

    const room = getRoom(roomId);
    if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });

    const participants = getParticipantsByRoom(roomId);
    const creator = participants.find((p) => p.role === "partner_a");

    return NextResponse.json({
      phase: room.phase,
      creatorName: creator?.name || null,
      participantCount: participants.length,
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch room info" }, { status: 500 });
  }
}
