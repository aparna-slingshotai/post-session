"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import ChatInput from "@/components/ChatInput";
import MessageList from "@/components/MessageList";
import BrushBackground from "@/components/BrushBackground";
import type { BridgeMessage } from "@/lib/db";

type Step = "upload" | "chat" | "insight";

interface ContextItem {
  id: string;
  name: string;
  content: string;
  whatIsThis: string;
  summary: string;
  whyImportant: string[];
  whatToIgnore: string;
  analyzing?: boolean;
}

interface InsightSections {
  themes: string;
  patterns: string;
  takeaways: string;
}

function parseInsight(raw: string): InsightSections {
  try {
    const cleaned = raw.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
    const parsed = JSON.parse(cleaned);
    if (parsed.themes && parsed.patterns && parsed.takeaways) {
      return parsed as InsightSections;
    }
  } catch {
    // fallback
  }
  return { themes: raw, patterns: "", takeaways: "" };
}

function buildTranscriptFromItems(items: ContextItem[]): string {
  return items
    .map((item) => {
      let section = `=== ${item.whatIsThis || item.name} ===\n${item.content}`;
      if (item.whyImportant.length > 0) section += `\n\nKey themes:\n${item.whyImportant.map((b) => `- ${b}`).join("\n")}`;
      if (item.whatToIgnore.trim()) section += `\nIgnore: ${item.whatToIgnore}`;
      return section;
    })
    .join("\n\n");
}

