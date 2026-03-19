"use client";

import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

import { useAutoScroll } from "@/hooks/useAutoScroll";
import { useSession } from "@/hooks/useSession";
import type { RoomPhase, RoomState } from "@/lib/types";
import BrushBackground from "@/components/BrushBackground";
import FlowBackground from "@/components/FlowBackground";
import ChatInput from "@/components/ChatInput";
import FinishedScreen from "@/components/FinishedScreen";
import MessageList from "@/components/MessageList";

const JOINER_STEPS = [
  {
    number: 1,
    bg: "bg-[var(--olive-200)]",
    numberBg: "bg-[var(--olive-700)]",
    numberText: "text-[var(--olive-200)]",
    textColor: "text-[var(--olive-700)]",
    highlight: "text-[#7c843d]",
    icon: "/icon-link.svg",
    bgImage: "/card-olive-bg.svg",
    description: (highlight: string) => (
      <>
        You&apos;ll start by joining the{" "}
        <em className={highlight}>conversation space</em>, that your partner has
        created
      </>
    ),
  },
  {
    number: 2,
    bg: "bg-[var(--wood-200)]",
    numberBg: "bg-[var(--wood-700)]",
    numberText: "text-[var(--wood-200)]",
    textColor: "text-[var(--wood-700)]",
    highlight: "text-[var(--wood-500)]",
    icon: "/icon-door.svg",
    bgImage: "/card-wood-bg.svg",
    description: (highlight: string) => (
      <>
        Then, both parties will enter their{" "}
        <em className={highlight}>private rooms</em> and answer Ash&apos;s
        questions first
      </>
    ),
  },
  {
    number: 3,
    bg: "bg-[var(--damson-200)]",
    numberBg: "bg-[var(--damson-700)]",
    numberText: "text-[var(--damson-200)]",
    textColor: "text-[var(--damson-700)]",
    highlight: "text-[#648675]",
    icon: "/icon-door-open.svg",
    bgImage: "/card-damson-bg.svg",
    description: (highlight: string) => (
      <>
        Finally, when you&apos;re both ready, Ash will bring you into the{" "}
        <em className={highlight}>commons</em> together for a guided
        conversation
      </>
    ),
  },
];

type ViewState = "splash" | "onboarding" | "name" | "joining" | "chat" | "error";

