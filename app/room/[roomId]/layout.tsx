import type { Metadata } from "next";

import { getParticipantsByRoom } from "@/lib/db";

interface LayoutProps {
  children: React.ReactNode;
  params: Promise<{ roomId: string }>;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ roomId: string }>;
}): Promise<Metadata> {
  const { roomId } = await params;

  try {
    const participants = getParticipantsByRoom(roomId);
    const creator = participants.find((p) => p.role === "partner_a");
    const creatorName = creator?.name;

    const title = creatorName
      ? `${creatorName} is inviting you to join an Ash Align session`
      : "You're invited to an Ash Align session";

    return {
      title,
      description:
        "Ash Align is a guided conversation space where two people can work through challenges together, with the help of Ash — an AI mediator.",
      openGraph: {
        title,
        description:
          "Ash Align is a guided conversation space where two people can work through challenges together, with the help of Ash — an AI mediator.",
        type: "website",
      },
    };
  } catch {
    return {
      title: "You're invited to an Ash Align session",
      description:
        "Ash Align is a guided conversation space where two people can work through challenges together, with the help of Ash — an AI mediator.",
    };
  }
}

export default function RoomLayout({ children }: LayoutProps) {
  return children;
}
