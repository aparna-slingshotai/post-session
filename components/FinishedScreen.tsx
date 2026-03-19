"use client";

import { useEffect, useMemo, useRef } from "react";
import BrushBackground from "./BrushBackground";

interface ConclusionSections {
  summary: string;
  insight: string;
  recommendations: string;
}

interface FinishedScreenProps {
  participantNames: [string, string];
  summary?: string;
}

function parseSections(
  raw: string | undefined,
  names: [string, string]
): ConclusionSections {
  if (raw) {
    try {
      // Strip markdown code fences if the model wraps them
      const cleaned = raw.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
      const parsed = JSON.parse(cleaned);
      if (parsed.summary && parsed.insight && parsed.recommendations) {
        return parsed as ConclusionSections;
      }
    } catch {
      // If the model returned plain text instead of JSON, use it as the summary
      return {
        summary: raw,
        insight: "",
        recommendations: "",
      };
    }
  }

  // Fallback
  return {
    summary: `${names[0]} and ${names[1]}, you both showed up and shared what was really on your minds. That matters.`,
    insight: `What came through is a pattern where both of you want to feel heard, but the way you each signal that need sometimes gets lost in translation.`,
    recommendations: `Try a daily two-minute check-in: one person shares how they're feeling, the other simply says what they heard. No fixing, no reacting. Just listening. You've already practiced it here. Keep going.`,
  };
}

export default function FinishedScreen({
  participantNames,
  summary,
}: FinishedScreenProps) {
  const tallyLoaded = useRef(false);

  useEffect(() => {
    if (tallyLoaded.current) return;
    tallyLoaded.current = true;

    const w = "https://tally.so/widgets/embed.js";
    const v = () => {
      if (typeof (window as any).Tally !== "undefined") {
        (window as any).Tally.loadEmbeds();
      } else {
        document
          .querySelectorAll("iframe[data-tally-src]:not([src])")
          .forEach((e: any) => {
            e.src = e.dataset.tallySrc;
          });
      }
    };
    if (typeof (window as any).Tally !== "undefined") {
      v();
    } else if (!document.querySelector(`script[src="${w}"]`)) {
      const s = document.createElement("script");
      s.src = w;
      s.onload = v;
      s.onerror = v;
      document.body.appendChild(s);
    } else {
      v();
    }
  }, []);

  const sections = useMemo(
    () => parseSections(summary, participantNames),
    [summary, participantNames]
  );

  return (
    <div className="relative min-h-[100dvh] overflow-hidden bg-[var(--surface-bg)]">
      <BrushBackground variant="alignment" />

      <div className="relative z-10 mx-auto flex max-w-[600px] flex-col items-center px-6 pt-[73px] pb-16">
        <h1
          className="max-w-[350px] text-center text-[32px] font-medium leading-[1.4] tracking-[-1px] text-[var(--damson-600)]"
          style={{ fontFamily: "'Libre Baskerville', serif" }}
        >
          Thank you for completing your session
        </h1>

        {/* Three-section summary */}
        <div className="mt-10 flex w-full flex-col gap-6">
          {/* Section 1: Summary */}
          <div
            className="w-full rounded-[var(--radius-md)] bg-[var(--surface-bg)] px-6 py-6 shadow-sm"
            style={{ backdropFilter: "blur(8px)" }}
          >
            <h2
              className="mb-3 text-sm font-medium uppercase tracking-[1.25px] text-[var(--damson-500)]"
            >
              Here&apos;s what I heard you say
            </h2>
            <p className="text-base leading-[1.7] text-[var(--contrast-strong)]">
              {sections.summary}
            </p>
          </div>

          {/* Section 2: Insight */}
          {sections.insight && (
            <div
              className="w-full rounded-[var(--radius-md)] bg-[var(--surface-bg)] px-6 py-6 shadow-sm"
              style={{ backdropFilter: "blur(8px)" }}
            >
              <h2
                className="mb-3 text-sm font-medium uppercase tracking-[1.25px] text-[var(--damson-500)]"
              >
                Here&apos;s how I would assess what you said
              </h2>
              <p className="text-base leading-[1.7] text-[var(--contrast-strong)]">
                {sections.insight}
              </p>
            </div>
          )}

          {/* Section 3: Recommendations */}
          {sections.recommendations && (
            <div
              className="w-full rounded-[var(--radius-md)] bg-[var(--surface-bg)] px-6 py-6 shadow-sm"
              style={{ backdropFilter: "blur(8px)" }}
            >
              <h2
                className="mb-3 text-sm font-medium uppercase tracking-[1.25px] text-[var(--damson-500)]"
              >
                Here&apos;s my recommendations on where to go from here
              </h2>
              <p className="text-base leading-[1.7] text-[var(--contrast-strong)]">
                {sections.recommendations}
              </p>
            </div>
          )}
        </div>

        {/* Tally feedback form */}
        <div
          className="mt-10 w-full rounded-[var(--radius-md)] bg-[var(--surface-bg)] px-6 py-6"
          style={{ backdropFilter: "blur(8px)" }}
        >
          <iframe
            data-tally-src="https://tally.so/embed/OD0lVY?alignLeft=1&hideTitle=1&transparentBackground=1&dynamicHeight=1"
            loading="lazy"
            width="100%"
            height="342"
            frameBorder="0"
            marginHeight={0}
            marginWidth={0}
            title="Ash Align Feedback"
          />
        </div>
      </div>
    </div>
  );
}
