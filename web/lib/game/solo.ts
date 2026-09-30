import type { Player } from "../../types/game.ts";

export const SOLO_BLOCK_COUNT = 6;
export const soloPlayers: Player[] = [
  { id: "solo-you", name: "你", color: "purple", ready: true, host: true },
  { id: "solo-goose", name: "机器人·接梗鹅", color: "blue", ready: true },
  { id: "solo-cat", name: "机器人·反转猫", color: "green", ready: true },
];