// --- Icons ---
function ChatCenteredDotsIcon({ color = "var(--contrast-subtle)" }: { color?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="7.5" r="0.625" fill={color} />
      <circle cx="5.25" cy="7.5" r="0.625" fill={color} />
      <circle cx="10.75" cy="7.5" r="0.625" fill={color} />
      <path d="M6.567 12L7.567 13.75C7.654 13.902 7.82 14 8 14C8.18 14 8.346 13.902 8.436 13.75L9.436 12H13.5C13.776 12 14 11.776 14 11.5V3.5C14 3.224 13.776 3 13.5 3H2.5C2.224 3 2 3.224 2 3.5V11.5C2 11.776 2.224 12 2.5 12H6.567Z" stroke={color} strokeWidth="0.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CheckCircleIcon({ color = "var(--olive-600)" }: { color?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="7" stroke={color} strokeWidth="1.5" />
      <path d="M5 8L7 10L11 6" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function WifiSlashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M2 14L14 2" stroke="var(--contrast-weak)" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M4 10C5.1 8.9 6.5 8.3 8 8.3" stroke="var(--contrast-weak)" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M2 7.5C3.7 5.8 5.8 4.8 8 4.8S12.3 5.8 14 7.5" stroke="var(--contrast-weak)" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="8" cy="12" r="1" fill="var(--contrast-weak)" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path d="M11.045 5.053L11.905 4.194C12.602 3.497 13.533 3.127 14.48 3.127C15.428 3.127 16.359 3.497 17.056 4.194C17.753 4.891 18.123 5.822 18.123 6.77C18.123 7.717 17.753 8.648 17.056 9.345L14.344 12.058C13.647 12.755 12.716 13.125 11.765 13.125C10.813 13.125 9.882 12.755 9.187 12.054C8.838 11.704 8.563 11.286 8.38 10.827C8.197 10.367 8.11 9.874 8.125 9.38" stroke="var(--contrast-weak)" strokeWidth="0.94" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8.955 14.947L8.095 15.806C7.398 16.503 6.467 16.873 5.517 16.873C4.566 16.873 3.635 16.503 2.939 15.802C2.258 15.119 1.876 14.193 1.877 13.228C1.878 12.262 2.261 11.337 2.944 10.655L5.656 7.942C6.353 7.245 7.284 6.875 8.232 6.875C9.18 6.875 10.111 7.245 10.808 7.942C11.159 8.292 11.435 8.71 11.619 9.171C11.802 9.631 11.89 10.125 11.875 10.62" stroke="var(--contrast-weak)" strokeWidth="0.94" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// --- Toast ---
function Toast({ message, visible }: { message: string; visible: boolean }) {
  return (
    <div
      className={`pointer-events-none fixed left-1/2 top-[128px] z-50 -translate-x-1/2 rounded-[var(--radius-pill)] bg-[var(--wood-600)] px-4 py-2.5 text-sm font-bold tracking-[-0.25px] text-[var(--wood-50)] transition-all duration-300 ${visible ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0"}`}
    >
      {message}
    </div>
  );
}

// --- Participant Status ---
function ParticipantStatus({
  name,
  ready,
  connected,
  phase,
  wrapUp,
}: {
  name: string;
  ready: boolean;
  connected: boolean;
  phase: RoomPhase;
  wrapUp?: boolean;
}) {
  // Determine icon and name color based on phase
  let icon: React.ReactNode;
  let nameColor = "text-[var(--contrast-subtle)]";

  if (phase === "commons") {
    if (wrapUp) {
      icon = <CheckCircleIcon color="var(--damson-600)" />;
      nameColor = "text-[var(--damson-600)]";
    } else {
      icon = <ChatCenteredDotsIcon />;
    }
  } else {
    // intake phase
    if (ready) {
      icon = <CheckCircleIcon color="var(--wood-500)" />;
      nameColor = "text-[var(--wood-500)]";
    } else if (!connected) {
      icon = <WifiSlashIcon />;
    } else {
      icon = <ChatCenteredDotsIcon />;
    }
  }

  return (
    <div className="flex items-center gap-0.5">
      {icon}
      <span className={`text-xs ${nameColor}`}>{name}</span>
    </div>
  );
}

// --- Top Bar ---
function TopBar({
  roomState,
  onReady,
  readyLoading,
  onWrapUp,
  wrapUpLoading,
  onCopyLink,
}: {
  roomState: RoomState;
  onReady: () => void;
  readyLoading: boolean;
  onWrapUp: () => void;
  wrapUpLoading: boolean;
  onCopyLink: () => void;
}) {
  const myReady =
    roomState.participantRole === "partner_a"
      ? roomState.partnerAReady
      : roomState.partnerBReady;

  const partnerName =
    roomState.participantRole === "partner_a"
      ? roomState.partnerBName
      : roomState.partnerAName;
  const partnerReady =
    roomState.participantRole === "partner_a"
      ? roomState.partnerBReady
      : roomState.partnerAReady;

  const myWrapUp =
    roomState.participantRole === "partner_a"
      ? roomState.partnerAWrapUp
      : roomState.partnerBWrapUp;

  const partnerWrapUp =
    roomState.participantRole === "partner_a"
      ? roomState.partnerBWrapUp
      : roomState.partnerAWrapUp;

  const roomName =
    roomState.phase === "commons"
      ? "The Commons"
      : `${roomState.participantName}'s private room`;

  return (
    <header className="flex items-center justify-between border-b-2 border-[var(--surface-elevated)] bg-[var(--surface-bg)] px-4 pb-3 pt-14 lg:pt-4">
      <div className="flex flex-col gap-1">
        <button
          type="button"
          onClick={onCopyLink}
          className="flex items-center gap-1"
        >
          <h1 className="text-lg font-bold leading-[1.2] tracking-[-0.1px] text-[var(--contrast-medium)]">
            {roomName}
          </h1>
          <LinkIcon />
        </button>
        <div className="flex items-center gap-3">
          <ParticipantStatus
            name={roomState.participantName}
            ready={myReady}
            connected={true}
            phase={roomState.phase}
            wrapUp={myWrapUp}
          />
          {partnerName ? (
            <ParticipantStatus
              name={partnerName}
              ready={partnerReady}
              connected={roomState.partnerConnected}
              phase={roomState.phase}
              wrapUp={partnerWrapUp}
            />
          ) : null}
        </div>
      </div>
      {roomState.phase === "intake" && !myReady ? (
        <button
          onClick={onReady}
          disabled={readyLoading}
          className="flex items-center gap-2 rounded-[var(--radius-pill)] bg-[var(--surface-elevated)] px-4 py-2.5 text-sm font-bold tracking-[-0.25px] text-[var(--wood-700)] disabled:opacity-60"
        >
          {readyLoading ? (
            <>
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--wood-300)] border-t-[var(--wood-700)]" />
              Preparing...
            </>
          ) : (
            "I'm Ready"
          )}
        </button>
      ) : null}
      {roomState.phase === "intake" && myReady ? (
        <div className="rounded-[var(--radius-pill)] bg-[var(--wood-600)] px-4 py-2.5 text-sm font-bold tracking-[-0.25px] text-[var(--wood-50)]">
          I&apos;m Ready
        </div>
      ) : null}
      {roomState.phase === "commons" && !myWrapUp ? (
        <button
          onClick={onWrapUp}
          disabled={wrapUpLoading}
          className="flex items-center gap-2 rounded-[var(--radius-pill)] bg-[var(--surface-elevated)] px-4 py-2.5 text-sm font-bold tracking-[-0.25px] text-[var(--damson-700)] disabled:opacity-60"
        >
          {wrapUpLoading ? (
            <>
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--damson-200)] border-t-[var(--damson-700)]" />
              Wrapping up...
            </>
          ) : (
            "Wrap Up"
          )}
        </button>
      ) : null}
      {roomState.phase === "commons" && myWrapUp ? (
        <div className="rounded-[var(--radius-pill)] bg-[var(--damson-600)] px-4 py-2.5 text-sm font-bold tracking-[-0.25px] text-[var(--wood-50)]">
          Wrap Up
        </div>
      ) : null}
    </header>
  );
}

