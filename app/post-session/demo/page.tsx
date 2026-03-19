"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { jsPDF } from "jspdf";
import ContextWindowAttachment from "@/components/ContextWindowAttachment";
import { useAutoScroll } from "@/hooks/useAutoScroll";
import MessageList from "@/components/MessageList";
import ChatInput from "@/components/ChatInput";
import type { ChatMessage as AshChatMessage } from "@/lib/types";

type DemoSpeaker = "A" | "B";

type Utterance = {
  speaker: "You" | "Therapist";
  text: string;
};

type DemoMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
};

const DEMO_UTTERANCES: Array<{ speaker: DemoSpeaker; text: string }> = [
  {
    speaker: "B",
    text: "Hi, it’s good to see you. What’s been on your mind this week?",
  },
  {
    speaker: "A",
    text: "I’ve just been… stuck. Like I know I have things to do, but I can’t seem to start anything.",
  },
  {
    speaker: "B",
    text: "“Stuck” can feel really heavy. What do you notice happens right when you try to begin something?",
  },
  {
    speaker: "A",
    text: "I overthink it. I start imagining all the ways it could go wrong, or how it won’t be good enough.",
  },
  {
    speaker: "B",
    text: "So before you even begin, there’s already a lot of pressure to get it right.",
  },
  {
    speaker: "A",
    text: "Yeah, exactly. And then I just avoid it.",
  },
  {
    speaker: "B",
    text: "That makes sense—avoidance can feel like relief in the moment. Does it last?",
  },
  {
    speaker: "A",
    text: "Not really. Then I feel guilty for not doing anything.",
  },
  {
    speaker: "B",
    text: "So it turns into a loop: pressure → avoidance → guilt → more pressure.",
  },
  {
    speaker: "A",
    text: "That’s literally it.",
  },
  {
    speaker: "B",
    text: "What do you think would happen if you lowered the bar—like doing something imperfect, just to start?",
  },
  {
    speaker: "A",
    text: "I guess… it wouldn’t be as scary. But it feels wrong somehow.",
  },
  {
    speaker: "B",
    text: "That “wrong” feeling—maybe it’s tied to a belief that things have to be done a certain way. We can explore that. For now, what’s one small step you’d be willing to try this week?",
  },
  {
    speaker: "A",
    text: "Maybe… just starting something for 10 minutes, no expectations.",
  },
  {
    speaker: "B",
    text: "That sounds like a realistic and kind place to begin. Let’s check in on how that goes next time.",
  },
];

function demoAssistantReply({
  userMessage,
  utterances,
}: {
  userMessage: string;
  utterances: Utterance[];
}) {
  const lower = userMessage.toLowerCase();
  const hasPartner = lower.includes("partner") || lower.includes("relationship");
  const hasWorry = lower.includes("worry") || lower.includes("scared") || lower.includes("anx");

  const anchor = utterances.find((u) => u.speaker === "You") || utterances[0];

  if (hasPartner) {
    return `I’m hearing the theme of wanting to stay “calm” so your partner doesn’t see how scared you feel. From your session, one small place to start could be sharing one sentence that’s true for you, then letting it land. What’s one specific moment with your partner that feels hardest right now?`;
  }

  if (hasWorry) {
    return `You described your mind going in circles and preparing for the worst, and then shutting down. A gentle next step could be noticing the moment you start to spiral, and choosing one grounding action before you withdraw. When that worry shows up, what’s the first sign you notice?`;
  }

  return `Thanks for asking. ${anchor ? `One thread I’d bring forward from your session is: “${anchor.text}”` : "One thread I’d bring forward from your session is the coping pattern you described."} If you tell me what you’re hoping changes next, I can help you reflect on it.`;
}