export default function BridgePage() {
  const [step, setStep] = useState<Step>("upload");
  const [items, setItems] = useState<ContextItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingFields, setEditingFields] = useState<Record<string, Set<string>>>({});
  const [dragging, setDragging] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<BridgeMessage[]>([]);
  const [typing, setTyping] = useState(false);
  const [insightData, setInsightData] = useState<InsightSections | null>(null);
  const [generatingInsight, setGeneratingInsight] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const pasteAreaRef = useRef<HTMLTextAreaElement>(null);

  const analyzeItem = useCallback((id: string, content: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, analyzing: true } : item)),
    );
    fetch("/api/bridge/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: content.slice(0, 10000) }),
    })
      .then((res) => res.json())
      .then((data) => {
        const bullets = Array.isArray(data.whyImportant) ? data.whyImportant : [];
        setItems((prev) =>
          prev.map((item) =>
            item.id === id
              ? {
                  ...item,
                  whatIsThis: data.whatIsThis || "",
                  summary: data.summary || "",
                  whyImportant: bullets,
                  analyzing: false,
                }
              : item,
          ),
        );
      })
      .catch(() => {
        setItems((prev) =>
          prev.map((item) => (item.id === id ? { ...item, analyzing: false } : item)),
        );
      });
  }, []);

  const addItemWithAnalysis = useCallback(
    (name: string, content: string) => {
      const id = crypto.randomUUID();
      setItems((prev) => [
        ...prev,
        { id, name, content, whatIsThis: "", summary: "", whyImportant: [], whatToIgnore: "", analyzing: true },
      ]);
      setSelectedId(id);
      analyzeItem(id, content);
    },
    [analyzeItem],
  );

  const addFiles = useCallback(
    (files: FileList | File[]) => {
      Array.from(files).forEach((file) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const content = e.target?.result as string;
          addItemWithAnalysis(file.name, content);
        };
        reader.readAsText(file);
      });
    },
    [addItemWithAnalysis],
  );

  const handleFileInput = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      if (event.target.files) addFiles(event.target.files);
      event.target.value = "";
    },
    [addFiles],
  );

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      setDragging(false);
      if (event.dataTransfer.files.length) addFiles(event.dataTransfer.files);
    },
    [addFiles],
  );

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    setDragging(true);
  }, []);

  const handleDragLeave = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    setDragging(false);
  }, []);

  // Native paste handler for the drop zone (Cmd+V)
  const handleNativePaste = useCallback(
    (event: React.ClipboardEvent) => {
      const text = event.clipboardData.getData("text/plain");
      if (text.trim()) {
        event.preventDefault();
        addItemWithAnalysis("Pasted from clipboard", text);
      }
    },
    [addItemWithAnalysis],
  );

  const updateItem = useCallback(
    (id: string, field: keyof ContextItem, value: string) => {
      setItems((prev) =>
        prev.map((item) => {
          if (item.id !== id) return item;
          if (field === "whyImportant") {
            return { ...item, whyImportant: value.split("\n").filter((l) => l.trim()) };
          }
          return { ...item, [field]: value };
        }),
      );
    },
    [],
  );

  const removeItem = useCallback(
    (id: string) => {
      setItems((prev) => prev.filter((item) => item.id !== id));
      if (selectedId === id) setSelectedId(null);
    },
    [selectedId],
  );

  const selectedItem = items.find((i) => i.id === selectedId);
  const sidebarRef = useRef<HTMLDivElement>(null);

  // Close sidebar when clicking outside it and outside file cards
  useEffect(() => {
    if (!selectedId) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // Don't close if clicking inside sidebar
      if (sidebarRef.current?.contains(target)) return;
      // Don't close if clicking a file card (they have data-card attribute)
      if (target.closest("[data-card]")) return;
      setSelectedId(null);
      setEditingFields({});
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [selectedId]);

  const isFieldEditing = (id: string, field: string) =>
    editingFields[id]?.has(field) ?? false;

  const toggleFieldEditing = useCallback((id: string, field: string) => {
    setEditingFields((prev) => {
      const current = prev[id] ?? new Set<string>();
      const next = new Set(current);
      if (next.has(field)) next.delete(field);
      else next.add(field);
      return { ...prev, [id]: next };
    });
  }, []);

  const handleStartChat = async () => {
    if (items.length === 0) return;
    const transcript = buildTranscriptFromItems(items);

    try {
      const res = await fetch("/api/bridge/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript }),
      });
      const data = await res.json();
      if (data.sessionId) {
        setSessionId(data.sessionId);
        setStep("chat");

        setTyping(true);
        const msgRes = await fetch("/api/bridge/message", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: data.sessionId,
            content:
              "I've shared my therapy transcript and context. I'd like to explore it with you.",
          }),
        });

        if (msgRes.ok) {
          const sessionRes = await fetch(
            `/api/bridge/session?sessionId=${data.sessionId}`,
          );
          const sessionData = await sessionRes.json();
          setMessages(sessionData.messages || []);
        }
        setTyping(false);
      }
    } catch {
      setTyping(false);
    }
  };

  const handleSend = async (content: string) => {
    if (!sessionId) return;

    const optimistic: BridgeMessage = {
      id: crypto.randomUUID(),
      role: "user",
      text: content,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    setTyping(true);

    try {
      await fetch("/api/bridge/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, content }),
      });

      const res = await fetch(`/api/bridge/session?sessionId=${sessionId}`);
      const data = await res.json();
      setMessages(data.messages || []);
    } catch {
      // Keep optimistic message
    }
    setTyping(false);
  };

  const handleCollectInsights = async () => {
    if (!sessionId) return;
    setGeneratingInsight(true);

    try {
      const res = await fetch("/api/bridge/insight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      const data = await res.json();
      if (data.insight) {
        setInsightData(parseInsight(data.insight));
        setStep("insight");
      }
    } catch {
      // stay on chat
    }
    setGeneratingInsight(false);
  };

  // ─── Upload Step ───
  if (step === "upload") {
    // No items yet: centered drop zone
    if (items.length === 0) {
      return (
        <div className="flex min-h-[100dvh] flex-col bg-[var(--surface-bg)] px-6">
          <div className="animate-fade-in flex flex-1 flex-col items-center pt-12">
            <div className="flex flex-col items-center gap-3">
              <h1
                className="text-[40px] font-medium leading-[1.2] tracking-[-1px] text-[var(--contrast-strong)]"
                style={{ fontFamily: "'Libre Baskerville', serif" }}
              >
                My Context
              </h1>
              <p className="max-w-[380px] text-center text-sm leading-[1.6] text-[var(--contrast-weak)]">
                Begin by adding your context, you can either drag files, click
                the plus button to upload, or paste any relevant information
                directly into the box
              </p>
            </div>

            <div
              ref={dropZoneRef}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              className={`relative mt-8 flex h-[400px] w-[300px] flex-col rounded-[var(--radius-md)] border-[3px] border-dashed transition-colors ${
                dragging
                  ? "border-[var(--damson-600)] bg-[var(--damson-200)]"
                  : "border-[var(--surface-high)] bg-transparent"
              }`}
            >
              <textarea
                ref={pasteAreaRef}
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder="Start typing or paste to upload"
                className="flex-1 resize-none bg-transparent px-4 pt-4 text-sm leading-[1.6] text-[var(--contrast-strong)] outline-none placeholder:text-[var(--contrast-weak)]"
              />
              <div className="flex items-center px-3 pb-3">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--surface-elevated)] text-[var(--contrast-medium)] shadow-sm hover:bg-[var(--surface-high)]"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path d="M12 5V19M5 12H19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.md,.text,.pdf"
              multiple
              onChange={handleFileInput}
              className="hidden"
            />
          </div>

          <div className="pb-8 pt-4">
            <button
              onClick={() => {
                if (pasteText.trim()) {
                  addItemWithAnalysis("Pasted from clipboard", pasteText);
                  setPasteText("");
                }
              }}
              disabled={!pasteText.trim() && items.length === 0}
              className="flex h-16 w-[300px] items-center justify-center rounded-[var(--radius-pill)] bg-[var(--damson-500)] text-lg font-medium tracking-[-0.25px] text-[var(--damson-200)] disabled:opacity-40"
            >
              continue
            </button>
          </div>
        </div>
      );
    }

    // Has items: show file cards + drop zone + optional sidebar
    return (
      <div className="flex min-h-[100dvh] bg-[var(--surface-bg)]">
        {/* Main area: file cards + drop zone */}
        <div
          className={`flex flex-1 flex-col ${selectedItem ? "lg:mr-[400px]" : ""}`}
        >
          <div className="flex flex-1 flex-col items-center px-6 pt-16">
            <div className="flex w-full max-w-[700px] flex-1 flex-wrap content-start items-start gap-4">
              {/* Existing file cards */}
              {items.map((item) => {
                const isReady = !item.analyzing;
                return (
                  <button
                    key={item.id}
                    data-card
                    onClick={() => {
                      if (!isReady) return;
                      setSelectedId(selectedId === item.id ? null : item.id);
                    }}
                    className={`group relative flex h-[360px] w-[240px] flex-col overflow-hidden rounded-[var(--radius-sm)] bg-[var(--surface-elevated)] shadow-md transition-shadow ${
                      isReady ? "cursor-pointer hover:shadow-xl" : "cursor-default"
                    } ${
                      selectedId === item.id ? "ring-2 ring-[var(--damson-500)]" : ""
                    }`}
                  >
                    {/* Loading skeleton — shown until analysis is done */}
                    {!isReady && (
                      <div className="absolute inset-0 z-20 flex flex-col justify-between bg-[var(--surface-elevated)] p-5">
                        {/* Shimmer area */}
                        <div className="flex-1 animate-pulse rounded-[var(--radius-sm)] bg-[var(--surface-high)]/40" />
                        {/* Shimmer text area */}
                        <div className="mt-4 flex flex-col gap-2">
                          <div className="h-4 w-3/4 animate-pulse rounded bg-[var(--surface-high)]" />
                          <div className="h-3 w-full animate-pulse rounded bg-[var(--surface-high)]/70" />
                          <div className="h-3 w-4/5 animate-pulse rounded bg-[var(--surface-high)]/70" />
                        </div>
                      </div>
                    )}

                    {/* Remove button */}
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        removeItem(item.id);
                      }}
                      className="absolute right-2 top-2 z-30 flex h-6 w-6 items-center justify-center rounded-full bg-black/30 text-xs text-white opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100"
                    >
                      x
                    </div>

                    {/* Bottom area with title and summary */}
                    <div className="relative z-10 mt-auto flex w-full flex-col gap-1 px-5 pb-5 pt-16">
                      <p className="text-left text-sm font-bold text-[var(--contrast-strong)]">
                        {item.whatIsThis || item.name}
                      </p>
                      {item.summary && (
                        <p className="line-clamp-2 text-left text-xs leading-[1.5] text-[var(--contrast-weak)]">
                          {item.summary}
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}

              {/* Drop zone for adding more */}
              {/* biome-ignore lint: tabIndex needed for paste focus */}
              <div
                tabIndex={0}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onPaste={handleNativePaste}
                onClick={(e) => (e.target as HTMLElement).focus()}
                onDoubleClick={() => fileInputRef.current?.click()}
                className={`flex h-[360px] w-[240px] cursor-pointer flex-col items-center justify-center gap-2 rounded-[var(--radius-md)] border-[3px] border-dashed outline-none transition-colors ${
                  dragging
                    ? "border-[var(--damson-600)] bg-[var(--damson-200)]"
                    : "border-[var(--surface-high)] bg-transparent focus:border-[var(--damson-400)]"
                }`}
              >
                <svg
                  width="32"
                  height="32"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="text-[var(--surface-high)]"
                >
                  <path
                    d="M12 5V19M5 12H19"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
                <p className="px-4 text-center text-xs text-[var(--contrast-weak)]">
                  Paste, drag, or double-click
                </p>
              </div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.md,.text,.pdf"
              multiple
              onChange={handleFileInput}
              className="hidden"
            />
          </div>

          <div className="flex justify-center px-6 pb-8 pt-4">
            <button
              onClick={handleStartChat}
              className="flex h-16 w-[300px] items-center justify-center rounded-[var(--radius-pill)] bg-[var(--damson-500)] text-lg font-medium tracking-[-0.25px] text-white"
            >
              continue
            </button>
          </div>
        </div>

        {/* Sidebar: context fields for selected item */}
        {selectedItem && (
          <div
            ref={sidebarRef}
            className="fixed right-0 top-0 z-20 flex h-full w-[400px] flex-col overflow-y-auto bg-[var(--surface-elevated)] p-8"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium uppercase tracking-[1.25px] text-[var(--contrast-strong)]">
                {selectedItem.name}
              </h2>
              <button
                onClick={() => { setSelectedId(null); setEditingFields({}); }}
                className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--contrast-weak)] hover:bg-[var(--surface-high)]"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <div className="mt-8 flex flex-col gap-6">
              {/* What is this */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-bold text-[var(--contrast-strong)]">
                    What is this
                  </label>
                  {!selectedItem.analyzing && (
                    <button
                      onClick={() => toggleFieldEditing(selectedItem.id, "whatIsThis")}
                      className="flex h-7 items-center gap-1 rounded px-2 text-xs text-[var(--contrast-weak)] hover:bg-[var(--surface-high)] hover:text-[var(--contrast-medium)]"
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                        <path d="M18.5 2.5C18.8978 2.10218 19.4374 1.87868 20 1.87868C20.5626 1.87868 21.1022 2.10218 21.5 2.5C21.8978 2.89783 22.1213 3.43739 22.1213 4C22.1213 4.56261 21.8978 5.10218 21.5 5.5L12 15L8 16L9 12L18.5 2.5Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      {isFieldEditing(selectedItem.id, "whatIsThis") ? "Done" : "Edit"}
                    </button>
                  )}
                </div>
                {selectedItem.analyzing ? (
                  <div className="flex flex-col gap-2">
                    <div className="h-4 w-3/4 animate-pulse rounded bg-[var(--surface-high)]" />
                    <div className="h-4 w-1/2 animate-pulse rounded bg-[var(--surface-high)]" />
                  </div>
                ) : isFieldEditing(selectedItem.id, "whatIsThis") ? (
                  <textarea
                    value={selectedItem.whatIsThis}
                    onChange={(e) => updateItem(selectedItem.id, "whatIsThis", e.target.value)}
                    rows={2}
                    autoFocus
                    className="resize-none rounded-[var(--radius-sm)] border border-[var(--surface-high)] bg-[var(--surface-bg)] px-3 py-2 text-sm leading-[1.5] text-[var(--contrast-strong)] outline-none focus:border-[var(--damson-600)]"
                  />
                ) : (
                  <p className="text-sm leading-[1.5] text-[var(--contrast-strong)]">
                    {selectedItem.whatIsThis || <span className="text-[var(--contrast-weak)]">No description</span>}
                  </p>
                )}
              </div>

              {/* What makes this important */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-bold text-[var(--contrast-strong)]">
                    What makes this important
                  </label>
                  {!selectedItem.analyzing && (
                    <button
                      onClick={() => toggleFieldEditing(selectedItem.id, "whyImportant")}
                      className="flex h-7 items-center gap-1 rounded px-2 text-xs text-[var(--contrast-weak)] hover:bg-[var(--surface-high)] hover:text-[var(--contrast-medium)]"
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                        <path d="M18.5 2.5C18.8978 2.10218 19.4374 1.87868 20 1.87868C20.5626 1.87868 21.1022 2.10218 21.5 2.5C21.8978 2.89783 22.1213 3.43739 22.1213 4C22.1213 4.56261 21.8978 5.10218 21.5 5.5L12 15L8 16L9 12L18.5 2.5Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      {isFieldEditing(selectedItem.id, "whyImportant") ? "Done" : "Edit"}
                    </button>
                  )}
                </div>
                {selectedItem.analyzing ? (
                  <div className="flex flex-col gap-3">
                    <div className="flex items-start gap-2">
                      <div className="mt-1.5 h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-[var(--surface-high)]" />
                      <div className="h-4 w-full animate-pulse rounded bg-[var(--surface-high)]" />
                    </div>
                    <div className="flex items-start gap-2">
                      <div className="mt-1.5 h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-[var(--surface-high)]" />
                      <div className="h-4 w-5/6 animate-pulse rounded bg-[var(--surface-high)]" />
                    </div>
                    <div className="flex items-start gap-2">
                      <div className="mt-1.5 h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-[var(--surface-high)]" />
                      <div className="h-4 w-2/3 animate-pulse rounded bg-[var(--surface-high)]" />
                    </div>
                  </div>
                ) : isFieldEditing(selectedItem.id, "whyImportant") ? (
                  <textarea
                    value={selectedItem.whyImportant.join("\n")}
                    onChange={(e) =>
                      updateItem(selectedItem.id, "whyImportant", e.target.value as unknown as string)
                    }
                    rows={4}
                    autoFocus
                    placeholder="One bullet point per line"
                    className="resize-none rounded-[var(--radius-sm)] border border-[var(--surface-high)] bg-[var(--surface-bg)] px-3 py-2 text-sm leading-[1.5] text-[var(--contrast-strong)] outline-none placeholder:text-[var(--contrast-weak)] focus:border-[var(--damson-600)]"
                  />
                ) : selectedItem.whyImportant.length > 0 ? (
                  <ul className="flex flex-col gap-1.5">
                    {selectedItem.whyImportant.map((bullet, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm leading-[1.5] text-[var(--contrast-strong)]">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--damson-500)]" />
                        {bullet}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-[var(--contrast-weak)]">No themes detected</p>
                )}
              </div>

              {/* What should I ignore — always editable */}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-bold text-[var(--contrast-strong)]">
                  What should I ignore
                </label>
                <textarea
                  value={selectedItem.whatToIgnore}
                  onChange={(e) => updateItem(selectedItem.id, "whatToIgnore", e.target.value)}
                  placeholder="Optional. e.g. The part about scheduling was just logistics, not relevant"
                  rows={3}
                  className="resize-none rounded-[var(--radius-sm)] border border-[var(--surface-high)] bg-[var(--surface-bg)] px-3 py-2 text-sm leading-[1.5] text-[var(--contrast-strong)] outline-none placeholder:text-[var(--contrast-weak)] focus:border-[var(--damson-600)]"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─── Chat Step ───
  if (step === "chat") {
    const chatMessages = messages.map((m) => ({
      id: m.id,
      role: m.role as "assistant" | "partner_a",
      text: m.text,
      phase: "intake" as const,
      created_at: m.created_at,
    }));

    const visibleMessages = chatMessages.filter(
      (m, i) =>
        !(
          i === 0 &&
          m.role !== "assistant" &&
          m.text.includes("I've shared my therapy transcript")
        ),
    );

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
            <span className="text-sm font-medium text-[var(--contrast-weak)]">
              Bridge
            </span>
          </div>
          <button
            onClick={handleCollectInsights}
            disabled={messages.length < 2 || generatingInsight}
            className="flex h-9 items-center rounded-[var(--radius-pill)] bg-[var(--damson-600)] px-4 text-sm font-medium text-white disabled:opacity-40"
          >
            {generatingInsight ? "Generating..." : "Collect Insights"}
          </button>
        </div>

        <MessageList
          messages={visibleMessages}
          typing={typing}
          containerRef={containerRef}
        />

        <ChatInput
          disabled={typing}
          placeholder="Ask Ash about your session..."
          onSend={handleSend}
        />
      </div>
    );
  }

  // ─── Insight Step ───
  return (
    <div className="relative min-h-[100dvh] overflow-hidden bg-[var(--surface-bg)]">
      <BrushBackground variant="alignment" />

      <div className="relative z-10 mx-auto flex max-w-[600px] flex-col items-center px-6 pt-[73px] pb-16">
        <h1
          className="max-w-[350px] text-center text-[32px] font-medium leading-[1.4] tracking-[-1px] text-[var(--damson-600)]"
          style={{ fontFamily: "'Libre Baskerville', serif" }}
        >
          Your insights
        </h1>

        <div className="mt-10 flex w-full flex-col gap-6">
          {insightData?.themes && (
            <div
              className="w-full rounded-[var(--radius-md)] bg-[var(--surface-bg)] px-6 py-6 shadow-sm"
              style={{ backdropFilter: "blur(8px)" }}
            >
              <h2 className="mb-3 text-sm font-medium uppercase tracking-[1.25px] text-[var(--damson-500)]">
                Key themes
              </h2>
              <p className="text-base leading-[1.7] text-[var(--contrast-strong)]">
                {insightData.themes}
              </p>
            </div>
          )}

          {insightData?.patterns && (
            <div
              className="w-full rounded-[var(--radius-md)] bg-[var(--surface-bg)] px-6 py-6 shadow-sm"
              style={{ backdropFilter: "blur(8px)" }}
            >
              <h2 className="mb-3 text-sm font-medium uppercase tracking-[1.25px] text-[var(--damson-500)]">
                Patterns and insights
              </h2>
              <p className="text-base leading-[1.7] text-[var(--contrast-strong)]">
                {insightData.patterns}
              </p>
            </div>
          )}

          {insightData?.takeaways && (
            <div
              className="w-full rounded-[var(--radius-md)] bg-[var(--surface-bg)] px-6 py-6 shadow-sm"
              style={{ backdropFilter: "blur(8px)" }}
            >
              <h2 className="mb-3 text-sm font-medium uppercase tracking-[1.25px] text-[var(--damson-500)]">
                Takeaways for your next session
              </h2>
              <p className="text-base leading-[1.7] text-[var(--contrast-strong)]">
                {insightData.takeaways}
              </p>
            </div>
          )}
        </div>

        <button
          onClick={() => (window.location.href = "/bridge")}
          className="mt-10 flex h-14 items-center rounded-[var(--radius-pill)] bg-[var(--damson-600)] px-8 text-base font-medium text-white"
        >
          Start a new session
        </button>
      </div>
    </div>
  );
}
