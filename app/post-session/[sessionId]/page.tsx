"use client";

import { useEffect, useMemo, useState } from "react";
import { jsPDF } from "jspdf";
import ContextWindowAttachment from "@/components/ContextWindowAttachment";
import MessageList from "@/components/MessageList";
import ChatInput from "@/components/ChatInput";
import { useAutoScroll } from "@/hooks/useAutoScroll";
import type { ChatMessage as AshChatMessage } from "@/lib/types";

type LabeledUtterance = {
  speaker: string;
  text: string;
};

type SessionContextWindow = {
  themes?: string[];
  therapistInsights?: string[];
  patientPatterns?: string[];
  unresolvedThreads?: string[];
  openingMessage?: string;
};

type SessionMessage = {
  id: string;
  role: string; // "user" | "assistant"
  content: string;
  createdAt?: string;
};

type SessionResponse = {
  id: string;
  recordedAt: string;
  source: string;
  rawTranscript: string;
  labeledTranscript: LabeledUtterance[];
  contextWindow: SessionContextWindow | null;
  messages: SessionMessage[];
};

const ASH_API_URL =
  process.env.NEXT_PUBLIC_ASH_EXPERTS_API_URL?.trim() || "http://localhost:3000";

function formatError(err: unknown) {
  if (!err) return "Unknown error";
  if (err instanceof Error) return err.message;
  return String(err);
}

