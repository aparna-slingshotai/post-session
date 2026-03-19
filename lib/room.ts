import type { MessageParam } from "@anthropic-ai/sdk/resources/messages/messages";

import { generateResponse, summarize } from "./anthropic";
import * as db from "./db";
import { CONCLUSION_PROMPT, INTAKE_PROMPT, SUMMARY_PROMPT, buildCommonsPrompt, buildOpeningPrompt } from "./prompts";
import type { ChatMessage, NextSpeaker, Participant, ParticipantRole, Room, RoomState } from "./types";

// ─── Conclusion marker ───
const CONCLUSION_MARKER = "<!--CONCLUSION_SUMMARY:";

function extractConclusionSummary(messages: ChatMessage[]): string | null {
  const marker = messages.find((m) => m.text.startsWith(CONCLUSION_MARKER));
  if (!marker) return null;
  const match = marker.text.match(/<!--CONCLUSION_SUMMARY:([\s\S]+?)-->/);
  return match?.[1]?.trim() || null;
}

function isConclusionMarker(msg: ChatMessage): boolean {
  return msg.text.startsWith(CONCLUSION_MARKER);
}

// ─── Hand-raise marker ───
const HAND_RAISED_MARKER = "<!--HAND_RAISED-->";

function isHandRaisedMarker(msg: ChatMessage): boolean {
  return msg.text === HAND_RAISED_MARKER;
}

function detectHandsRaised(messages: ChatMessage[]): { partnerAHandRaised: boolean; partnerBHandRaised: boolean } {
  let partnerAHandRaised = false;
  let partnerBHandRaised = false;

  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role === "assistant") break;
    if (isHandRaisedMarker(msg)) {
      if (msg.role === "partner_a") partnerAHandRaised = true;
      if (msg.role === "partner_b") partnerBHandRaised = true;
    }
  }

  return { partnerAHandRaised, partnerBHandRaised };
}

// ─── Summary field encoding ───

interface ParsedSummary {
  intake: string;
  wrapUpReady: boolean;
}

function parseSummary(summary: string): ParsedSummary {
  if (!summary) return { intake: "", wrapUpReady: false };
  try {
    const parsed = JSON.parse(summary);
    if (parsed && typeof parsed === "object" && "intake" in parsed) {
      return { intake: parsed.intake || "", wrapUpReady: !!parsed.wrapUpReady };
    }
  } catch {
    // Not JSON — legacy plain-text summary from intake
  }
  return { intake: summary, wrapUpReady: false };
}

function encodeSummary(intake: string, wrapUpReady: boolean): string {
  return JSON.stringify({ intake, wrapUpReady });
}

// ─── Parse <!--NEXT:partner_a|partner_b|either--> from Ash's response ───
function parseNextSpeaker(rawText: string): { cleanText: string; nextSpeaker: NextSpeaker | null } {
  const match = rawText.match(/<!--\s*NEXT:(partner_a|partner_b|either)\s*-->/i);
  const nextSpeaker = (match?.[1]?.toLowerCase() as NextSpeaker | undefined) || null;
  const cleanText = rawText.replace(/<!--\s*NEXT:(partner_a|partner_b|either)\s*-->/gi, "").trim();
  return { cleanText, nextSpeaker };
}

// ─── DB helpers ───

function getRoom(roomId: string): Room {
  const room = db.getRoom(roomId);
  if (!room) throw new Error("Room not found");
  return room;
}

function getParticipants(roomId: string): Participant[] {
  return db.getParticipantsByRoom(roomId);
}

function getParticipant(participantId: string): Participant {
  const p = db.getParticipant(participantId);
  if (!p) throw new Error("Participant not found");
  return p;
}

function getVisibleMessages(
  roomId: string,
  room: Room,
  participantId: string,
): ChatMessage[] {
  if (room.phase === "commons") {
    return db.getMessagesByRoom(roomId, { phase: "commons" });
  }
  return db.getMessagesByRoom(roomId, { phase: "intake", intake_participant_id: participantId });
}