function HandRaiseIcon({ color = "currentColor" }: { color?: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M18 12.5V10C18 9.17 17.33 8.5 16.5 8.5C15.67 8.5 15 9.17 15 10V9.5C15 8.67 14.33 8 13.5 8C12.67 8 12 8.67 12 9.5V9C12 8.17 11.33 7.5 10.5 7.5C9.67 7.5 9 8.17 9 9V4.5C9 3.67 8.33 3 7.5 3C6.67 3 6 3.67 6 4.5V14.81L4.04 12.85C3.53 12.34 2.72 12.29 2.15 12.73C1.45 13.27 1.38 14.29 1.99 14.9L6.69 19.6C7.89 20.8 9.55 21.5 11.28 21.5H14.5C17.54 21.5 20 19.04 20 16V12.5C20 11.67 19.33 11 18.5 11C17.67 11 18 11.67 18 12.5Z" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function StatusBottomBar({ message }: { message: string }) {
  return (
    <div className="border-t border-[var(--surface-elevated)] bg-[var(--surface-bg)] px-10 pb-12 pt-6 text-center lg:pb-6">
      <p className="text-base leading-[1.5] text-[var(--contrast-weak)]">{message}</p>
    </div>
  );
}

function WrapUpIcon({ color = "#A2A09A" }: { color?: string }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="shrink-0">
      <path d="M17.323 18.356l-.54-.54a.52.52 0 00-.422-.177.52.52 0 00-.422.177.52.52 0 00-.177.414c0 .158.059.297.177.415l.917.917a.57.57 0 00.472.206.57.57 0 00.472-.206l2.262-2.221a.52.52 0 00.181-.417.54.54 0 00-.181-.428.54.54 0 00-.427-.177.54.54 0 00-.427.177l-1.885 1.86zM7.135 8.865h9.73a.72.72 0 00.535-.215.72.72 0 00.215-.535.72.72 0 00-.215-.54.72.72 0 00-.535-.21h-9.73a.72.72 0 00-.535.215.72.72 0 00-.215.535c0 .213.071.391.215.535a.72.72 0 00.535.215zM18 22.558a4.53 4.53 0 01-3.187-1.314 4.53 4.53 0 01-1.313-3.186c0-1.249.438-2.311 1.313-3.187A4.53 4.53 0 0118 13.558c1.249 0 2.311.438 3.187 1.313a4.53 4.53 0 011.313 3.187 4.53 4.53 0 01-1.313 3.186A4.53 4.53 0 0118 22.558zM3.5 5.308c0-.499.177-.925.53-1.278A1.74 1.74 0 015.308 3.5h13.384c.499 0 .925.177 1.278.53.353.353.53.779.53 1.278v5.346a.72.72 0 01-.216.535.72.72 0 01-.534.215.72.72 0 01-.535-.215.72.72 0 01-.215-.535V5.308a.3.3 0 00-.096-.212.3.3 0 00-.212-.096H5.308a.3.3 0 00-.212.096.3.3 0 00-.096.212V19.05h6.21c.027.192.064.385.112.577.047.192.103.379.167.562.064.151.032.273-.095.365-.127.093-.248.088-.362-.013l-.162-.123a.47.47 0 00-.292-.112.47.47 0 00-.292.112l-.839.704a.42.42 0 01-.292.112.42.42 0 01-.293-.112l-.838-.704a.47.47 0 00-.293-.112.47.47 0 00-.292.112l-.839.704a.42.42 0 01-.292.112.42.42 0 01-.293-.112l-.838-.704a.47.47 0 00-.293-.112.47.47 0 00-.292.112L3.5 21.394V5.308zM7.135 16.635h3.625a.72.72 0 00.534-.215.72.72 0 00.216-.535.72.72 0 00-.216-.535.72.72 0 00-.534-.215H7.135a.72.72 0 00-.535.216.72.72 0 00-.215.534c0 .213.072.391.215.535a.72.72 0 00.535.215zm0-3.885h6.877a.72.72 0 00.534-.215.72.72 0 00.216-.535.72.72 0 00-.216-.535.72.72 0 00-.534-.215H7.135a.72.72 0 00-.535.216.72.72 0 00-.215.534c0 .213.072.391.215.535a.72.72 0 00.535.215z" fill={color} />
    </svg>
  );
}

