"use client";

import Link from "next/link";
import FlowBackground from "@/components/FlowBackground";

export default function Home() {
  return (
    <div className="relative flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden bg-[var(--surface-bg)]">
      <FlowBackground />

      <div className="relative z-10 flex w-full max-w-[900px] flex-col items-center gap-12 px-6">
        {/* Logo */}
        <svg width="55" height="26" viewBox="0 0 55 26" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M37.3906 25.056V24.928C38.5426 24.128 38.7346 22.944 38.7346 20.608V4.512C38.7346 2.592 38.5106 1.504 37.5506 0.704V0.608L42.7026 0L42.7346 0.128C42.5746 1.088 42.5106 1.92 42.5106 4.512V12.864C43.5026 10.592 45.5506 8.8 48.5586 8.8C51.6946 8.8 53.6786 10.528 53.6786 14.912V20.608C53.6786 22.944 53.8386 24.128 54.9266 24.928V25.056H48.7186V24.928C49.7106 24.128 49.8706 22.944 49.8706 20.608V15.04C49.8706 12.224 48.8466 11.04 46.8306 11.04C44.5586 11.04 43.0226 12.8 42.5106 14.976V20.608C42.5106 22.944 42.7026 24.128 43.8226 24.928V25.056H37.3906Z" fill="#AD7049"/>
          <path d="M30.3849 25.6008C25.9049 25.6008 22.9929 23.4248 22.5449 19.8728H25.9689C26.2569 22.4328 27.7289 23.9688 30.4169 23.9688C32.2729 23.9688 33.6169 23.2008 33.6169 21.7288C33.6169 20.0968 32.2729 19.5848 29.0089 18.4008C26.0009 17.3128 23.3769 16.2248 23.3769 13.2808C23.3769 10.4968 26.0009 8.80078 29.7449 8.80078C33.6809 8.80078 36.2409 10.5928 36.8489 13.6008H33.4889C33.2329 11.7128 32.0169 10.4328 29.6489 10.4328C27.8889 10.4328 26.7689 11.1688 26.7689 12.4488C26.7689 14.0808 28.3689 14.7528 31.3129 15.7768C34.7369 16.9608 37.0409 18.1128 37.0409 20.9288C37.0409 24.0648 34.1289 25.6008 30.3849 25.6008Z" fill="#AD7049"/>
          <path d="M0 24.96C1.12 24.256 2.048 23.232 2.752 21.28L9.44 3.00803C9.728 2.17603 9.728 1.47203 9.504 0.832031H13.696L21.44 21.44C22.08 23.168 22.752 24.256 23.84 24.928V25.056H16.224V24.96C17.504 24.256 17.6 23.2 16.992 21.472L15.712 17.76H6.432L5.184 21.376C4.544 23.296 4.608 24.288 5.728 24.96V25.056H0V24.96ZM7.072 15.968H15.104L11.104 4.32003L7.072 15.968Z" fill="#AD7049"/>
        </svg>

        {/* Cards */}
        <div className="flex w-full flex-col gap-6 sm:flex-row sm:gap-8">
          <Link
            href="/bridge"
            className="group flex flex-1 flex-col items-center justify-center rounded-[var(--radius-md)] bg-[var(--surface-elevated)] px-8 py-16 transition-all hover:shadow-lg sm:aspect-[4/5] sm:py-0"
          >
            <p
              className="text-[48px] italic leading-[1] tracking-[-3px] text-[var(--damson-700)] sm:text-[64px]"
              style={{ fontFamily: '"Libertinus Serif", serif' }}
            >
              Bridge
            </p>
            <p className="mt-4 max-w-[240px] text-center text-sm leading-[1.5] text-[var(--contrast-weak)]">
              Upload a transcript from your therapist and go deeper with Ash
            </p>
          </Link>

          <Link
            href="/align"
            className="group flex flex-1 flex-col items-center justify-center rounded-[var(--radius-md)] bg-[var(--surface-elevated)] px-8 py-16 transition-all hover:shadow-lg sm:aspect-[4/5] sm:py-0"
          >
            <p
              className="text-[48px] italic leading-[1] tracking-[-3px] text-[var(--wood-700)] sm:text-[64px]"
              style={{ fontFamily: '"Libertinus Serif", serif' }}
            >
              Align
            </p>
            <p className="mt-4 max-w-[240px] text-center text-sm leading-[1.5] text-[var(--contrast-weak)]">
              A guided conversation space for two people, moderated by Ash
            </p>
          </Link>
        </div>
      </div>
    </div>
  );
}