function canSend(room: Room, participant: Participant, isConclusion: boolean): boolean {
  if (isConclusion) return false;
  if (room.phase === "intake") return !participant.ready;
  if (!room.active_speaker || room.active_speaker === "either") return true;
  return room.active_speaker === participant.role;
}

function buildRoomState(
  room: Room,
  participant: Participant,
  participants: Participant[],
  isConclusion: boolean,
  conclusionSummary: string | null,
  handsRaised?: { partnerAHandRaised: boolean; partnerBHandRaised: boolean },
): RoomState {
  const partnerA = participants.find((p) => p.role === "partner_a");
  const partnerB = participants.find((p) => p.role === "partner_b");
  const partner = participant.role === "partner_a" ? partnerB : partnerA;
  const aWrapUp = parseSummary(partnerA?.summary || "").wrapUpReady;
  const bWrapUp = parseSummary(partnerB?.summary || "").wrapUpReady;

  return {
    phase: isConclusion ? "conclusion" : room.phase,
    participantRole: participant.role,
    participantName: participant.name,
    partnerAName: partnerA?.name || null,
    partnerBName: partnerB?.name || null,
    partnerAReady: partnerA?.ready || false,
    partnerBReady: partnerB?.ready || false,
    partnerConnected: !!partner,
    activeSpeaker: room.phase === "commons" ? (room.active_speaker as NextSpeaker | null) : null,
    canSend: canSend(room, participant, isConclusion),
    partnerAWrapUp: aWrapUp,
    partnerBWrapUp: bWrapUp,
    partnerAHandRaised: handsRaised?.partnerAHandRaised ?? false,
    partnerBHandRaised: handsRaised?.partnerBHandRaised ?? false,
    conclusionSummary,
  };
}

// ─── Public API ───

export async function joinRoom(
  roomId: string,
  name: string,
  existingParticipantId?: string,
): Promise<{ participantId: string; role: ParticipantRole; state: RoomState; messages: ChatMessage[] }> {
  const room = getRoom(roomId);
  const participants = getParticipants(room.id);

  if (existingParticipantId) {
    const existing = participants.find((p) => p.id === existingParticipantId);
    if (!existing) throw new Error("Participant not found");

    if (existing.name !== name) {
      db.updateParticipant(existingParticipantId, { name });
      existing.name = name;
    }

    const allMessages = getVisibleMessages(room.id, room, existing.id);
    const conclusionSummary = extractConclusionSummary(allMessages);
    const isConclusion = conclusionSummary !== null;
    const handsRaised = detectHandsRaised(allMessages);
    const messages = allMessages.filter((m) => !isConclusionMarker(m) && !isHandRaisedMarker(m));

    return {
      participantId: existing.id,
      role: existing.role,
      state: buildRoomState(room, existing, participants, isConclusion, conclusionSummary, handsRaised),
      messages,
    };
  }

  const partnerA = participants.find((p) => p.role === "partner_a");
  const partnerB = participants.find((p) => p.role === "partner_b");

  let role: ParticipantRole;
  if (!partnerA) role = "partner_a";
  else if (!partnerB) role = "partner_b";
  else throw new Error("Room is full");

  const newParticipant = db.createParticipant({ room_id: room.id, role, name });

  const intro =
    "Hi — before we bring you and your partner together, I'd like to quickly hear your side of things. This is just between us. What's been going on?";
  db.createMessage({
    room_id: room.id,
    role: "assistant",
    text: intro,
    phase: "intake",
    intake_participant_id: newParticipant.id,
  });

  const allParticipants = [...participants, newParticipant];
  const messages = getVisibleMessages(room.id, room, newParticipant.id);

  return {
    participantId: newParticipant.id,
    role,
    state: buildRoomState(room, newParticipant, allParticipants, false, null),
    messages,
  };
}

