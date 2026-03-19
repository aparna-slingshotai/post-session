"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";

type LabeledUtterance = {
  speaker: string;
  text: string;
  start?: number;
  end?: number;
};

type AddedFile = {
  id: string;
  file: File;
  previewUrl?: string; // object URL for image files
};

export default function ContextWindowAttachment({
  title = "Context window",
  utterances,
  maxPreviewUtterances = 10,
  recordedAt,
  durationSeconds,
  className,
  bridgeBegun = false,
}: {
  title?: string;
  utterances: LabeledUtterance[] | null | undefined;
  maxPreviewUtterances?: number;
  recordedAt?: string | Date | null;
  durationSeconds?: number | null;
  className?: string;
  bridgeBegun?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [addPanelOpen, setAddPanelOpen] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [addedFiles, setAddedFiles] = useState<AddedFile[]>([]);
  const addedFilesRef = useRef<AddedFile[]>([]);
  const [pendingNote, setPendingNote] = useState("");
  const [savedNotes, setSavedNotes] = useState<string[]>([]);
  const [imageViewer, setImageViewer] = useState<null | { src: string; alt: string }>(null);
  const [minimized, setMinimized] = useState(false);
  const [dragStartY, setDragStartY] = useState<number | null>(null);
  const [dragDeltaY, setDragDeltaY] = useState(0);
  const autoMinimizedRef = useRef(false);

  useEffect(() => {
    addedFilesRef.current = addedFiles;
  }, [addedFiles]);

  useEffect(() => {
    return () => {
      for (const item of addedFilesRef.current) {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      }
    };
  }, []);

  useEffect(() => {
    if (!bridgeBegun || autoMinimizedRef.current) return;
    setMinimized(true);
    autoMinimizedRef.current = true;
  }, [bridgeBegun]);

  const utterancesSafe = useMemo(() => utterances ?? [], [utterances]);
  const preview = utterancesSafe.slice(0, maxPreviewUtterances);
  const remaining = Math.max(0, utterancesSafe.length - preview.length);

  const additionalItemsCount = useMemo(() => {
    const fileCount = addedFiles.length;
    const notesCount = savedNotes.length;
    return fileCount + notesCount;
  }, [addedFiles.length, savedNotes.length]);

  const durationSecondsComputed = useMemo(() => {
    if (typeof durationSeconds === "number" && Number.isFinite(durationSeconds)) {
      return durationSeconds;
    }
    const starts = utterancesSafe
      .map((u) => (typeof u.start === "number" ? u.start : null))
      .filter((v): v is number => v !== null);
    const ends = utterancesSafe
      .map((u) => (typeof u.end === "number" ? u.end : null))
      .filter((v): v is number => v !== null);
    if (!starts.length || !ends.length) return null;
    const minStart = Math.min(...starts);
    const maxEnd = Math.max(...ends);
    const seconds = maxEnd - minStart;
    return Number.isFinite(seconds) ? seconds : null;
  }, [durationSeconds, utterancesSafe]);

  const metaLine = useMemo(() => {
    const dateObj =
      recordedAt instanceof Date
        ? recordedAt
        : typeof recordedAt === "string"
          ? new Date(recordedAt)
          : null;

    const dateLabel = dateObj && !Number.isNaN(dateObj.getTime())
      ? dateObj.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
      : "—";

    const timeLabel = dateObj && !Number.isNaN(dateObj.getTime())
      ? dateObj.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
      : null;

    const durationLabel =
      typeof durationSecondsComputed === "number" && durationSecondsComputed > 0
        ? `${Math.round(durationSecondsComputed / 60)} min`
        : "—";

    return timeLabel ? `${dateLabel} • ${timeLabel} • ${durationLabel}` : `${dateLabel} • ${durationLabel}`;
  }, [recordedAt, durationSecondsComputed]);

  const transcriptText = useMemo(() => {
    return utterancesSafe.map((u) => `${u.speaker}: ${u.text}`).join("\n");
  }, [utterancesSafe]);

  function revokeAddedFile(item: AddedFile | undefined) {
    if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
  }

  function addFiles(files: FileList | File[]) {
    const arr = Array.from(files);
    if (!arr.length) return;
    setAddedFiles((prev) => {
      const seen = new Set<string>(prev.map((p) => p.id));
      const nextItems: AddedFile[] = [];

      for (const f of arr) {
        const id = `${f.name}-${f.size}-${f.lastModified}`;
        if (seen.has(id)) continue;

        const previewUrl = f.type.startsWith("image/") ? URL.createObjectURL(f) : undefined;
        nextItems.push({ id, file: f, previewUrl });
        seen.add(id);
      }

      return [...prev, ...nextItems];
    });
  }

  const additionalBullets = useMemo(() => {
    const bullets: Array<
      | { id: string; kind: "file"; label: string; previewUrl?: string }
      | { id: string; kind: "notes"; label: string; body: string }
    > = [];
    for (const f of addedFiles) {
      bullets.push({
        id: f.id,
        kind: "file",
        label: f.file.name,
        previewUrl: f.previewUrl,
      });
    }
    for (let i = 0; i < savedNotes.length; i++) {
      const body = savedNotes[i];
      bullets.push({
        id: `notes-${i}-${body.slice(0, 12)}`,
        kind: "notes",
        label: "Notes",
        body,
      });
    }
    return bullets;
  }, [addedFiles, savedNotes]);

  function scatterStyle(index: number) {
    // Deterministic pseudo-scatter so the layout looks "random" but stable.
    // (We only use small transforms so it doesn't destroy readability.)
    const angle = ((index * 37) % 11) - 5; // -5..+5 deg
    const dx = ((index * 53) % 13) - 6; // -6..+6 px
    const dy = ((index * 71) % 17) - 8; // -8..+8 px
    const rot = ((index * 29) % 7) - 3; // -3..+3 deg
    return {
      transform: `translate(${dx}px, ${dy}px) rotate(${angle}deg)`,
      marginRight: (index % 2) * 8,
      marginTop: (index % 3) * 6,
      marginBottom: (index % 4) * 6,
      opacity: 0.98,
      borderRadius: "var(--radius-sm)",
    } as any;
  }

  function openImageViewer(item: { previewUrl?: string; label: string }) {
    if (!item.previewUrl) return;
    setImageViewer({ src: item.previewUrl, alt: item.label });
  }

  function onHandlePointerDown(event: PointerEvent<HTMLButtonElement>) {
    if (!bridgeBegun) return;
    setDragStartY(event.clientY);
    setDragDeltaY(0);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onHandlePointerMove(event: PointerEvent<HTMLButtonElement>) {
    if (dragStartY === null) return;
    const delta = event.clientY - dragStartY;
    setDragDeltaY(delta);
  }

  function onHandlePointerUp(event: PointerEvent<HTMLButtonElement>) {
    if (dragStartY === null) return;
    const threshold = 40;
    if (dragDeltaY < -threshold) {
      setMinimized(false);
    } else if (dragDeltaY > threshold) {
      setMinimized(true);
    } else {
      setMinimized((prev) => !prev);
    }
    setDragStartY(null);
    setDragDeltaY(0);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  return (
    <>
      <section
        className={`rounded-[var(--radius-md)] bg-[var(--surface-elevated)] px-4 py-4 shadow-sm transition-all ${className ?? ""}`}
      >
        {bridgeBegun ? (
          <div className="mb-3 flex justify-center">
            <button
              type="button"
              onPointerDown={onHandlePointerDown}
              onPointerMove={onHandlePointerMove}
              onPointerUp={onHandlePointerUp}
              onPointerCancel={() => {
                setDragStartY(null);
                setDragDeltaY(0);
              }}
              className="h-1.5 w-[210px] rounded-full bg-[var(--contrast-subtle)]/70 touch-none"
              aria-label={minimized ? "Expand context window" : "Minimize context window"}
              title={minimized ? "Drag up to expand" : "Drag down to minimize"}
            />
          </div>
        ) : null}
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-[1.25px] text-[var(--contrast-subtle)]">
              {title}
            </p>
            <div className="mt-1 flex items-center gap-2 text-sm leading-[1.5] text-[var(--contrast-medium)]">
              <p>1 session recorded</p>
              {additionalItemsCount > 0 ? (
                <>
                  <span className="text-[var(--contrast-weak)]">•</span>
                  <p className="text-[var(--contrast-weak)]">
                    {additionalItemsCount} additional context provided
                  </p>
                </>
              ) : null}
            </div>
            <p className="mt-1 text-xs leading-[1.5] text-[var(--contrast-weak)]">{metaLine}</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setAddPanelOpen(true)}
              className="shrink-0 rounded-[var(--radius-pill)] bg-[var(--surface-bg)] px-3 py-2 text-xs font-bold text-[var(--contrast-medium)]"
            >
              +
            </button>
            <button
              type="button"
              onClick={() => setExpanded(true)}
              disabled={!utterancesSafe.length}
              className="shrink-0 rounded-[var(--radius-pill)] bg-[var(--surface-bg)] px-3 py-2 text-xs font-bold text-[var(--contrast-medium)] disabled:opacity-40"
            >
              View
            </button>
          </div>
        </div>

        {!minimized ? (
          <div className="mt-3 max-h-[180px] overflow-y-auto rounded-[var(--radius-sm)] bg-[var(--surface-bg)] px-3 py-3">
            {preview.length ? (
              <div className="space-y-3">
                <div className="space-y-3">
                  {preview.map((u, idx) => (
                    <div
                      key={`${u.speaker}-${idx}`}
                      className="text-sm leading-[1.55] text-[var(--contrast-strong)]"
                    >
                      <span className="font-bold text-[var(--contrast-medium)]">
                        {u.speaker}:
                      </span>{" "}
                      <span>{u.text}</span>
                    </div>
                  ))}
                  {remaining ? (
                    <div className="text-xs leading-[1.5] text-[var(--contrast-weak)]">
                      + {remaining} more transcript segments
                    </div>
                  ) : null}
                </div>

                {additionalBullets.length ? (
                  <div className="mt-2">
                    <p className="mb-2 text-xs font-medium uppercase tracking-[1.25px] text-[var(--contrast-subtle)]">
                      Additional context
                    </p>
                    <div className="flex flex-col gap-2 items-start">
                      {additionalBullets.slice(0, 3).map((b, idx) => (
                        <div
                          key={`${b.id}-${idx}`}
                          className="rounded-[var(--radius-sm)] bg-[var(--surface-elevated)] px-3 py-2 text-sm leading-[1.5] text-[var(--contrast-strong)]"
                        >
                          <div className="text-xs font-bold text-[var(--contrast-medium)]">
                            {b.kind === "file" ? "File" : "Notes"}:
                          </div>
                          <div className="mt-1">
                            {b.kind === "file" ? (
                              b.previewUrl ? (
                                <div>
                                  <button
                                    type="button"
                                    onClick={() => openImageViewer(b)}
                                    aria-label={`Expand image: ${b.label}`}
                                    className="w-full"
                                  >
                                    <img
                                      src={b.previewUrl}
                                      alt={b.label}
                                      className="max-h-[140px] w-full rounded-[var(--radius-sm)] object-contain"
                                    />
                                  </button>
                                  <div className="mt-2 truncate text-[11px] text-[var(--contrast-weak)]">
                                    {b.label}
                                  </div>
                                </div>
                              ) : (
                                <div className="whitespace-pre-wrap">{b.label}</div>
                              )
                            ) : b.body && b.body.length > 180 ? (
                              <div className="whitespace-pre-wrap">{`${b.body.slice(0, 180)}...`}</div>
                            ) : (
                              <div className="whitespace-pre-wrap">{b.body}</div>
                            )}
                          </div>
                        </div>
                      ))}
                      {additionalBullets.length > 3 ? (
                        <div className="text-xs leading-[1.5] text-[var(--contrast-weak)]">
                          + {additionalBullets.length - 3} more item(s)
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="text-sm leading-[1.55] text-[var(--contrast-weak)]">
                Transcript will appear after processing finishes.
              </div>
            )}
          </div>
        ) : null}
      </section>

      {expanded ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="flex max-h-[85vh] w-full max-w-[860px] flex-col rounded-[var(--radius-md)] bg-[var(--surface-bg)] shadow-xl">
            <div className="flex items-center justify-between gap-3 border-b border-[var(--surface-elevated)] px-4 py-3">
              <div>
                <p className="text-sm font-bold text-[var(--contrast-strong)]">{title}</p>
                <p className="text-xs text-[var(--contrast-weak)]">1 session recorded</p>
                <p className="mt-1 text-xs text-[var(--contrast-weak)]">{metaLine}</p>
                {additionalItemsCount > 0 ? (
                  <p className="mt-1 text-xs text-[var(--contrast-weak)]">
                    {additionalItemsCount} additional context provided
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => setExpanded(false)}
                className="rounded-[var(--radius-pill)] bg-[var(--surface-elevated)] px-3 py-2 text-xs font-bold text-[var(--contrast-medium)]"
              >
                Close
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <pre className="whitespace-pre-wrap break-words text-sm leading-[1.6] text-[var(--contrast-strong)]">
                {transcriptText}
              </pre>

              {additionalBullets.length ? (
                <div className="mt-4">
                  <p className="mb-3 text-xs font-medium uppercase tracking-[1.25px] text-[var(--contrast-subtle)]">
                    Additional context
                  </p>
                  <div className="relative flex flex-wrap gap-3 items-start">
                    {additionalBullets.map((b, idx) => (
                      <div
                        key={`${b.id}-${idx}`}
                        className="max-w-[280px] bg-[var(--surface-elevated)] px-3 py-2 text-sm leading-[1.55] text-[var(--contrast-strong)] shadow-sm self-start"
                        style={scatterStyle(idx)}
                      >
                        <div className="text-xs font-bold text-[var(--contrast-medium)]">
                          {b.kind === "file" ? "File" : "Notes"}
                        </div>
                        <div className="mt-1">
                          {b.kind === "file" ? (
                            b.previewUrl ? (
                              <div>
                                <button
                                  type="button"
                                  onClick={() => openImageViewer(b)}
                                  aria-label={`Expand image: ${b.label}`}
                                  className="w-full"
                                >
                                  <img
                                    src={b.previewUrl}
                                    alt={b.label}
                                    className="max-h-[280px] w-full rounded-[var(--radius-sm)] object-contain"
                                  />
                                </button>
                                <div className="mt-2 truncate text-[11px] text-[var(--contrast-weak)]">
                                  {b.label}
                                </div>
                              </div>
                            ) : (
                              <div className="whitespace-pre-wrap">{b.label}</div>
                            )
                          ) : (
                            <div className="whitespace-pre-wrap">{b.body}</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {imageViewer ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="relative w-full max-w-[980px] rounded-[var(--radius-md)] bg-[var(--surface-bg)] shadow-xl">
            <div className="flex items-center justify-between gap-3 border-b border-[var(--surface-elevated)] px-4 py-3">
              <p className="text-sm font-bold text-[var(--contrast-strong)]">Image preview</p>
              <button
                type="button"
                onClick={() => setImageViewer(null)}
                className="rounded-[var(--radius-pill)] bg-[var(--surface-elevated)] px-3 py-2 text-xs font-bold text-[var(--contrast-medium)]"
              >
                Close
              </button>
            </div>
            <div className="p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageViewer.src}
                alt={imageViewer.alt}
                className="max-h-[80vh] w-full rounded-[var(--radius-sm)] object-contain"
              />
              <div className="mt-2 truncate text-sm text-[var(--contrast-weak)]">
                {imageViewer.alt}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {addPanelOpen ? (
        <div className="fixed inset-0 z-[60]">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setAddPanelOpen(false)}
            role="button"
            tabIndex={-1}
          />
          <aside className="fixed right-0 top-0 z-10 h-[100dvh] w-[420px] max-w-[95vw] overflow-y-auto border-l border-[var(--surface-elevated)] bg-[var(--surface-elevated)] shadow-xl">
            <div className="flex items-center justify-between gap-3 border-b border-[var(--surface-elevated)] px-4 py-4">
              <div>
                <p className="text-sm font-bold text-[var(--contrast-strong)]">
                  Add additional context
                </p>
                <p className="mt-1 text-xs leading-[1.5] text-[var(--contrast-weak)]">
                  add any additional context, transcripts, thoughts, images or notes to help Ash contextualise
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAddPanelOpen(false)}
                className="rounded-[var(--radius-pill)] bg-[var(--surface-bg)] px-3 py-2 text-xs font-bold text-[var(--contrast-medium)]"
              >
                Close
              </button>
            </div>

            <div className="p-4">
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
                }}
                className={`flex flex-col gap-3 rounded-[var(--radius-md)] border-2 border-dashed p-4 ${
                  dragOver ? "border-[var(--damson-600)] bg-[var(--damson-200)]" : "border-[var(--surface-high)] bg-transparent"
                }`}
              >
                <p className="text-sm font-bold text-[var(--contrast-strong)]">
                  Drag and drop files here
                </p>
                <p className="text-xs leading-[1.5] text-[var(--contrast-weak)]">
                  Or use upload to add transcripts, images, or notes.
                </p>
                <div className="flex gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files?.length) addFiles(e.target.files);
                      if (e.target) e.target.value = "";
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="rounded-[var(--radius-pill)] bg-[var(--wood-600)] px-4 py-2 text-sm font-bold text-[var(--wood-50)]"
                  >
                    Upload
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAddedFiles((prev) => {
                        prev.forEach(revokeAddedFile);
                        return [];
                      });
                      setSavedNotes([]);
                      setPendingNote("");
                    }}
                    disabled={!addedFiles.length && !savedNotes.length && !pendingNote.trim()}
                    className="rounded-[var(--radius-pill)] bg-[var(--surface-bg)] px-4 py-2 text-sm font-bold text-[var(--contrast-medium)] disabled:opacity-40"
                  >
                    Clear
                  </button>
                </div>
              </div>

              {addedFiles.length ? (
                <div className="mt-4">
                  <p className="text-xs font-bold uppercase tracking-[1.25px] text-[var(--contrast-subtle)]">
                    Selected files
                  </p>
                  <ul className="mt-2 space-y-2">
                    {addedFiles.slice(0, 10).map((f, idx) => (
                      <li
                        key={`${f.file.name}-${f.file.size}-${f.id}-${idx}`}
                        className="flex items-center justify-between gap-3 text-sm"
                      >
                        <span className="min-w-0 flex-1 truncate text-[var(--contrast-strong)]">
                          {f.file.name}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setAddedFiles((prev) => {
                              const removed = prev[idx];
                              revokeAddedFile(removed);
                              return prev.filter((_, i) => i !== idx);
                            });
                          }}
                          className="rounded-[var(--radius-pill)] bg-[var(--surface-bg)] px-2 py-1 text-xs font-bold text-[var(--contrast-medium)]"
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="mt-4">
                <p className="text-xs font-bold uppercase tracking-[1.25px] text-[var(--contrast-subtle)]">
                  Notes (optional)
                </p>
                <div className="mt-2 rounded-[var(--radius-md)] border-2 border-dashed border-[var(--surface-high)] p-3">
                  <textarea
                    value={pendingNote}
                    onChange={(e) => setPendingNote(e.target.value)}
                    rows={6}
                    placeholder="Type anything you want Ash to consider…"
                    className="w-full resize-none bg-transparent px-1 py-1 text-sm leading-[1.5] text-[var(--contrast-strong)] outline-none focus:border-0"
                  />
                </div>

                {savedNotes.length ? (
                  <div className="mt-4 space-y-2">
                    {savedNotes.map((n, idx) => (
                      <div
                        key={`${idx}-${n.slice(0, 12)}`}
                        className="rounded-[var(--radius-md)] border-2 border-dashed border-[var(--surface-high)] bg-transparent p-3"
                      >
                        <p className="text-xs font-bold uppercase tracking-[1.25px] text-[var(--contrast-subtle)]">
                          Note {savedNotes.length - idx}
                        </p>
                        <div className="mt-2 whitespace-pre-wrap text-sm leading-[1.55] text-[var(--contrast-strong)]">
                          {n}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="mt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    const trimmed = pendingNote.trim();
                    if (trimmed) {
                      setSavedNotes((prev) => [trimmed, ...prev]);
                      setPendingNote("");
                      return;
                    }
                    setAddPanelOpen(false);
                  }}
                  className="flex-1 rounded-[var(--radius-pill)] bg-[var(--damson-600)] px-4 py-3 text-sm font-bold text-white"
                >
                  Save
                </button>
              </div>

              {addedFiles.length || savedNotes.length ? (
                <p className="mt-3 text-xs leading-[1.5] text-[var(--contrast-weak)]">
                  Added{" "}
                  {addedFiles.length ? `${addedFiles.length} file(s)` : ""}
                  {addedFiles.length && savedNotes.length ? " and " : ""}
                  {savedNotes.length ? `${savedNotes.length} note(s)` : ""}.
                  (Hook up to backend next step.)
                </p>
              ) : null}
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}

