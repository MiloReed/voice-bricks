import { BASS, MELODY, CUES, SOUND_DEFAULTS, type SoundCue, type SoundScene, type SoundSettings } from "./party-score.ts";

let context: AudioContext | null = null;
let musicBus: GainNode;
let effectsBus: GainNode;
let timer: ReturnType<typeof setInterval> | undefined;
let settings = { ...SOUND_DEFAULTS };
let scene: SoundScene = "quiet";
let speaking = false;
let step = 0;
let nextBeat = 0;
let lastCue = 0;

function mix() {
  if (!context) return;
  const audible = settings.enabled && !document.hidden;
  musicBus.gain.setTargetAtTime(audible && settings.music && scene !== "quiet" ? settings.volume * (speaking ? 0.015 : 0.16) : 0, context.currentTime, 0.08);
  effectsBus.gain.setTargetAtTime(audible && settings.effects ? settings.volume * 0.35 : 0, context.currentTime, 0.02);
}

function note(midi: number, at: number, length: number, bus: GainNode, volume = 0.3, type: OscillatorType = "sine") {
  if (!context) return;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(440 * 2 ** ((midi - 69) / 12), at);
  gain.gain.setValueAtTime(0, at);
  gain.gain.linearRampToValueAtTime(volume, at + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + length);
  oscillator.connect(gain).connect(bus);
  oscillator.start(at); oscillator.stop(at + length + 0.02);
  oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
}

function schedule() {
  if (!context || context.state !== "running" || !settings.enabled || !settings.music || scene === "quiet" || document.hidden) return;
  if (nextBeat < context.currentTime) nextBeat = context.currentTime + 0.03;
  while (nextBeat < context.currentTime + 0.12) {
    const beat = step % 32;
    const pitch = MELODY[beat];
    if (pitch && (scene !== "play" || beat % 2 === 0)) note(pitch, nextBeat, 0.25, musicBus, 0.24, "triangle");
    if (beat % 4 === 0) note(BASS[Math.floor(beat / 8)], nextBeat, 0.45, musicBus, 0.42);
    if (scene === "assembly" && beat % 2 === 1) note(91, nextBeat, 0.025, musicBus, 0.07);
    step++; nextBeat += 0.3;
  }
}

export async function unlockPartySound() {
  if (typeof window === "undefined" || !settings.enabled) return;
  try {
    context ??= new AudioContext();
    if (!musicBus) {
      musicBus = context.createGain(); effectsBus = context.createGain();
      musicBus.gain.value = 0; effectsBus.gain.value = 0;
      musicBus.connect(context.destination); effectsBus.connect(context.destination);
    }
    if (context.state === "suspended") await context.resume();
    mix();
    timer ??= setInterval(schedule, 50);
  } catch { throw new Error("浏览器暂时无法开启声音，请再点一次或更换浏览器。"); }
}

export function configurePartySound(next: SoundSettings, nextScene: SoundScene) {
  settings = next; scene = nextScene; mix();
}
export function duckPartyMusic(active: boolean) { speaking = active; mix(); }
export function playPartyCue(cue: SoundCue) {
  if (!context || context.state !== "running" || !settings.enabled || !settings.effects || document.hidden) return;
  if (context.currentTime - lastCue < 0.065) return;
  lastCue = context.currentTime;
  CUES[cue].forEach((pitch, i) => note(pitch, context!.currentTime + i * 0.065, cue === "tap" ? 0.045 : 0.18, effectsBus, cue === "tap" ? 0.13 : 0.3, "triangle"));
}
export function suspendPartySound() {
  clearInterval(timer); timer = undefined;
  if (context?.state === "running") void context.suspend().catch(() => {});
}
