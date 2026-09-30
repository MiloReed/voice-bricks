import { duckPartyMusic } from "./party-sound.ts";
import { getPresetPreview } from "./preset-preview.ts";

export function estimateDuration(text: string) {
  const length = text.trim().length;
  if (!length) return 0;
  return Math.max(1.2, Math.round((length / 4.7) * 10) / 10);
}

let activeAudio: HTMLAudioElement | null = null;
let activeDeviceSpeech: SpeechSynthesisUtterance | null = null;
let playbackId = 0;
const previewCache = new Map<string, string>();
const previewRequests = new Map<string, Promise<string>>();
const MAX_PREVIEW_CACHE_SIZE = 16;

export const TTS_ERROR_EVENT = "voice-bricks:tts-error";
export const TTS_DEVICE_VOICE_EVENT = "voice-bricks:device-voice";

function clearActiveAudio() {
  if (activeDeviceSpeech) {
    activeDeviceSpeech.onend = null;
    activeDeviceSpeech.onerror = null;
    activeDeviceSpeech = null;
    window.speechSynthesis.cancel();
  }
  activeAudio?.pause();
  if (activeAudio) {
    activeAudio.onended = null;
    activeAudio.onerror = null;
    activeAudio.ontimeupdate = null;
  }
  activeAudio = null;
  duckPartyMusic(false);
}

export function stopSpeech() { playbackId++; clearActiveAudio(); }

function previewKey(text: string, voiceId: string) {
  return `${voiceId}\u0000${text.trim()}`;
}

function cachePreview(key: string, url: string) {
  if (previewCache.size >= MAX_PREVIEW_CACHE_SIZE) {
    const oldestKey = previewCache.keys().next().value;
    if (oldestKey) {
      URL.revokeObjectURL(previewCache.get(oldestKey)!);
      previewCache.delete(oldestKey);
    }
  }
  previewCache.set(key, url);
}

async function loadPreview(text: string, voiceId: string) {
  const preset = getPresetPreview(text, voiceId);
  if (preset) return preset;
  const key = previewKey(text, voiceId);
  const cached = previewCache.get(key);
  if (cached) return cached;
  const pending = previewRequests.get(key);
  if (pending) return pending;

  const request = fetch("/api/tts/preview", {
    signal: AbortSignal.timeout(55000),
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, voiceId }),
  }).then(async (response) => {
    if (!response.ok) throw new Error(`TTS preview failed: ${response.status}`);
    const url = URL.createObjectURL(await response.blob());
    cachePreview(key, url);
    return url;
  }).finally(() => previewRequests.delete(key));

  previewRequests.set(key, request);
  return request;
}

function reportTtsError() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(TTS_ERROR_EVENT));
}

function playDeviceVoice(text: string, currentPlaybackId: number, onEnd?: () => void, onError?: () => void, onStart?: () => void, onTime?: (currentTime: number, duration: number) => void) {
  if (typeof window === "undefined" || !("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) return false;
  const utterance = new window.SpeechSynthesisUtterance(text);
  utterance.lang = "zh-CN";
  utterance.voice = window.speechSynthesis.getVoices().find(voice => /^zh/.test(voice.lang)) ?? null;
  utterance.onstart = () => { if (currentPlaybackId === playbackId) onStart?.(); };
  utterance.onboundary = event => { if (currentPlaybackId === playbackId) onTime?.(event.charIndex / Math.max(1, text.length) * estimateDuration(text), estimateDuration(text)); };
  utterance.onend = () => { if (currentPlaybackId !== playbackId) return; clearActiveAudio(); onEnd?.(); };
  utterance.onerror = () => { if (currentPlaybackId !== playbackId) return; clearActiveAudio(); onError?.(); reportTtsError(); };
  activeDeviceSpeech = utterance;
  window.speechSynthesis.speak(utterance);
  window.dispatchEvent(new CustomEvent(TTS_DEVICE_VOICE_EVENT));
  return true;
}

export async function speak(text: string, onEnd: (() => void) | undefined, voiceId: string, onError?: () => void, audioUrl?: string, onStart?: () => void, allowDeviceVoice = false) {
  const currentPlaybackId = ++playbackId;
  clearActiveAudio();

  if (typeof window === "undefined") {
    onError?.();
    return;
  }

  const fail = () => {
    if (currentPlaybackId !== playbackId) return;
    clearActiveAudio();
    if (allowDeviceVoice && playDeviceVoice(text, currentPlaybackId, onEnd, onError, onStart)) { duckPartyMusic(true); return; }
    onError?.();
    reportTtsError();
  };

  duckPartyMusic(true);
  try {
    let source = audioUrl ?? "";
    if (!source) source = await loadPreview(text, voiceId);
    if (currentPlaybackId !== playbackId) return;
    activeAudio = new Audio(source);
    activeAudio.onended = () => {
      if (currentPlaybackId !== playbackId) return;
      clearActiveAudio();
      onEnd?.();
    };
    activeAudio.onerror = fail;
    await activeAudio.play();
    if (currentPlaybackId === playbackId) onStart?.();
  } catch {
    fail();
  }
}

export async function playRenderedAudio(
  input: { text: string; voiceId: string; audioUrl?: string | null; allowDeviceVoice?: boolean },
  onTime: (currentTime: number, duration: number) => void,
  onEnd: () => void,
  onError?: () => void,
) {
  const currentPlaybackId = ++playbackId;
  clearActiveAudio();

  const fail = () => {
    if (currentPlaybackId !== playbackId) return;
    clearActiveAudio();
    if (input.allowDeviceVoice && playDeviceVoice(input.text, currentPlaybackId, onEnd, onError, undefined, onTime)) { duckPartyMusic(true); return; }
    onError?.();
    reportTtsError();
  };

  duckPartyMusic(true);
  try {
    let source = input.audioUrl ?? "";
    if (!source) source = await loadPreview(input.text, input.voiceId);
    if (currentPlaybackId !== playbackId) return;

    activeAudio = new Audio(source);
    activeAudio.ontimeupdate = () => {
      if (currentPlaybackId === playbackId && activeAudio) onTime(activeAudio.currentTime, activeAudio.duration);
    };
    activeAudio.onended = () => {
      if (currentPlaybackId !== playbackId) return;
      clearActiveAudio();
      onEnd();
    };
    activeAudio.onerror = fail;
    await activeAudio.play();
  } catch {
    fail();
  }
}
