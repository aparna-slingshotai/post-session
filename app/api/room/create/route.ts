import { NextResponse } from "next/server";

import { createRoom } from "@/lib/db";

export async function POST() {
  try {
    const room = createRoom();
    return NextResponse.json({ roomId: room.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create room";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
