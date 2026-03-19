"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import FlowBackground from "@/components/FlowBackground";

type Step = "splash" | "info" | "setup" | "share";

const STEPS_DATA = [
  {
    number: 1,
    bg: "bg-[var(--olive-200)]",
    numberBg: "bg-[var(--olive-700)]",
    numberText: "text-[var(--olive-200)]",
    textColor: "text-[var(--olive-700)]",
    highlight: "text-[#7c843d]",
    icon: "/icon-link.svg",
    description: (highlight: string) => (
      <>
        You&apos;ll start by creating a{" "}
        <em className={highlight}>conversation space</em>, and then share the
        link with your partner
      </>
    ),
    bgImage: "/card-olive-bg.svg",
  },
  {
    number: 2,
    bg: "bg-[var(--wood-200)]",
    numberBg: "bg-[var(--wood-700)]",
    numberText: "text-[var(--wood-200)]",
    textColor: "text-[var(--wood-700)]",
    highlight: "text-[var(--wood-500)]",
    icon: "/icon-door.svg",
    description: (highlight: string) => (
      <>
        Then, both parties will enter their{" "}
        <em className={highlight}>private rooms</em> and answer Ash&apos;s
        questions first
      </>
    ),
    bgImage: "/card-wood-bg.svg",
  },
  {
    number: 3,
    bg: "bg-[var(--damson-200)]",
    numberBg: "bg-[var(--damson-700)]",
    numberText: "text-[var(--damson-200)]",
    textColor: "text-[var(--damson-700)]",
    highlight: "text-[#648675]",
    icon: "/icon-door-open.svg",
    description: (highlight: string) => (
      <>
        Finally, when you&apos;re both ready, Ash will bring you into the{" "}
        <em className={highlight}>commons</em> together for a guided
        conversation
      </>
    ),
    bgImage: "/card-damson-bg.svg",
  },
];

export default function Home() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("splash");
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [roomId, setRoomId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const createRoom = async () => {
    setCreating(true);
    try {
      const res = await fetch("/api/room/create", { method: "POST" });
      const data = await res.json();
      if (data.roomId) {
        setRoomId(data.roomId);
        setStep("setup");
      }
    } finally {
      setCreating(false);
    }
  };

  const copyLink = async () => {
    if (!roomId) return;
    const url = `${window.location.origin}/room/${roomId}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const enterRoom = () => {
    if (!roomId || !name.trim()) return;
    const params = new URLSearchParams({ name: name.trim(), creator: "1" });
    router.push(`/room/${roomId}?${params.toString()}`);
  };

  if (step === "splash") {
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
            onClick={() => setStep("info")}
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

  if (step === "info") {
    return (
      <div className="flex min-h-[100dvh] flex-col bg-[var(--surface-bg)]">
        <div className="animate-fade-in flex flex-col gap-4 px-6 pt-20 text-center lg:mx-auto lg:max-w-[600px]">
          <h1 className="text-[26px] font-bold leading-[1.2] tracking-[-0.5px] text-[var(--contrast-strong)]">
            You&apos;re about to create a conversation space
          </h1>
          <p className="text-base leading-[1.5] text-[var(--contrast-weak)]">
            Ash Align is an environment where two people can engage in a
            conversation exercise that is guided and moderated by Ash, an AI for personal growth.
          </p>
        </div>

        <div
          ref={scrollRef}
          className="hide-scrollbar mt-12 flex h-[408px] snap-x snap-mandatory gap-4 overflow-x-auto px-6 lg:snap-none lg:justify-center lg:overflow-visible"
        >
          {STEPS_DATA.map((s) => (
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
            onClick={createRoom}
            disabled={creating}
            className="flex h-16 w-full items-center justify-center rounded-[var(--radius-md)] bg-[var(--olive-600)] text-lg font-medium tracking-[-0.25px] text-[var(--olive-50)] disabled:opacity-60"
          >
            {creating ? "Creating..." : "Create a space"}
          </button>
        </div>
      </div>
    );
  }

  // step === "setup" — Name entry
  if (step === "setup") {
    return (
      <div className="relative flex min-h-[100dvh] flex-col overflow-hidden bg-[var(--surface-bg)]">

        <div className="animate-fade-in flex flex-col gap-4 px-6 pt-20 text-center lg:mx-auto lg:max-w-[600px]">
          <h1 className="font-display text-[26px] font-medium leading-[1.2] tracking-[-0.5px] text-[var(--contrast-strong)]">
            One last step
          </h1>
          <p className="text-base leading-[1.5] text-[var(--contrast-weak)]">
            Enter your name, share your link, and then enter your private room
            to start talking to Ash
          </p>
        </div>

        <div className="relative z-10 mx-auto mt-16 flex w-full max-w-[323px] flex-1 flex-col gap-3">
          <label className="text-xs font-medium uppercase tracking-[1.25px] text-[var(--contrast-strong)]">
            Your name{" "}
            <span className="text-[var(--contrast-weak)]">(required)</span>
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && name.trim()) setStep("share");
            }}
            className="h-[61px] rounded-[var(--radius-sm)] border border-[var(--surface-high)] bg-transparent px-4 text-base text-[var(--contrast-strong)] outline-none focus:border-[var(--wood-600)]"
            placeholder="Enter your name"
            autoFocus
          />
          <div className="flex-1" />
          <button
            onClick={() => setStep("share")}
            disabled={!name.trim()}
            className="flex h-16 w-full items-center justify-center rounded-[var(--radius-md)] bg-[var(--wood-600)] text-lg font-medium tracking-[-0.25px] text-[var(--wood-50)] disabled:opacity-40"
          >
            continue
          </button>
        </div>
      </div>
    );
  }

  // step === "share" — Link sharing
  return (
    <div className="flex min-h-[100dvh] flex-col bg-[var(--surface-bg)]">
      <div className="animate-fade-in flex flex-col gap-4 px-6 pt-20 text-center lg:mx-auto lg:max-w-[600px]">
        <h1 className="font-display text-[26px] font-medium leading-[1.2] tracking-[-0.5px] text-[var(--contrast-strong)]">
          Your personalized link
        </h1>
        <p className="text-base leading-[1.5] text-[var(--contrast-weak)]">
          Copy your link, share it with your partner, and then enter your room
          to begin
        </p>
      </div>

      <div className="relative z-10 mx-auto mt-16 flex w-full max-w-[323px] flex-col gap-3">
        <p className="text-center text-base font-bold text-[var(--contrast-strong)]">
          {roomId
            ? `${typeof window !== "undefined" ? window.location.origin : ""}/room/${roomId}`
            : ""}
        </p>
        <button
          onClick={copyLink}
          className="flex h-16 w-full items-center justify-center rounded-[var(--radius-md)] border border-[var(--surface-high)] text-lg font-medium tracking-[-0.25px] text-[var(--contrast-medium)]"
        >
          {copied ? "Copied link to clipboard" : "Copy link"}
        </button>
      </div>

      <div className="flex-1" />

      <div className="mx-auto w-full max-w-[323px] px-6 pb-8">
        <button
          onClick={enterRoom}
          disabled={!name.trim()}
          className="flex h-16 w-full items-center justify-center rounded-[var(--radius-md)] bg-[var(--wood-600)] text-lg font-medium tracking-[-0.25px] text-[var(--wood-50)] disabled:opacity-40"
        >
          continue
        </button>
      </div>
    </div>
  );
}