export default function PostSessionChatPage({
  params,
}: {
  params: { sessionId: string };
}) {
  const resolvedSessionId = params.sessionId;

  const [session, setSession] = useState<SessionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [bridgeBegun, setBridgeBegun] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportText, setReportText] = useState("");

  const contextReady = !!session?.contextWindow;

  const shortBridgeIntro = useMemo(() => {
    return `I’ve listened to your session. Feel free to add any additional context if you'd like.`;
  }, []);

  const beginBridgeIntro = useMemo(() => {
    return `I’ve listened to your session and gone through the additional context. One thing that stood out was how you say you’re fine, while inside you’re stuck on the same worry and then shut down. When that happens, you’re trying to protect yourself. What part of that feels most important to explore next?`;
  }, []);

  const ashMessages = useMemo<AshChatMessage[]>(() => {
    if (!session?.messages) return [];
    const openingAssistantId = session.messages.find((m) => m.role === "assistant")?.id;
    return session.messages.map((m) => ({
      id: m.id,
      role: m.role === "user" ? ("partner_a" as const) : ("assistant" as const),
      text:
        openingAssistantId && m.id === openingAssistantId && m.role === "assistant"
          ? bridgeBegun
            ? beginBridgeIntro
            : shortBridgeIntro
          : m.content,
      phase: "intake",
    }));
  }, [session, bridgeBegun, shortBridgeIntro, beginBridgeIntro]);

  const { containerRef, scrollToBottom } = useAutoScroll(
    ashMessages.length + (isSending ? 1 : 0),
  );

  async function fetchSession() {
    if (!resolvedSessionId) return;
    setError(null);
    const res = await fetch(`${ASH_API_URL}/api/sessions/${resolvedSessionId}`);
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      throw new Error(json?.error || `Failed to load session (${res.status})`);
    }
    const json = (await res.json()) as SessionResponse;
    setSession(json);
  }

  useEffect(() => {
    if (!resolvedSessionId) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        await fetchSession();
      } catch (err) {
        if (!cancelled) setError(formatError(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [resolvedSessionId]);

  // Poll until the context window is built (backend async).
  useEffect(() => {
    if (!resolvedSessionId) return;
    if (contextReady) return;
    const interval = setInterval(async () => {
      try {
        await fetchSession();
      } catch {
        // ignore
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [resolvedSessionId, contextReady]);

  async function sendMessage(content: string) {
    if (!resolvedSessionId) return;
    setError(null);
    setIsSending(true);

    const userMsg: SessionMessage = {
      id: `tmp-user-${Date.now()}`,
      role: "user",
      content,
      createdAt: new Date().toISOString(),
    };
    const assistantMsgId = `tmp-assistant-${Date.now()}`;
    const assistantMsg: SessionMessage = {
      id: assistantMsgId,
      role: "assistant",
      content: "",
      createdAt: new Date().toISOString(),
    };

    setSession((prev) => {
      if (!prev) return prev;
      return { ...prev, messages: [...prev.messages, userMsg, assistantMsg] };
    });

    try {
      const res = await fetch(
        `${ASH_API_URL}/api/sessions/${resolvedSessionId}/messages`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ content }),
        },
      );

      if (res.status === 425) {
        throw new Error("Context window still building. Please wait a moment.");
      }

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json?.error || `Request failed (${res.status})`);
      }

      const body = res.body;
      if (!body) throw new Error("Missing response body (no streaming).");

      const reader = body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // SSE events are separated by a blank line.
        let idx;
        while ((idx = buffer.indexOf("\n\n")) !== -1) {
          const rawEvent = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);

          const lines = rawEvent.split("\n").filter(Boolean);
          for (const line of lines) {
            if (!line.startsWith("data:")) continue;
            const payloadStr = line.slice("data:".length).trim();
            let payload: any;
            try {
              payload = JSON.parse(payloadStr);
            } catch {
              continue;
            }

            if (payload.type === "text") {
              setSession((prev) => {
                if (!prev) return prev;
                return {
                  ...prev,
                  messages: prev.messages.map((m) =>
                    m.id === assistantMsgId ? { ...m, content: m.content + payload.text } : m
                  ),
                };
              });
            } else if (payload.type === "done") {
              // Sync to ensure we have the persisted assistant message.
              try {
                await fetchSession();
              } catch {
                // ignore
              }
            } else if (payload.type === "error") {
              throw new Error(payload.error || "Stream failed");
            }
          }
        }
      }
    } catch (err) {
      setError(formatError(err));
      // Remove unfinished assistant message to keep UI clean.
      setSession((prev) => {
        if (!prev) return prev;
        return { ...prev, messages: prev.messages.filter((m) => m.id !== assistantMsgId) };
      });
    } finally {
      setIsSending(false);
    }
  }

  function handleBeginBridge() {
    if (!contextReady || isSending) return;
    setError(null);
    setBridgeBegun(true);
    requestAnimationFrame(() => scrollToBottom());
  }

  async function generateBridgeReport() {
    if (isGeneratingReport || !session) return;
    setError(null);
    setReportOpen(true);
    setIsGeneratingReport(true);
    setReportText("");

    const transcriptSnippet = (session.labeledTranscript || [])
      .slice(0, 8)
      .map((u) => `${u.speaker}: ${u.text}`)
      .join("\n");

    const recentUserContent =
      [...(session.messages || [])].reverse().find((m) => m.role === "user")?.content || "";

    const report = [
      "EHR Bridge Report",
      `Generated: ${new Date().toLocaleString()}`,
      `Session ID: ${session.id}`,
      "",
      "Chief Concern",
      session.contextWindow?.themes?.[0] || "Client presents with recurring emotional/cognitive strain discussed in session.",
      "",
      "Observed Patterns",
      ...(session.contextWindow?.patientPatterns?.length
        ? session.contextWindow.patientPatterns.map((p) => `- ${p}`)
        : ["- Limited structured pattern extraction available; using transcript highlights."]),
      "",
      "Therapist Insights",
      ...(session.contextWindow?.therapistInsights?.length
        ? session.contextWindow.therapistInsights.map((p) => `- ${p}`)
        : ["- Pending finalized therapist insight extraction."]),
      "",
      "Unresolved Threads",
      ...(session.contextWindow?.unresolvedThreads?.length
        ? session.contextWindow.unresolvedThreads.map((p) => `- ${p}`)
        : ["- None explicitly captured."]),
      "",
      "Recent Patient Message",
      recentUserContent || "No follow-up user message yet.",
      "",
      "Transcript Snapshot",
      transcriptSnippet || "Transcript unavailable.",
      "",
      "Plan / Next Follow-up",
      "- Continue reflective bridge chat to clarify emotions and action steps.",
      "- Review unresolved threads in next clinical touchpoint.",
      "- Attach this report to post-session documentation workflow.",
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
          disabled={isGeneratingReport || !session}
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

      <MessageList
        messages={ashMessages}
        typing={isSending}
        containerRef={containerRef}
        participantRole="partner_a"
      />

      <div className="px-4 pb-2">
        <div className="mx-auto w-full max-w-[600px]">
          <ContextWindowAttachment
            title="Context window"
            utterances={session?.labeledTranscript}
            maxPreviewUtterances={8}
            recordedAt={session?.recordedAt}
            bridgeBegun={bridgeBegun}
          />
        </div>
      </div>

      {bridgeBegun ? (
        <ChatInput
          disabled={!contextReady || isSending}
          placeholder="Ask Ash about your session..."
          onSend={(content) => {
            scrollToBottom();
            return sendMessage(content);
          }}
        />
      ) : (
        <div className="border-t-2 border-[var(--surface-elevated)] bg-[var(--surface-bg)] px-4 pb-6 pt-2 lg:border-t-0 lg:pb-4">
          <div className="relative mx-auto flex max-w-[600px] items-center gap-3">
            <button
              type="button"
              onClick={handleBeginBridge}
              disabled={!contextReady || isSending}
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

