import assert from "node:assert/strict";
import { test } from "node:test";
import { playRenderedAudio, speak, stopSpeech, TTS_DEVICE_VOICE_EVENT, TTS_ERROR_EVENT } from "../lib/audio/speech.ts";

test("only solo playback opts into device voice and stale utterances cannot continue playback", async () => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const originalFetch = globalThis.fetch;
  const events: string[] = [];
  class Utterance {
    text: string;
    lang = "";
    voice: unknown;
    onend: (() => void) | null = null;
    onerror: (() => void) | null = null;
    onboundary: ((event: { charIndex: number }) => void) | null = null;
    constructor(text: string) { this.text = text; }
  }
  const utterances: Utterance[] = [];
  const chineseVoice = { lang: "zh-CN" };
  Object.defineProperty(globalThis, "window", { configurable: true, value: {
    SpeechSynthesisUtterance: Utterance,
    speechSynthesis: { cancel() {}, getVoices: () => [chineseVoice], speak: (value: Utterance) => utterances.push(value) },
    dispatchEvent: (event: Event) => events.push(event.type),
  } });
  globalThis.fetch = async () => new Response("", { status: 503 });
  try {
    let errors = 0;
    let ends = 0;
    await speak("多人模式测试", () => ends++, "warm", () => errors++);
    assert.equal(utterances.length, 0);
    assert.equal(errors, 1);
    assert.deepEqual(events, [TTS_ERROR_EVENT]);
    await speak("单人模式测试", () => ends++, "warm", () => errors++, undefined, undefined, true);
    assert.equal(utterances[0].lang, "zh-CN");
    assert.equal(utterances[0].voice, chineseVoice);
    assert.equal(events.at(-1), TTS_DEVICE_VOICE_EVENT);
    const staleEnd = utterances[0].onend!;
    stopSpeech();
    staleEnd();
    assert.equal(ends, 0);
    const times: number[] = [];
    await playRenderedAudio({ text: "这是整段测试", voiceId: "warm", allowDeviceVoice: true }, time => times.push(time), () => ends++);
    utterances[1].onboundary!({ charIndex: 3 });
    assert.ok(times[0] > 0);
    utterances[1].onend!();
    assert.equal(ends, 1);
    assert.equal(errors, 1);
  } finally {
    stopSpeech();
    globalThis.fetch = originalFetch;
    if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
    else Reflect.deleteProperty(globalThis, "window");
  }
});
