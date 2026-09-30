export type PlayerColor = "purple" | "blue" | "green" | "yellow" | "pink";

export type GameMode = "classic" | "chaos";

export interface Player {
  id: string;
  name: string;
  color: PlayerColor;
  ready: boolean;
  host?: boolean;
  online?: boolean;
}

export interface VoiceBlockData {
  id: string;
  text: string;
  duration: number;
  audioUrl?: string;
  player: Player;
}

export interface GameConfig {
  mode: GameMode;
  playerCount: number;
  theme: string;
  voice: string;
  teamName: string;
}

export interface PublicWorkPayload {
  version: 1;
  config: GameConfig;
  blocks: VoiceBlockData[];
}
