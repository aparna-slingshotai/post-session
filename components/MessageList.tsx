"use client";

import type { ReactNode, RefObject } from "react";

import type { ChatMessage, ParticipantRole, RoomPhase } from "@/lib/types";
import MessageBubble from "./MessageBubble";
import TypingIndicator from "./TypingIndicator";

interface MessageListProps {
  messages: ChatMessage[];
  typing: boolean;
  containerRef: RefObject<HTMLDivElement | null>;
  showAuthorLabels?: boolean;
  participantRole?: ParticipantRole;
  phase?: RoomPhase;
  footer?: ReactNode;
}

export default function MessageList({
  messages,
  typing,
  containerRef,
  showAuthorLabels = false,
  participantRole,
  phase,
  footer,
}: MessageListProps) {
  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto px-0 py-6">
      <div className="mx-auto flex max-w-[600px] flex-col gap-6">
        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            showAuthor={showAuthorLabels}
            participantRole={participantRole}
            phase={phase}
          />
        ))}
        {typing ? (
          <div className="flex justify-start px-4">
            <TypingIndicator />
          </div>
        ) : null}
        {footer}
      </div>
    </div>
  );
}
