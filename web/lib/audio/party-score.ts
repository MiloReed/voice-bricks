export type SoundScene = "lobby" | "play" | "assembly" | "quiet";
export type SoundCue = "tap" | "join" | "submit" | "snap" | "start" | "count" | "finish";
export const SOUND_DEFAULTS = { enabled: false, music: true, effects: true, volume: 0.45 };
export type SoundSettings = typeof SOUND_DEFAULTS;
export function soundScene(path: string): SoundScene {
  if (path.startsWith("/work/") || path.endsWith("/reveal")) return "quiet";
  if (path.endsWith("/assembly")) return "assembly";
  if (path.endsWith("/play")) return "play";
  return "lobby";
}
export function readSoundSettings(raw: string | null): SoundSettings {
  try {
    const value = JSON.parse(raw || "null");
    if (!value || typeof value !== "object") return { ...SOUND_DEFAULTS };
    return { enabled: value.enabled === true, music: value.music !== false, effects: value.effects !== false,
      volume: typeof value.volume === "number" && Number.isFinite(value.volume) ? Math.max(0, Math.min(1, value.volume)) : SOUND_DEFAULTS.volume };
  } catch { return { ...SOUND_DEFAULTS }; }
}

// Original four-bar C–Am–F–G toy-mallet loop, 100 BPM, no sampled recordings.
export const BASS = [48, 45, 41, 43];
export const MELODY = [72, 0, 76, 79, 0, 76, 74, 0, 69, 0, 72, 76, 0, 72, 67, 0,
  69, 0, 72, 77, 0, 76, 72, 0, 67, 0, 71, 74, 0, 71, 74, 0];
export const CUES: Record<SoundCue, number[]> = {
  tap: [79], join: [72, 76], submit: [72, 79, 84], snap: [67, 79],
  start: [60, 64, 67, 72], count: [76], finish: [72, 76, 79, 84],
};