function WrapUpNotice({
  partnerName,
  myWrapUp,
  partnerWrapUp,
}: {
  partnerName: string;
  myWrapUp: boolean;
  partnerWrapUp: boolean;
}) {
  const bothWrapUp = myWrapUp && partnerWrapUp;
  const onlyPartner = partnerWrapUp && !myWrapUp;
  const onlyMe = myWrapUp && !partnerWrapUp;

  return (
    <div className="flex flex-col gap-4 px-6">
      {onlyPartner && (
        <div className="flex items-start gap-2">
          <WrapUpIcon color="#A2A09A" />
          <p className="text-sm leading-[1.5] text-[var(--contrast-weak)]">
            {partnerName} has indicated that they are ready to{" "}
            <span className="font-bold">wrap up</span> this conversation. When
            you&apos;re ready to end, you can also{" "}
            <span className="font-bold">wrap up</span> to receive a conclusion.
          </p>
        </div>
      )}
      {onlyMe && (
        <div className="flex items-start gap-2">
          <WrapUpIcon color="#A2A09A" />
          <p className="text-sm leading-[1.5] text-[var(--contrast-weak)]">
            You have indicated that you are ready to{" "}
            <span className="font-bold">wrap up</span>. Waiting for{" "}
            {partnerName} to also wrap up to receive a conclusion.
          </p>
        </div>
      )}
      {bothWrapUp && (
        <div className="flex items-start gap-2">
          <WrapUpIcon color="var(--damson-500)" />
          <p className="text-sm leading-[1.5] text-[var(--damson-500)]">
            Both parties are ready to wrap up. Synthesizing this chat into a
            conclusion
          </p>
        </div>
      )}
    </div>
  );
}

