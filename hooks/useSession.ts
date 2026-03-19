"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { ChatMessage, RoomState } from "@/lib/types";

type SessionState = "idle" | "joining" | "active" | "error";

const POLL_INTERVAL = 1500;

// Per-room storage key so participants in different rooms don't collide
function storageKey(roomId: string) {
  return `ash-align-participant-${roomId}`;
}

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(path, options);
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(body.error || "Request failed");
  }
  return res.json() as Promise<T>;
}

interface JoinResponse {
  participantId: string;
  role: string;
  state: RoomState;
  messages: ChatMessage[];
}

interface PollResponse {
  state: RoomState;
  messages: ChatMessage[];
}

export function useSession(roomId: string) {
  const [participantId, setParticipantId] = useState<string | null>(null);
  const [state, setState] = useState<SessionState>("idle");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [typing, setTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [readyLoading, setReadyLoading] = useState(false);

  const pendingRef = useRef(false);

  // Polling
  useEffect(() => {
    if (!participantId || state !== "active") return;

    let cancelled = false;

    const poll = async () => {
      try {
        const result = await api<PollResponse>(`/api/room/poll?participantId=${encodeURIComponent(participantId)}`);
        if (cancelled) return;
        setRoomState(result.state);
        // Don't overwrite messages while a send is in-flight — send() handles its own update
        if (!pendingRef.current) {
          setMessages(result.messages);
        }
      } catch {
        // Silently ignore poll errors — will retry next interval
      }
    };

    poll();
    const interval = setInterval(poll, POLL_INTERVAL);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [participantId, state]);

  const canSend = useMemo(
    () => state === "active" && !!participantId && !!roomState?.canSend && !typing,
    [participantId, roomState, state, typing],
  );

  const join = useCallback(
    async (name: string) => {
      setError(null);
      setState("joining");

      try {
        const existingId = window.localStorage.getItem(storageKey(roomId)) || undefined;

        let result: JoinResponse;
        try {
          result = await api<JoinResponse>("/api/room/join", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ roomId, name, participantId: existingId }),
          });
        } catch {
          // Stale participant ID — clear and retry
          if (existingId) {
            window.localStorage.removeItem(storageKey(roomId));
            result = await api<JoinResponse>("/api/room/join", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ roomId, name }),
            });
          } else {
            throw new Error("Failed to join room");
          }
        }

        window.localStorage.setItem(storageKey(roomId), result.participantId);
        setParticipantId(result.participantId);
        setRoomState(result.state);
        setMessages(result.messages);
        setState("active");
      } catch (err) {
        setState("error");
        setError(err instanceof Error ? err.message : "Unknown room error");
      }
    },
    [roomId],
  );

  const send = useCallback(
    async (content: string) => {
      if (!participantId || state !== "active") return;

      setError(null);
      const optimisticMsg: ChatMessage = {
        id: `pending-${Date.now()}`,
        role: roomState?.participantRole || "partner_a",
        author_name: roomState?.participantName || undefined,
        text: content,
        phase: roomState?.phase || "intake",
      };
      setMessages((prev) => [...prev, optimisticMsg]);
      setTyping(true);
      pendingRef.current = true;

      try {
        await api("/api/room/message", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ participantId, content }),
        });
        // Message route is synchronous — by the time it resolves, the assistant
        // response is already in the DB. Immediately poll to show it, then clear typing.
        const result = await api<PollResponse>(`/api/room/poll?participantId=${encodeURIComponent(participantId)}`);
        setMessages(result.messages);
        setRoomState(result.state);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to send message");
      } finally {
        pendingRef.current = false;
        setTyping(false);
      }
    },
    [participantId, state, roomState],
  );

  const ready = useCallback(async () => {
    if (!participantId) return;

    setReadyLoading(true);
    setError(null);
    try {
      await api("/api/room/ready", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participantId }),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to continue");
    } finally {
      setReadyLoading(false);
    }
  }, [participantId]);

  const [wrapUpLoading, setWrapUpLoading] = useState(false);

  const wrapUp = useCallback(async () => {
    if (!participantId) return;

    setWrapUpLoading(true);
    setError(null);
    try {
      await api("/api/room/wrapup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participantId }),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to wrap up");
    } finally {
      setWrapUpLoading(false);
    }
  }, [participantId]);

  const [handRaiseLoading, setHandRaiseLoading] = useState(false);

  const raiseHand = useCallback(async () => {
    if (!participantId || state !== "active") return;

    setHandRaiseLoading(true);
    setError(null);
    try {
      await api("/api/room/hand", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participantId }),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to raise hand");
    } finally {
      setHandRaiseLoading(false);
    }
  }, [participantId, state]);

  return { state, roomState, messages, typing, error, canSend, readyLoading, wrapUpLoading, handRaiseLoading, join, send, ready, wrapUp, raiseHand };
}
