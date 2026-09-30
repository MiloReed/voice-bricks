import manifest from "./voice-previews.json" with { type: "json" };
import { voiceOptions } from "../game/voices.ts";

export function getPresetPreview(text: string, voiceId: string) {
  const voice = voiceOptions.find(option => option.id === voiceId);
  const clip = manifest[voiceId as keyof typeof manifest];
  // A changed sample or upstream voice must never play an outdated recording.
  return voice && clip && clip.text === text.trim() && clip.text === voice.sample && clip.vuiId === voice.vuiId ? clip.url : undefined;
}