export default function DemoPostSessionChatPage() {
  const searchParams = useSearchParams();
  const youSpeaker = (searchParams.get("youSpeaker") === "B" ? "B" : "A") as DemoSpeaker;

  const utterances = useMemo(() => {
    return DEMO_UTTERANCES.map((u) => {
      const speaker = u.speaker === youSpeaker ? "You" : "Therapist";
      return { speaker, text: u.text };
    });
  }, [youSpeaker]);

  const initialAssistant = useMemo(() => {
    return `I’ve listened to your session. Feel free to add any additional context if you'd like.`;
  }, [utterances]);

  const [messages, setMessages] = useState<DemoMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [bridgeBegun, setBridgeBegun] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportText, setReportText] = useState("");

  const beginBridgeAssistant = useMemo(() => {
    return `I’ve listened to your session and gone through the additional context. One thing that stood out was how you say you’re fine, while inside you’re stuck on the same worry and then shut down. When that happens, you’re trying to protect yourself. What part of that feels most important to explore next?`;
  }, []);

  useEffect(() => {
    setMessages([
      {
        id: "assistant-0",
        role: "assistant",
        content: initialAssistant,
        createdAt: new Date().toISOString(),
      },
    ]);
  }, [initialAssistant]);

  const ashMessages = useMemo<AshChatMessage[]>(() => {
    return messages.map((m) => ({
      id: m.id,
      role: m.role === "user" ? ("partner_a" as const) : "assistant",
      text: m.content,
      phase: "commons",
    }));
  }, [messages]);

  const { containerRef, scrollToBottom } = useAutoScroll(ashMessages.length + (isSending ? 1 : 0));

  function handleBeginBridge() {
    if (isSending) return;
    setError(null);
    setBridgeBegun(true);
    setMessages((prev) => {
      return prev.map((m) =>
        m.id === "assistant-0" ? { ...m, content: beginBridgeAssistant } : m
      );
    });
    requestAnimationFrame(() => scrollToBottom());
  }

  async function generateBridgeReport() {
    if (isGeneratingReport) return;
    setError(null);
    setReportOpen(true);
    setIsGeneratingReport(true);
    setReportText("");

    const transcriptSnippet = utterances
      .slice(0, 8)
      .map((u) => `${u.speaker}: ${u.text}`)
      .join("\n");

    const report = [
      "EHR Bridge Report",
      `Generated: ${new Date().toLocaleString()}`,
      "",
      "Chief Concern",
      "Client reports feeling stuck, overthinking task initiation, and cycling through pressure, avoidance, and guilt.",
      "",
      "Session Highlights",
      "- Persistent initiation difficulty tied to fear of imperfection.",
      "- Insight into loop: pressure -> avoidance -> guilt -> more pressure.",
      "- Therapist reinforced compassionate pacing and reduced performance pressure.",
      "",
      "Interventions / Reflection Focus",
      "- Cognitive reframing around all-or-nothing standards.",
      "- Behavioral activation via low-bar time-bounded start (10 minutes).",
      "- Validation of protective shutdown response while identifying alternatives.",
      "",
      "Client Language Snapshot",
      transcriptSnippet,
      "",
      "Plan Until Next Session",
      "- Attempt 10-minute starts with no quality expectation.",
      "- Track early signs of overthinking before shutdown.",
      "- Bring one concrete example for next review.",
    ].join("\n");

    for (let i = 0; i < report.length; i += 6) {
      setReportText(report.slice(0, i));
      await new Promise((resolve) => setTimeout(resolve, 16));
    }
    setReportText(report);
    setIsGeneratingReport(false);
  }

  function buildReportPdfBlob(text: string) {
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const margin = 40;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const maxWidth = pageWidth - margin * 2;
    const lines = doc.splitTextToSize(text || "EHR report unavailable.", maxWidth);

    let y = margin;
    doc.setFont("times", "normal");
    doc.setFontSize(11);
    for (const line of lines) {
      if (y > pageHeight - margin) {
        doc.addPage();
        y = margin;
      }
      doc.text(line, margin, y);
      y += 16;
    }
    return doc.output("blob");
  }

  function downloadBridgeReportPdf() {
    if (!reportText.trim()) return;
    const blob = buildReportPdfBlob(reportText);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bridge-report-${new Date().toISOString().slice(0, 10)}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function shareBridgeReportPdf() {
    if (!reportText.trim()) return;
    const blob = buildReportPdfBlob(reportText);
    const file = new File(
      [blob],
      `bridge-report-${new Date().toISOString().slice(0, 10)}.pdf`,
      { type: "application/pdf" }
    );

    try {
      if (
        typeof navigator !== "undefined" &&
        "share" in navigator &&
        "canShare" in navigator &&
        (navigator as Navigator & { canShare?: (data?: ShareData) => boolean }).canShare?.({
          files: [file],
        })
      ) {
        await navigator.share({
          title: "Bridge report (EHR)",
          text: "Sharing Bridge report PDF",
          files: [file],
        });
        return;
      }
    } catch {
      // Fall through to email fallback.
    }

    // Browser mailto cannot attach files directly. We trigger download and open email draft.
    downloadBridgeReportPdf();
    const subject = encodeURIComponent("Bridge report (EHR)");
    const body = encodeURIComponent(
      "Hi,\n\nI am sharing my Bridge report PDF from Ash. I have downloaded it and attached it to this email.\n\nBest,"
    );
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  }

  const handleSend = async (content: string) => {
    if (!content || isSending) return;
    setError(null);
    // Ensure chat stays pinned to the latest messages
    scrollToBottom();
    setIsSending(true);

    const userMsg: DemoMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content,
      createdAt: new Date().toISOString(),
    };
    const assistantMsgId = `assistant-${Date.now() + 1}`;
    const assistantMsg: DemoMessage = {
      id: assistantMsgId,
      role: "assistant",
      content: "",
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);

    try {
      // Demo-only: deterministic reply without calling any external backend/model.
      const reply = demoAssistantReply({ userMessage: content, utterances });
      setMessages((prev) => prev.map((m) => (m.id === assistantMsgId ? { ...m, content: reply } : m)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to respond");
      setMessages((prev) => prev.filter((m) => m.id !== assistantMsgId));
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="flex h-[100dvh] flex-col bg-[var(--surface-bg)]">
      <div className="flex h-[60px] shrink-0 items-center justify-between border-b border-[var(--surface-elevated)] px-4">
        <div className="flex items-center gap-3">
          <svg
            width="32"
            height="15"
            viewBox="0 0 55 26"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M37.3906 25.056V24.928C38.5426 24.128 38.7346 22.944 38.7346 20.608V4.512C38.7346 2.592 38.5106 1.504 37.5506 0.704V0.608L42.7026 0L42.7346 0.128C42.5746 1.088 42.5106 1.92 42.5106 4.512V12.864C43.5026 10.592 45.5506 8.8 48.5586 8.8C51.6946 8.8 53.6786 10.528 53.6786 14.912V20.608C53.6786 22.944 53.8386 24.128 54.9266 24.928V25.056H48.7186V24.928C49.7106 24.128 49.8706 22.944 49.8706 20.608V15.04C49.8706 12.224 48.8466 11.04 46.8306 11.04C44.5586 11.04 43.0226 12.8 42.5106 14.976V20.608C42.5106 22.944 42.7026 24.128 43.8226 24.928V25.056H37.3906Z"
              fill="#AD7049"
            />
            <path
              d="M30.3849 25.6008C25.9049 25.6008 22.9929 23.4248 22.5449 19.8728H25.9689C26.2569 22.4328 27.7289 23.9688 30.4169 23.9688C32.2729 23.9688 33.6169 23.2008 33.6169 21.7288C33.6169 20.0968 32.2729 19.5848 29.0089 18.4008C26.0009 17.3128 23.3769 16.2248 23.3769 13.2808C23.3769 10.4968 26.0009 8.80078 29.7449 8.80078C33.6809 8.80078 36.2409 10.5928 36.8489 13.6008H33.4889C33.2329 11.7128 32.0169 10.4328 29.6489 10.4328C27.8889 10.4328 26.7689 11.1688 26.7689 12.4488C26.7689 14.0808 28.3689 14.7528 31.3129 15.7768C34.7369 16.9608 37.0409 18.1128 37.0409 20.9288C37.0409 24.0648 34.1289 25.6008 30.3849 25.6008Z"
              fill="#AD7049"
            />
            <path
              d="M0 24.96C1.12 24.256 2.048 23.232 2.752 21.28L9.44 3.00803C9.728 2.17603 9.728 1.47203 9.504 0.832031H13.696L21.44 21.44C22.08 23.168 22.752 24.256 23.84 24.928V25.056H16.224V24.96C17.504 24.256 17.6 23.2 16.992 21.472L15.712 17.76H6.432L5.184 21.376C4.544 23.296 4.608 24.288 5.728 24.96V25.056H0V24.96ZM7.072 15.968H15.104L11.104 4.32003L7.072 15.968Z"
              fill="#AD7049"
            />
          </svg>
          <span className="text-sm font-medium text-[var(--contrast-weak)]">Bridge</span>
        </div>
        <button
          type="button"
          onClick={generateBridgeReport}
          disabled={isGeneratingReport}
          className="flex h-9 items-center rounded-[var(--radius-pill)] bg-[var(--damson-600)] px-4 text-sm font-medium text-white disabled:opacity-40"
        >
          {isGeneratingReport ? "Generating..." : "Bridge report"}
        </button>
      </div>

      {error ? (
        <div className="shrink-0 border-b border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          {error}
        </div>
      ) : null}

      <MessageList messages={ashMessages} typing={isSending} containerRef={containerRef} participantRole="partner_a" />

      <div className="px-4 pb-2">
        <div className="mx-auto w-full max-w-[600px]">
          <ContextWindowAttachment
            title="Context window"
            utterances={utterances}
            maxPreviewUtterances={8}
            recordedAt={new Date().toISOString()}
            durationSeconds={45 * 60}
            bridgeBegun={bridgeBegun}
          />
        </div>
      </div>

      {bridgeBegun ? (
        <ChatInput
          disabled={isSending}
          placeholder="Ask Ash about your session..."
          onSend={(content) => handleSend(content)}
        />
      ) : (
        <div className="border-t-2 border-[var(--surface-elevated)] bg-[var(--surface-bg)] px-4 pb-6 pt-2 lg:border-t-0 lg:pb-4">
          <div className="relative mx-auto flex max-w-[600px] items-center gap-3">
            <button
              type="button"
              onClick={handleBeginBridge}
              disabled={isSending}
              className="mx-auto flex h-12 w-full items-center justify-center rounded-[var(--radius-pill)] bg-[var(--damson-600)] px-6 text-sm font-bold text-white disabled:opacity-40"
            >
              begin bridge
            </button>
          </div>
        </div>
      )}

      {reportOpen ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 p-4">
          <div className="flex h-[80vh] w-full max-w-[860px] flex-col rounded-[var(--radius-md)] bg-[var(--surface-bg)] shadow-xl">
            <div className="flex items-center justify-between border-b border-[var(--surface-elevated)] px-4 py-3">
              <p className="text-sm font-bold text-[var(--contrast-strong)]">Bridge report (EHR)</p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={downloadBridgeReportPdf}
                  disabled={isGeneratingReport || !reportText.trim()}
                  className="rounded-[var(--radius-pill)] bg-[var(--surface-elevated)] px-3 py-2 text-xs font-bold text-[var(--contrast-medium)] disabled:opacity-40"
                >
                  Download PDF
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void shareBridgeReportPdf();
                  }}
                  disabled={isGeneratingReport || !reportText.trim()}
                  className="rounded-[var(--radius-pill)] bg-[var(--surface-elevated)] px-3 py-2 text-xs font-bold text-[var(--contrast-medium)] disabled:opacity-40"
                >
                  Share PDF
                </button>
                <button
                  type="button"
                  onClick={() => setReportOpen(false)}
                  className="rounded-[var(--radius-pill)] bg-[var(--surface-elevated)] px-3 py-2 text-xs font-bold text-[var(--contrast-medium)]"
                >
                  Close
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <pre className="whitespace-pre-wrap text-sm leading-[1.6] text-[var(--contrast-strong)]">
                {reportText || "Preparing report..."}
              </pre>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

