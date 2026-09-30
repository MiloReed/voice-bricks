import assert from "node:assert/strict";
import { it } from "node:test";
import { generateVuiAudio } from "../lib/tts/vui.ts";
import { getVuiVoiceId } from "../lib/tts/providers/vui.ts";
import { voiceOptions } from "../lib/mock-data.ts";
import { allVoiceOptions, legacyVoiceOptions } from "../lib/game/voices.ts";

it("offers eight distinct voices and preserves all twelve previous room IDs", () => {
  assert.equal(voiceOptions.length, 8);
  assert.equal(new Set(voiceOptions.map(voice => voice.vuiId)).size, 8);
  for (const id of ["warm", "bright", "deep", "cinema", "story", "cheerful", "crisp", "calm", "radio", "dramatic", "playful", "documentary"]) assert.ok(allVoiceOptions.some(voice => voice.id === id));
  for (const voice of allVoiceOptions) assert.equal(getVuiVoiceId(voice.id), voice.vuiId);
  assert.equal(legacyVoiceOptions.length, 6);
  assert.equal(voiceOptions.find(voice => voice.id === "dramatic")?.name, "热血解说");
});

it("maps every saved game voice to a VUI system voice without Fish IDs", () => {
  for (const voice of voiceOptions) assert.match(getVuiVoiceId(voice.id), /^[a-z]+$/);
  for (const id of ["unknown", "constructor", "toString", "__proto__"]) assert.throws(() => getVuiVoiceId(id), /音色/);
});

it("uses the CN endpoint and Chinese generate_text contract", async () => {
  const wav = new Uint8Array(44);
  wav.set(new TextEncoder().encode("RIFF"));
  wav.set(new TextEncoder().encode("WAVE"), 8);
  const audio = await generateVuiAudio({ text: "声音积木", voiceId: "jingcheng", key: "test-key" }, async (url, options) => {
    assert.equal(url, "https://api.vuilabs.cn/v1/text-to-speech");
    const body = JSON.parse(options!.body as string);
    assert.equal(body.generate_text, "声音积木");
    assert.equal(body.text, undefined);
    assert.equal(body.model_id, "luna-tts");
    assert.equal(body.language, "zh");
    return new Response(wav, { headers: { "content-type": "audio/wav; charset=binary" } });
  });
  assert.equal(audio.byteLength, 44);
});

it("rejects missing keys, wrong MIME and truncated audio", async () => {
  const input = { text: "你好", voiceId: "jingcheng", key: "test-key" };
  await assert.rejects(generateVuiAudio({ ...input, key: "" }, async () => { throw new Error("should not fetch"); }), /VUILABS_API_KEY/);
  await assert.rejects(generateVuiAudio(input, async () => new Response(new Uint8Array(44), { headers: { "content-type": "audio/pcm" } })), /WAV/);
  await assert.rejects(generateVuiAudio(input, async () => new Response("RIFF", { headers: { "content-type": "audio/wav" } })), /WAV/);
});

it("validates Chinese weighted length and expression tags before spending TTS quota", async () => {
  let calls = 0;
  const transport: typeof fetch = async () => { calls++; throw new Error("should not fetch"); };
  for (const text of [" ", "声".repeat(251), "[whisper]声音积木"]) {
    await assert.rejects(generateVuiAudio({ text, voiceId: "jingcheng", key: "test-key" }, transport), /500/);
  }
  assert.equal(calls, 0);
});
