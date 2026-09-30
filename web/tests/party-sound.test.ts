import assert from "node:assert/strict";
import { it } from "node:test";
import { CUES, MELODY, readSoundSettings, soundScene } from "../lib/audio/party-score.ts";

it("sound starts opt-in and invalid stored settings remain safe", () => {
  assert.equal(readSoundSettings(null).enabled, false);
  assert.equal(readSoundSettings("broken").enabled, false);
  assert.equal(readSoundSettings('{"enabled":"yes","volume":99}').enabled, false);
  assert.equal(readSoundSettings('{"volume":99}').volume, 1);
  assert.equal(readSoundSettings('{"volume":-9}').volume, 0);
  assert.equal(readSoundSettings('{"music":false,"effects":false}').effects, false);
});
it("reveal and shared works never receive party BGM", () => {
  for (const path of ["/room/test/reveal", "/work/test"]) assert.equal(soundScene(path), "quiet");
  assert.equal(soundScene("/create"), "lobby");
  assert.equal(soundScene("/room/test/play"), "play");
  assert.equal(soundScene("/room/test/assembly"), "assembly");
});
it("original loop and cues contain only bounded musical notes", () => {
  assert.equal(MELODY.length, 32);
  for (const notes of [MELODY, ...Object.values(CUES)]) assert.ok(notes.every(n => n === 0 || n >= 36 && n <= 96));
  assert.equal(CUES.finish.length, 4);
});
