// In-memory data store — replaces Supabase.
// Data lives in module-level Maps and resets on process restart.
// In local dev (next dev), a single Node process shares this state.
// On Vercel serverless, each function instance has its own copy.

import type { ChatMessage, NextSpeaker, Participant, ParticipantRole, Room, RoomPhase } from "./types";

// ─── Storage ───

const rooms = new Map<string, Room & { created_at: string }>();
const participants = new Map<string, Participant & { created_at: string }>();
const messages: (ChatMessage & { room_id: string })[] = [];

// ─── Rooms ───

export function createRoom(): Room {
  const id = crypto.randomUUID();
  const record = { id, phase: "intake" as const, active_speaker: null, created_at: new Date().toISOString() };
  rooms.set(id, record);
  return record;
}

export function getRoom(roomId: string): Room | null {
  return rooms.get(roomId) ?? null;
}

export function updateRoom(roomId: string, fields: Partial<Pick<Room, "phase" | "active_speaker">>): void {
  const room = rooms.get(roomId);
  if (!room) throw new Error("Room not found");
  Object.assign(room, fields);
}

// ─── Participants ───

export function createParticipant(fields: {
  room_id: string;
  role: ParticipantRole;
  name: string;
}): Participant {
  const id = crypto.randomUUID();
  const record = {
    id,
    room_id: fields.room_id,
    role: fields.role,
    name: fields.name,
    ready: false,
    summary: "",
    created_at: new Date().toISOString(),
  };
  participants.set(id, record);
  return record;
}

export function getParticipant(participantId: string): Participant | null {
  return participants.get(participantId) ?? null;
}

export function getParticipantsByRoom(roomId: string): Participant[] {
  return [...participants.values()]
    .filter((p) => p.room_id === roomId)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export function updateParticipant(
  participantId: string,
  fields: Partial<Pick<Participant, "name" | "ready" | "summary">>,
): void {
  const p = participants.get(participantId);
  if (!p) throw new Error("Participant not found");
  Object.assign(p, fields);
}

// ─── Messages ───

export function createMessage(fields: {
  room_id: string;
  role: ChatMessage["role"];
  author_name?: string;
  text: string;
  phase: RoomPhase;
  intake_participant_id?: string | null;
}): ChatMessage {
  const record = {
    id: crypto.randomUUID(),
    room_id: fields.room_id,
    role: fields.role,
    author_name: fields.author_name,
    text: fields.text,
    phase: fields.phase,
    intake_participant_id: fields.intake_participant_id ?? null,
    created_at: new Date().toISOString(),
  };
  messages.push(record);
  return record;
}

export function getMessagesByRoom(
  roomId: string,
  filters?: { phase?: RoomPhase; intake_participant_id?: string },
): ChatMessage[] {
  return messages.filter((m) => {
    if (m.room_id !== roomId) return false;
    if (filters?.phase && m.phase !== filters.phase) return false;
    if (filters?.intake_participant_id && m.intake_participant_id !== filters.intake_participant_id) return false;
    return true;
  });
  // Already in insertion order (ascending created_at)
}

export function getRecentMessages(roomId: string, phase: RoomPhase, limit: number): ChatMessage[] {
  const filtered = messages.filter((m) => m.room_id === roomId && m.phase === phase);
  return filtered.slice(-limit).reverse();
}

// ─── Bridge Sessions ───

export interface BridgeMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  created_at: string;
}

export interface BridgeSession {
  id: string;
  transcript: string;
  insight: string | null;
  created_at: string;
}

const bridgeSessions = new Map<string, BridgeSession>();
const bridgeMessages: (BridgeMessage & { session_id: string })[] = [];

export function createBridgeSession(transcript: string): BridgeSession {
  const id = crypto.randomUUID();
  const session = { id, transcript, insight: null, created_at: new Date().toISOString() };
  bridgeSessions.set(id, session);
  return session;
}

export function getBridgeSession(sessionId: string): BridgeSession | null {
  return bridgeSessions.get(sessionId) ?? null;
}

export function updateBridgeSession(sessionId: string, fields: Partial<Pick<BridgeSession, "insight">>): void {
  const session = bridgeSessions.get(sessionId);
  if (!session) throw new Error("Bridge session not found");
  Object.assign(session, fields);
}

export function addBridgeMessage(sessionId: string, role: "user" | "assistant", text: string): BridgeMessage {
  const record = {
    id: crypto.randomUUID(),
    session_id: sessionId,
    role,
    text,
    created_at: new Date().toISOString(),
  };
  bridgeMessages.push(record);
  return record;
}

export function getBridgeMessages(sessionId: string): BridgeMessage[] {
  return bridgeMessages.filter((m) => m.session_id === sessionId);
}
