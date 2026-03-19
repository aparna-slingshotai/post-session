"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function SpeakerSelectPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const sessionAId = searchParams.get("sessionA");
  const sessionBId = searchParams.get("sessionB");
  const [error, setError] = useState<string | null>(null);

  const hasBackendSessions = useMemo(() => !!sessionAId && !!sessionBId, [sessionAId, sessionBId]);
  const canContinue = hasBackendSessions;

  const onPick = (which: "A" | "B") => {
    setError(null);
    if (hasBackendSessions) {
      router.push(`/post-session/${which === "A" ? sessionAId : sessionBId}`);
      return;
    }

    // Demo fallback: no backend sessions exist yet.
    router.push(`/post-session/demo?youSpeaker=${which}`);
  };

  return (
    <div className="relative min-h-[100dvh] bg-[var(--surface-bg)]">
      <div className="mx-auto flex max-w-[600px] flex-col items-center px-6 pt-[96px] pb-12 text-center">
        <h1 className="text-[32px] font-medium leading-[1.25] tracking-[-1px] text-[var(--damson-600)]" style={{ fontFamily: "'Libre Baskerville', serif" }}>
          Which speaker are you?
        </h1>
        <p className="mt-3 max-w-[420px] text-sm leading-[1.6] text-[var(--contrast-weak)]">
          Ash needs to label your voice as "You" and the therapist voice as "Therapist" so it can build the context window correctly.
        </p>

        <div className="mt-10 flex w-full flex-col gap-3">
          <button
            type="button"
            onClick={() => onPick("A")}
            disabled={false}
            className="flex h-16 items-center justify-center rounded-[var(--radius-md)] bg-[var(--wood-600)] text-lg font-bold tracking-[-0.25px] text-[var(--wood-50)] disabled:opacity-40"
          >
            I am Speaker A
          </button>
          <button
            type="button"
            onClick={() => onPick("B")}
            disabled={false}
            className="flex h-16 items-center justify-center rounded-[var(--radius-md)] bg-[var(--damson-600)] text-lg font-bold tracking-[-0.25px] text-[var(--wood-50)] disabled:opacity-40"
          >
            I am Speaker B
          </button>
        </div>

        {!hasBackendSessions ? (
          <p className="mt-6 max-w-[460px] text-sm leading-[1.6] text-[var(--contrast-weak)]">
            No backend sessions found. Showing a demo transcript instead.
          </p>
        ) : null}

        {error ? <p className="mt-6 text-sm font-medium text-red-700">{error}</p> : null}
      </div>
    </div>
  );
}