export async function sendMessage(participantId: string, content: string): Promise<void> {
  const participant = getParticipant(participantId);
  const room = getRoom(participant.room_id);
  const participants = getParticipants(room.id);

  if (!canSend(room, participant, false)) {
    throw new Error("It is not your turn to send a message right now.");
  }

  if (room.phase === "commons") {
    db.createMessage({
      room_id: room.id,
      role: participant.role,
      author_name: participant.name,
      text: content,
      phase: "commons",
    });

    const commonsMessages = db.getMessagesByRoom(room.id, { phase: "commons" });

    const partnerA = participants.find((p) => p.role === "partner_a");
    const partnerB = participants.find((p) => p.role === "partner_b");

    const anthropicMessages: MessageParam[] = commonsMessages
      .filter((msg: ChatMessage) => !isConclusionMarker(msg))
      .map((msg: ChatMessage) => {
        if (msg.role === "assistant") {
          return { role: "assistant" as const, content: msg.text };
        }
        const name =
          msg.role === "partner_a"
            ? partnerA?.name || "Partner A"
            : partnerB?.name || "Partner B";
        const label =
          msg.role === "partner_a"
            ? `Partner A (${partnerA?.name || "Partner A"})`
            : `Partner B (${partnerB?.name || "Partner B"})`;
        if (isHandRaisedMarker(msg)) {
          return { role: "user" as const, content: `[${name} raised their hand — they have something they'd like to say]` };
        }
        return { role: "user" as const, content: `${label}: ${msg.text}` };
      });

    const systemPrompt = buildCommonsPrompt(
      partnerA?.name || "Partner A",
      parseSummary(partnerA?.summary || "").intake,
      partnerB?.name || "Partner B",
      parseSummary(partnerB?.summary || "").intake,
      commonsMessages.length,
    );

    const rawResponse = await generateResponse(systemPrompt, anthropicMessages, { thinking: true });
    const { cleanText, nextSpeaker } = parseNextSpeaker(rawResponse);

    db.createMessage({
      room_id: room.id,
      role: "assistant",
      text: cleanText,
      phase: "commons",
    });

    if (nextSpeaker) {
      db.updateRoom(room.id, { active_speaker: nextSpeaker });
    }
  } else {
    db.createMessage({
      room_id: room.id,
      role: participant.role,
      author_name: participant.name,
      text: content,
      phase: "intake",
      intake_participant_id: participantId,
    });

    const intakeMessages = db.getMessagesByRoom(room.id, {
      phase: "intake",
      intake_participant_id: participantId,
    });

    const anthropicMessages: MessageParam[] = intakeMessages.map(
      (msg: ChatMessage) => ({
        role: msg.role === "assistant" ? ("assistant" as const) : ("user" as const),
        content: msg.role === "assistant" ? msg.text : `${participant.name}: ${msg.text}`,
      }),
    );

    const response = await generateResponse(INTAKE_PROMPT, anthropicMessages);

    db.createMessage({
      room_id: room.id,
      role: "assistant",
      text: response,
      phase: "intake",
      intake_participant_id: participantId,
    });
  }
}