export default function RoomPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = use(params);
  const searchParams = useSearchParams();
  const isCreator = searchParams.get("creator") === "1";
  const urlName = searchParams.get("name");

  const {
    state: sessionState,
    roomState,
    messages,
    typing,
    error,
    canSend,
    readyLoading,
    wrapUpLoading,
    handRaiseLoading,
    join,
    send,
    ready,
    wrapUp,
    raiseHand,
  } = useSession(roomId);
  const [view, setView] = useState<ViewState>(
    isCreator ? "joining" : "splash"
  );
  const [name, setName] = useState("");
  const [creatorName, setCreatorName] = useState<string | null>(null);
  const [toastVisible, setToastVisible] = useState(false);
  const { containerRef, scrollToBottom } = useAutoScroll(messages.length + (typing ? 1 : 0));
  const scrollRef = useRef<HTMLDivElement>(null);
  const joinAttempted = useRef(false);

  const copyRoomLink = useCallback(async () => {
    const url = `${window.location.origin}/room/${roomId}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Fallback: ignore
    }
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 2000);
  }, [roomId]);

  // Fetch room info for joiner to show creator name
  useEffect(() => {
    if (isCreator) return;
    fetch(`/api/room/info?roomId=${roomId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.creatorName) setCreatorName(data.creatorName);
      })
      .catch(() => {});
  }, [roomId, isCreator]);

  // Auto-join for creators who come from the home page with name in URL
  useEffect(() => {
    if (isCreator && urlName && !joinAttempted.current) {
      joinAttempted.current = true;
      join(urlName);
    }
  }, [isCreator, urlName, join]);

  // Sync view state with session state
  useEffect(() => {
    if (sessionState === "active" && roomState) {
      setView("chat");
    } else if (sessionState === "error") {
      setView("error");
    }
  }, [sessionState, roomState]);

  const placeholder = useMemo(() => {
    if (!roomState) return "Type a message";
    if (roomState.phase === "commons") {
      if (roomState.activeSpeaker === "either")
        return "Share what's on your mind";
      if (
        roomState.activeSpeaker &&
        roomState.activeSpeaker !== roomState.participantRole
      ) {
        return "Ash invited your partner to speak next";
      }
      return "Respond to Ash";
    }
    if (!roomState.canSend) return "Waiting for your partner...";
    return "Type a message";
  }, [roomState]);

  const myReady = useMemo(() => {
    if (!roomState || roomState.phase !== "intake") return false;
    return roomState.participantRole === "partner_a"
      ? roomState.partnerAReady
      : roomState.partnerBReady;
  }, [roomState]);

  const partnerName = useMemo(() => {
    if (!roomState) return null;
    return roomState.participantRole === "partner_a"
      ? roomState.partnerBName
      : roomState.partnerAName;
  }, [roomState]);

  const myWrapUp = useMemo(() => {
    if (!roomState || roomState.phase !== "commons") return false;
    return roomState.participantRole === "partner_a"
      ? roomState.partnerAWrapUp
      : roomState.partnerBWrapUp;
  }, [roomState]);

  const partnerWrapUp = useMemo(() => {
    if (!roomState || roomState.phase !== "commons") return false;
    return roomState.participantRole === "partner_a"
      ? roomState.partnerBWrapUp
      : roomState.partnerAWrapUp;
  }, [roomState]);

  const myHandRaised = useMemo(() => {
    if (!roomState || roomState.phase !== "commons") return false;
    return roomState.participantRole === "partner_a"
      ? roomState.partnerAHandRaised
      : roomState.partnerBHandRaised;
  }, [roomState]);

  const partnerHandRaised = useMemo(() => {
    if (!roomState || roomState.phase !== "commons") return false;
    return roomState.participantRole === "partner_a"
      ? roomState.partnerBHandRaised
      : roomState.partnerAHandRaised;
  }, [roomState]);

  // Joiner splash screen
  if (view === "splash") {
    return (
      <div className="relative flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden bg-[var(--surface-bg)]">
        <FlowBackground />

        <div className="z-10 flex flex-col items-center gap-12 text-center">
          <div className="flex flex-col items-center gap-12">
            <svg width="55" height="26" viewBox="0 0 55 26" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M37.3906 25.056V24.928C38.5426 24.128 38.7346 22.944 38.7346 20.608V4.512C38.7346 2.592 38.5106 1.504 37.5506 0.704V0.608L42.7026 0L42.7346 0.128C42.5746 1.088 42.5106 1.92 42.5106 4.512V12.864C43.5026 10.592 45.5506 8.8 48.5586 8.8C51.6946 8.8 53.6786 10.528 53.6786 14.912V20.608C53.6786 22.944 53.8386 24.128 54.9266 24.928V25.056H48.7186V24.928C49.7106 24.128 49.8706 22.944 49.8706 20.608V15.04C49.8706 12.224 48.8466 11.04 46.8306 11.04C44.5586 11.04 43.0226 12.8 42.5106 14.976V20.608C42.5106 22.944 42.7026 24.128 43.8226 24.928V25.056H37.3906Z" fill="#AD7049"/>
              <path d="M30.3849 25.6008C25.9049 25.6008 22.9929 23.4248 22.5449 19.8728H25.9689C26.2569 22.4328 27.7289 23.9688 30.4169 23.9688C32.2729 23.9688 33.6169 23.2008 33.6169 21.7288C33.6169 20.0968 32.2729 19.5848 29.0089 18.4008C26.0009 17.3128 23.3769 16.2248 23.3769 13.2808C23.3769 10.4968 26.0009 8.80078 29.7449 8.80078C33.6809 8.80078 36.2409 10.5928 36.8489 13.6008H33.4889C33.2329 11.7128 32.0169 10.4328 29.6489 10.4328C27.8889 10.4328 26.7689 11.1688 26.7689 12.4488C26.7689 14.0808 28.3689 14.7528 31.3129 15.7768C34.7369 16.9608 37.0409 18.1128 37.0409 20.9288C37.0409 24.0648 34.1289 25.6008 30.3849 25.6008Z" fill="#AD7049"/>
              <path d="M0 24.96C1.12 24.256 2.048 23.232 2.752 21.28L9.44 3.00803C9.728 2.17603 9.728 1.47203 9.504 0.832031H13.696L21.44 21.44C22.08 23.168 22.752 24.256 23.84 24.928V25.056H16.224V24.96C17.504 24.256 17.6 23.2 16.992 21.472L15.712 17.76H6.432L5.184 21.376C4.544 23.296 4.608 24.288 5.728 24.96V25.056H0V24.96ZM7.072 15.968H15.104L11.104 4.32003L7.072 15.968Z" fill="#AD7049"/>
            </svg>
            <p className="text-[128px] italic leading-[1] tracking-[-8px] text-[var(--wood-700)]" style={{ fontFamily: '"Libertinus Serif", serif' }}>
              Align
            </p>
          </div>
          <p className="max-w-[320px] text-sm leading-[1.6] text-[var(--contrast-weak)]">
            This is a demo and everything you share here disappears when you&apos;re done. This session isn&apos;t saved anywhere. Speak freely.
          </p>
        </div>

        <div className="relative z-10 mx-auto mt-12 flex w-full max-w-[354px] flex-col items-center gap-2 rounded-[var(--radius-md)] border border-[var(--surface-elevated)] bg-[var(--surface-bg)] px-0 pb-2 pt-0">
          <button
            onClick={() => setView("onboarding")}
            className="flex h-16 w-full items-center justify-center rounded-[var(--radius-md)] bg-[var(--wood-600)] text-lg font-medium tracking-[-0.25px] text-[var(--wood-50)]"
          >
            Begin
          </button>
          <p className="pb-1 text-xs text-[var(--contrast-weak)]">
            by continuing, you agree to our{" "}
            <a href="https://www.talktoash.com/privacy" target="_blank" rel="noopener noreferrer" className="font-bold underline">Privacy Policy</a>
          </p>
        </div>
      </div>
    );
  }

  // Joiner onboarding screen
  if (view === "onboarding") {
    return (
      <div className="flex min-h-[100dvh] flex-col bg-[var(--surface-bg)]">
        <div className="animate-fade-in flex flex-col gap-4 px-6 pt-20 text-center lg:mx-auto lg:max-w-[600px]">
          <h1 className="text-[26px] font-bold leading-[1.2] tracking-[-0.5px] text-[var(--contrast-strong)]">
            {creatorName
              ? `${creatorName} invited you to join their conversation space`
              : "You've been invited to join a conversation space"}
          </h1>
          <p className="text-base leading-[1.5] text-[var(--contrast-weak)]">
            Ash Align is an environment where two people can engage in a
            conversation exercise that is guided and moderated by Ash, an AI
            trained by experts in the space.
          </p>
        </div>

        <div
          ref={scrollRef}
          className="hide-scrollbar mt-12 flex h-[408px] snap-x snap-mandatory gap-4 overflow-x-auto px-6 lg:snap-none lg:justify-center lg:overflow-visible"
        >
          {JOINER_STEPS.map((s) => (
            <div
              key={s.number}
              className={`${s.bg} relative flex h-full w-[295px] shrink-0 snap-center flex-col items-center justify-end overflow-hidden rounded-[var(--radius-sm)] p-6`}
            >
              <div
                className="pointer-events-none absolute flex items-center justify-center"
                style={{ inset: "-103% -84% 23% -84%" }}
              >
                <img
                  src={s.bgImage}
                  alt=""
                  className="h-[490px] w-[627px] max-w-none rotate-[150deg]"
                />
              </div>
              <div
                className={`${s.numberBg} absolute left-1/2 top-10 flex h-10 w-10 -translate-x-1/2 items-center justify-center rounded-full`}
              >
                <span
                  className={`${s.numberText} text-lg font-medium tracking-[-0.25px]`}
                >
                  {s.number}
                </span>
              </div>
              <img
                src={s.icon}
                alt=""
                className="absolute left-1/2 top-[182px] h-24 w-24 -translate-x-1/2"
              />
              <p
                className={`${s.textColor} relative z-10 text-center text-lg font-bold leading-[1.2] tracking-[-0.1px]`}
              >
                {s.description(s.highlight)}
              </p>
            </div>
          ))}
        </div>

        <div className="mx-auto w-full max-w-[402px] px-6 pb-8 pt-8">
          <button
            onClick={() => setView("name")}
            className="flex h-16 w-full items-center justify-center rounded-[var(--radius-md)] bg-[var(--olive-600)] text-lg font-medium tracking-[-0.25px] text-[var(--olive-50)]"
          >
            Join the conversation space
          </button>
        </div>
      </div>
    );
  }

  // Joiner name input
  if (view === "name") {
    const handleJoin = async () => {
      if (!name.trim()) return;
      setView("joining");
      await join(name.trim());
    };

    return (
      <div className="relative flex min-h-[100dvh] flex-col overflow-hidden bg-[var(--surface-bg)]">

        <div className="animate-fade-in flex flex-col gap-4 px-6 pt-20 text-center lg:mx-auto lg:max-w-[600px]">
          <h1 className="font-display text-[26px] font-medium leading-[1.2] tracking-[-0.5px] text-[var(--contrast-strong)]">
            One last step
          </h1>
          <p className="text-base leading-[1.5] text-[var(--contrast-weak)]">
            Enter your name to join the conversation space and start talking to
            Ash
          </p>
        </div>

        <div className="relative z-10 mx-auto mt-16 flex w-full max-w-[323px] flex-col gap-3">
          <label className="text-xs font-medium uppercase tracking-[1.25px] text-[var(--contrast-strong)]">
            Your name{" "}
            <span className="text-[var(--contrast-weak)]">(required)</span>
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleJoin()}
            className="h-[61px] rounded-[var(--radius-sm)] border border-[var(--surface-high)] bg-transparent px-4 text-base text-[var(--contrast-strong)] outline-none focus:border-[var(--wood-600)]"
            placeholder="Enter your name"
            autoFocus
          />
          <button
            onClick={handleJoin}
            disabled={!name.trim()}
            className="flex h-16 w-full items-center justify-center rounded-[var(--radius-md)] bg-[var(--wood-600)] text-lg font-medium tracking-[-0.25px] text-[var(--wood-50)] disabled:opacity-40"
          >
            Enter my private room
          </button>
        </div>
      </div>
    );
  }

  // Loading / joining state
  if (view === "joining" || (view !== "chat" && view !== "error")) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-[var(--surface-bg)]">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--surface-elevated)] border-t-[var(--wood-600)]" />
          <p className="text-base text-[var(--contrast-weak)]">
            Entering your private room...
          </p>
        </div>
      </div>
    );
  }

  // Error state
  if (view === "error") {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-[var(--surface-bg)] px-6">
        <div className="flex flex-col items-center gap-4 text-center">
          <p className="text-lg font-medium text-[var(--contrast-strong)]">
            Something went wrong
          </p>
          <p className="text-base text-[var(--contrast-weak)]">
            {error || "Unable to join the room"}
          </p>
          <button
            onClick={() => setView("splash")}
            className="mt-4 rounded-[var(--radius-md)] bg-[var(--wood-600)] px-6 py-3 text-base font-medium text-[var(--wood-50)]"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  // Chat view
  if (!roomState) return null;

  // Conclusion view
  if (roomState.phase === "conclusion") {
    return (
      <FinishedScreen
        participantNames={[
          roomState.partnerAName || "Partner A",
          roomState.partnerBName || "Partner B",
        ]}
        summary={roomState.conclusionSummary || undefined}
      />
    );
  }

  // Detect "entering commons" — phase is commons but no messages yet (Ash generating opening)
  const commonsLoading = roomState.phase === "commons" && messages.length === 0;

  // Show typing whenever Ash is working: explicit typing state, OR commons loading
  const showTyping = typing || commonsLoading;

  // Detect "both ready, waiting for transition" — both ready in intake
  const bothReadyWaiting =
    roomState.phase === "intake" &&
    roomState.partnerAReady &&
    roomState.partnerBReady;

  // Detect "both wrapped up, waiting for conclusion" — both wrapUp but not yet conclusion phase
  const conclusionLoading =
    roomState.phase === "commons" &&
    roomState.partnerAWrapUp &&
    roomState.partnerBWrapUp;

  // Full-screen transition when entering commons or both ready
  if (commonsLoading || bothReadyWaiting) {
    return (
      <div className="relative flex h-[100dvh] flex-col items-center justify-center overflow-hidden bg-[var(--surface-bg)]">
        <BrushBackground />
        <div className="animate-fade-in relative z-10 flex flex-col items-center gap-6 text-center">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-[var(--damson-400)] [animation-delay:0ms]" />
            <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-[var(--damson-400)] [animation-delay:120ms]" />
            <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-[var(--damson-400)] [animation-delay:240ms]" />
          </div>
          <h2
            className="max-w-[280px] text-center text-[22px] font-medium leading-[1.3] tracking-[-0.5px] text-[var(--damson-600)]"
            style={{ fontFamily: "'Libre Baskerville', serif" }}
          >
            Ash is bringing you both together
          </h2>
          <p className="max-w-[300px] text-sm leading-[1.5] text-[var(--contrast-weak)]">
            Preparing your guided conversation...
          </p>
        </div>
      </div>
    );
  }

  // Full-screen transition when conclusion is being generated
  if (conclusionLoading) {
    return (
      <div className="relative flex h-[100dvh] flex-col items-center justify-center overflow-hidden bg-[var(--surface-bg)]">
        <BrushBackground />
        <div className="animate-fade-in relative z-10 flex flex-col items-center gap-6 text-center">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-[var(--damson-400)] [animation-delay:0ms]" />
            <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-[var(--damson-400)] [animation-delay:120ms]" />
            <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-[var(--damson-400)] [animation-delay:240ms]" />
          </div>
          <h2
            className="max-w-[280px] text-center text-[22px] font-medium leading-[1.3] tracking-[-0.5px] text-[var(--damson-600)]"
            style={{ fontFamily: "'Libre Baskerville', serif" }}
          >
            Wrapping up your session
          </h2>
          <p className="max-w-[300px] text-sm leading-[1.5] text-[var(--contrast-weak)]">
            Ash is preparing your summary...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] flex-col bg-[var(--surface-bg)] text-[var(--contrast-strong)]">
      <Toast message="Link copied to clipboard" visible={toastVisible} />
      <TopBar
        roomState={roomState}
        onReady={ready}
        readyLoading={readyLoading}
        onWrapUp={wrapUp}
        wrapUpLoading={wrapUpLoading}
        onCopyLink={copyRoomLink}
      />

      {error ? (
        <div className="mx-4 mt-3 rounded-[var(--radius-sm)] border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900">
          {error}
        </div>
      ) : null}

      <MessageList
        messages={messages}
        typing={showTyping}
        containerRef={containerRef}
        showAuthorLabels={roomState.phase === "commons"}
        participantRole={roomState.participantRole}
        phase={roomState.phase}
        footer={
          (partnerWrapUp || myWrapUp) &&
          roomState.phase === "commons" ? (
            <WrapUpNotice
              partnerName={partnerName || "Your partner"}
              myWrapUp={myWrapUp}
              partnerWrapUp={partnerWrapUp}
            />
          ) : null
        }
      />

      {myReady && roomState.phase === "intake" ? (
        <StatusBottomBar
          message={`When ${partnerName || "your partner"} is also ready, you'll move into the commons together`}
        />
      ) : roomState.phase === "commons" &&
        roomState.activeSpeaker &&
        roomState.activeSpeaker !== "either" &&
        roomState.activeSpeaker !== roomState.participantRole ? (
        <div className="border-t border-[var(--surface-elevated)] bg-[var(--surface-bg)] px-4 pb-12 pt-5 lg:pb-6">
          <div className="mx-auto flex max-w-[600px] items-center justify-between">
            <p className="text-base leading-[1.5] text-[var(--contrast-weak)]">
              {myHandRaised
                ? "Ash knows you'd like to speak"
                : "Ash invited your partner to speak next"}
            </p>
            {!myHandRaised ? (
              <button
                onClick={raiseHand}
                disabled={handRaiseLoading}
                className="flex shrink-0 items-center gap-2 rounded-[var(--radius-pill)] bg-[var(--surface-elevated)] px-4 py-2.5 text-sm font-bold tracking-[-0.25px] text-[var(--damson-700)] transition-opacity disabled:opacity-60"
              >
                <HandRaiseIcon color="var(--damson-700)" />
                Raise my hand
              </button>
            ) : (
              <div className="flex shrink-0 items-center gap-2 rounded-[var(--radius-pill)] bg-[var(--damson-600)] px-4 py-2.5 text-sm font-bold tracking-[-0.25px] text-[var(--wood-50)]">
                <HandRaiseIcon color="var(--wood-50)" />
                Hand raised
              </div>
            )}
          </div>
        </div>
      ) : (
        <ChatInput
          disabled={!canSend}
          placeholder={placeholder}
          phase={roomState.phase}
          onSend={(content) => {
            scrollToBottom();
            return send(content);
          }}
        />
      )}
    </div>
  );
}
