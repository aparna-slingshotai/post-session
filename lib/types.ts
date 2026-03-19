export type ParticipantRole = "partner_a" | "partner_b";
export type NextSpeaker = ParticipantRole | "either";
export type RoomPhase = "intake" | "commons" | "conclusion";
export type MessageRole = ParticipantRole | "assistant";

export interface ChatMessage {
  id: string;
  role: MessageRole;
  text: string;
  author_name?: string;
  phase: RoomPhase;
  intake_participant_id?: string | null;
  created_at?: string;
}

export interface RoomState {
  phase: RoomPhase;
  participantRole: ParticipantRole;
  participantName: string;
  partnerAName: string | null;
  partnerBName: string | null;
  partnerAReady: boolean;
  partnerBReady: boolean;
  partnerConnected: boolean;
  activeSpeaker: NextSpeaker | null;
  canSend: boolean;
  partnerAWrapUp: boolean;
  partnerBWrapUp: boolean;
  partnerAHandRaised: boolean;
  partnerBHandRaised: boolean;
  conclusionSummary: string | null;
}

export interface Room {
  id: string;
  phase: "intake" | "commons"; // DB only has these two enum values
  active_speaker: NextSpeaker | null;
}

export interface Participant {
  id: string;
  room_id: string;
  role: ParticipantRole;
  name: string;
  ready: boolean;
  summary: string; // JSON-encoded: { intake: string, wrapUpReady: boolean }
}