export async function markReady(participantId: string): Promise<void> {
  const participant = getParticipant(participantId);
  const room = getRoom(participant.room_id);

  if (room.phase !== "intake") throw new Error("Already in the joint session.");
  if (participant.ready) return;

  const intakeMessages = db.getMessagesByRoom(room.id, {
    phase: "intake",
    intake_participant_id: participantId,
  });

  const transcript = intakeMessages
    .map((msg: ChatMessage) => (msg.role === "assistant" ? `Ash: ${msg.text}` : `${participant.name}: ${msg.text}`))
    .join("\n\n");

  const summary = await summarize(SUMMARY_PROMPT, transcript);

  db.updateParticipant(participantId, { ready: true, summary: encodeSummary(summary, false) });

  const participants = getParticipants(room.id);
  const allReady = participants.length === 2 && participants.every((p) => p.ready || p.id === participantId);

  if (allReady) {
    db.updateRoom(room.id, { phase: "commons" });

    const partnerA = participants.find((p) => p.role === "partner_a");
    const partnerB = participants.find((p) => p.role === "partner_b");

    const aSummary = partnerA?.id === participantId ? summary : parseSummary(partnerA?.summary || "").intake;
    const bSummary = partnerB?.id === participantId ? summary : parseSummary(partnerB?.summary || "").intake;

    const openingPrompt = buildOpeningPrompt(
      partnerA?.name || "Partner A",
      aSummary,
      partnerB?.name || "Partner B",
      bSummary,
    );

    const rawOpening = await generateResponse(openingPrompt, [
      { role: "user", content: "Begin the joint session." },
    ], { thinking: true });
    const { cleanText, nextSpeaker } = parseNextSpeaker(rawOpening);

    db.updateRoom(room.id, { active_speaker: nextSpeaker || "either" });

    db.createMessage({
      room_id: room.id,
      role: "assistant",
      text: cleanText,
      phase: "commons",
    });
  }
}

export async function raiseHand(participantId: string): Promise<void> {
  const participant = getParticipant(participantId);
  const room = getRoom(participant.room_id);

  if (room.phase !== "commons") throw new Error("Hand raise is only available during the commons phase.");

  const recent = db.getRecentMessages(room.id, "commons", 20);

  for (const msg of recent) {
    if (msg.role === "assistant") break;
    if (isHandRaisedMarker(msg) && msg.role === participant.role) {
      return;
    }
  }

  db.createMessage({
    room_id: room.id,
    role: participant.role,
    author_name: participant.name,
    text: HAND_RAISED_MARKER,
    phase: "commons",
  });
}

export async function markWrapUp(participantId: string): Promise<void> {
  const participant = getParticipant(participantId);
  const room = getRoom(participant.room_id);

  if (room.phase !== "commons") throw new Error("Wrap up is only available during the commons phase.");

  const { intake, wrapUpReady } = parseSummary(participant.summary);
  if (wrapUpReady) return;

  db.updateParticipant(participantId, { summary: encodeSummary(intake, true) });

  const participants = getParticipants(room.id);
  const allWrapUp =
    participants.length === 2 &&
    participants.every((p) => {
      if (p.id === participantId) return true;
      return parseSummary(p.summary).wrapUpReady;
    });

  if (allWrapUp) {
    const commonsMessages = db.getMessagesByRoom(room.id, { phase: "commons" });

    const partnerA = participants.find((p) => p.role === "partner_a");
    const partnerB = participants.find((p) => p.role === "partner_b");

    const transcript = commonsMessages
      .map((msg: ChatMessage) => {
        if (msg.role === "assistant") return `Ash: ${msg.text}`;
        const name =
          msg.role === "partner_a"
            ? partnerA?.name || "Partner A"
            : partnerB?.name || "Partner B";
        return `${name}: ${msg.text}`;
      })
      .join("\n\n");

    const rawSummary = await generateResponse(CONCLUSION_PROMPT, [
      { role: "user", content: transcript },
    ]);

    db.createMessage({
      room_id: room.id,
      role: "assistant",
      text: `${CONCLUSION_MARKER}${rawSummary}-->`,
      phase: "commons",
    });
  }
}

export async function pollRoom(
  participantId: string,
): Promise<{ state: RoomState; messages: ChatMessage[] }> {
  const participant = getParticipant(participantId);
  const room = getRoom(participant.room_id);
  const participants = getParticipants(room.id);
  const allMessages = getVisibleMessages(room.id, room, participantId);

  const conclusionSummary = extractConclusionSummary(allMessages);
  const isConclusion = conclusionSummary !== null;
  const handsRaised = detectHandsRaised(allMessages);
  const messages = allMessages.filter((m) => !isConclusionMarker(m) && !isHandRaisedMarker(m));

  const state = buildRoomState(room, participant, participants, isConclusion, conclusionSummary, handsRaised);

  return { state, messages };
}
