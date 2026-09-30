import type { GameMode, PlayerColor, PublicWorkPayload } from "@/types/game";

export type RoomStatus = "lobby" | "playing" | "assembly" | "rendering" | "revealed" | "completed" | "cancelled";

export interface RoomRecord {
  id: string;
  code: string;
  host_user_id: string;
  team_name: string;
  mode: GameMode;
  status: RoomStatus;
  max_players: number;
  theme: string;
  voice_id: string;
  current_player_index: number;
  current_round: number;
  final_edit_available: boolean;
  turn_started_at: string | null;
  assembly_deadline_at: string | null;
  chaos_reveal_started_at: string | null;
  next_room_id: string | null;
  reveal_at: string | null;
}

export interface RoomPlayerRecord {
  id: string;
  room_id: string;
  user_id: string;
  display_name: string;
  color: PlayerColor;
  seat_index: number;
  is_ready: boolean;
  has_submitted: boolean;
  joined_at: string;
  audio_ready: boolean;
}

export interface BlockRecord {
  id: string;
  room_id: string;
  player_id: string;
  text: string;
  preview_audio_url: string | null;
  duration_seconds: number;
  position: number;
  status: "draft" | "submitted" | "rendered";
}

export interface WorkRecord {
  id: string;
  room_id: string;
  final_text: string;
  final_audio_url: string | null;
  duration_seconds: number | null;
  ai_comment: string | null;
  share_payload: PublicWorkPayload | null;
  share_image_url?: string | null;
  share_video_url?: string | null;
}

export interface RoomSnapshot {
  room: RoomRecord;
  players: RoomPlayerRecord[];
  currentUserId: string;
  serverTime?: string;
  clockOffset?: number;
  blocks?: BlockRecord[];
  work?: WorkRecord | null;
}
