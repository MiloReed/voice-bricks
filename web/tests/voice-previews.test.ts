import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { parseBuffer } from "music-metadata";
import { voiceOptions } from "../lib/game/voices.ts";
import { getPresetPreview } from "../lib/audio/preset-preview.ts";

test("all eight picker samples have compact, playable, versioned recordings", async () => {
  for (const voice of voiceOptions) {
    const url = getPresetPreview(voice.sample, voice.id);
    assert.match(url!, /^\/audio\/previews\/[a-z]+-[0-9a-f]{16}\.mp3$/);
    const audio = await readFile(new URL(`../public${url}`, import.meta.url));
    assert.ok(audio.length < 60000, `${voice.id} should stay below 60 KB`);
    const metadata = await parseBuffer(audio, { mimeType: "audio/mpeg" }, { duration: true });
    assert.ok(metadata.format.duration! > 1 && metadata.format.duration! < 15);
  }
});

test("only exact matching public samples can use a preset", () => {
  const voice = voiceOptions[0];
  assert.equal(getPresetPreview(` ${voice.sample} `, voice.id), getPresetPreview(voice.sample, voice.id));
  assert.equal(getPresetPreview("玩家自己写的内容", voice.id), undefined);
  assert.equal(getPresetPreview(voice.sample, "bright"), undefined);
  assert.equal(getPresetPreview(voice.sample, "unknown"), undefined);
});
