import { sessionStore } from "./browser-storage.ts";
import type { GameConfig, Player, VoiceBlockData } from "@/types/game";

import { partyThemes } from "./game/party-content.ts";
import { allVoiceOptions } from "./game/voices.ts";

export const defaultConfig: GameConfig = {
  mode: "classic",
  playerCount: 4,
  theme: "冰箱把你的夜宵挂上了闲鱼",
  voice: "warm",
  teamName: "周末小剧场",
};

export const players: Player[] = [
  { id: "milo", name: "Milo", color: "purple", ready: true, host: true },
  { id: "amy", name: "Amy", color: "blue", ready: true },
  { id: "tom", name: "Tom", color: "green", ready: true },
  { id: "miya", name: "Miya", color: "yellow", ready: true },
  { id: "lena", name: "Lena", color: "pink", ready: false },
];

export const classicBlocks: VoiceBlockData[] = [
  { id: "c1", text: "冰箱把夜宵挂上闲鱼，", duration: 2.3, player: players[1] },
  { id: "c2", text: "还写着主人从没吃过，", duration: 2.8, player: players[2] },
  { id: "c3", text: "我妈立刻下了单。", duration: 3.1, player: players[3] },
];

export const classicFinalBlock: VoiceBlockData = {
  id: "c4",
  text: "到货以后让我付了运费。",
  duration: 2.7,
  player: players[0],
};

export const chaosBlocks: VoiceBlockData[] = [
  { id: "h1", text: "本人郑重宣布，", duration: 2.5, player: players[1] },
  { id: "h2", text: "老板变成了一只鹅，", duration: 2.4, player: players[2] },
  { id: "h3", text: "请大家自带面包，", duration: 2.6, player: players[3] },
  { id: "h4", text: "工资改成按蛋结算。", duration: 2.3, player: players[0] },
];

export { voiceOptions } from "./game/voices.ts";

export const randomThemes = partyThemes;

export function getConfig(roomId = "demo"): GameConfig {
  if (typeof window === "undefined") return defaultConfig;
  const saved = sessionStore.getItem(roomId === "solo" ? "voice-bricks-solo-config" : "voice-bricks-config");
  if (!saved) return defaultConfig;
  try {
    const config = { ...defaultConfig, ...JSON.parse(saved) } as GameConfig;
    return { ...config, voice: allVoiceOptions.some(voice => voice.id === config.voice) ? config.voice : defaultConfig.voice };
  } catch {
    return defaultConfig;
  }
}

export function saveConfig(config: GameConfig, roomId = "demo") {
  sessionStore.setItem(roomId === "solo" ? "voice-bricks-solo-config" : "voice-bricks-config", JSON.stringify(config));
}

function blocksStorageKey(mode: GameConfig["mode"], roomId: string) {
  return `voice-bricks-${roomId === "solo" ? "solo-" : ""}blocks-${mode}`;
}

export function saveBlocks(blocks: VoiceBlockData[], mode: GameConfig["mode"], roomId = "demo") {
  sessionStore.setItem(blocksStorageKey(mode, roomId), JSON.stringify(blocks));
}

export function clearBlocks(roomId = "demo") {
  sessionStore.removeItem(blocksStorageKey("classic", roomId));
  sessionStore.removeItem(blocksStorageKey("chaos", roomId));
  if (roomId === "solo") {
    sessionStore.removeItem("voice-bricks-solo-draft");
    sessionStore.removeItem("voice-bricks-solo-edit-used");
    return;
  }
  sessionStore.removeItem("voice-bricks-blocks");
  sessionStore.removeItem("voice-bricks-final-audio");
}

export function getBlocks(mode: GameConfig["mode"], roomId = "demo"): VoiceBlockData[] {
  if (typeof window !== "undefined") {
    const saved = sessionStore.getItem(blocksStorageKey(mode, roomId));
    if (saved) {
      try {
        return JSON.parse(saved) as VoiceBlockData[];
      } catch {
        // Fall through to deterministic mock data.
      }
    }
  }
  if (roomId === "solo") return [];
  return mode === "chaos"
    ? chaosBlocks
    : [...classicBlocks, classicFinalBlock];
}
