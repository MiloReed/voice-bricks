import assert from "node:assert/strict";
import { test } from "node:test";
import { speak, playRenderedAudio } from "../lib/audio/speech.ts";
import { voiceOptions } from "../lib/game/voices.ts";

test("ending one clip preserves the next clip and ignores stale end events", async () => {
  class FakeAudio {
    static instances: FakeAudio[] = [];
    onended: (() => void) | null = null;
    onerror: (() => void) | null = null;
    ontimeupdate: (() => void) | null = null;
    paused = false;
    src: string;
    constructor(src: string) { this.src = src; FakeAudio.instances.push(this); }
    pause() { this.paused = true; }
    async play() { this.paused = false; }
  }
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const originalAudio = Object.getOwnPropertyDescriptor(globalThis, "Audio");
  Object.defineProperty(globalThis, "window", { configurable: true, value: {} });
  Object.defineProperty(globalThis, "Audio", { configurable: true, value: FakeAudio });
  try {
    await speak("first", () => { void speak("second", undefined, "warm", undefined, "/second.mp3"); }, "warm", undefined, "/first.mp3");
    const oldEnd = FakeAudio.instances[0].onended!;
    oldEnd();
    assert.equal(FakeAudio.instances[1].paused, false);
    assert.ok(FakeAudio.instances[1].onended);
    oldEnd();
    assert.equal(FakeAudio.instances.length, 2);
    assert.equal(FakeAudio.instances[1].paused, false);
    await playRenderedAudio({ text: "final", voiceId: "warm", audioUrl: "/final.mp3" }, () => {}, () => {
      void speak("next", undefined, "warm", undefined, "/next.mp3");
    });
    FakeAudio.instances[2].onended!();
    assert.equal(FakeAudio.instances[3].paused, false);
    assert.ok(FakeAudio.instances[3].onended);
    let started = false;
    await speak(voiceOptions[0].sample, undefined, "warm", undefined, undefined, () => { started = true; });
    assert.match(FakeAudio.instances[4].src, /^\/audio\/previews\/warm-/);
    assert.equal(started, true);
  } finally {
    if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
    else Reflect.deleteProperty(globalThis, "window");
    if (originalAudio) Object.defineProperty(globalThis, "Audio", originalAudio);
    else Reflect.deleteProperty(globalThis, "Audio");
  }
});
