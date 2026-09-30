import { generateVuiAudio } from "../vui.ts";
import { allVoiceOptions } from "../../game/voices.ts";

// Keep saved room voice IDs stable while selecting documented VUI system voices.
export const vuiVoiceIds: Record<string, string> = Object.fromEntries(allVoiceOptions.map(voice => [voice.id, voice.vuiId]));

export function getVuiVoiceId(gameVoiceId: string) {
  const voiceId = Object.hasOwn(vuiVoiceIds, gameVoiceId) ? vuiVoiceIds[gameVoiceId] : undefined;
  if (!voiceId) throw new Error("不支持的游戏音色");
  return voiceId;
}

export async function generateGameAudio(text: string, gameVoiceId: string) {
  const bytes = await generateVuiAudio({
    text, voiceId: getVuiVoiceId(gameVoiceId),
    key: process.env.VUILABS_API_KEY ?? "", baseUrl: process.env.VUILABS_API_BASE_URL,
  });
  return { bytes, contentType: "audio/wav", provider: "vuilabs" };
}
