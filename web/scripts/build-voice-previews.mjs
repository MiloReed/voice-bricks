// Explicit maintenance command, never run during deployment builds.
// Reuses unchanged clips; only the eight public picker samples reach VUI.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { voiceOptions } from "../lib/game/voices.ts";
import { generateGameAudio } from "../lib/tts/providers/vui.ts";

const directory = new URL("../public/audio/previews/", import.meta.url);
const manifestPath = new URL("../lib/audio/voice-previews.json", import.meta.url);
await mkdir(directory, { recursive: true });
const manifest = {};
for (const voice of voiceOptions) {
  const hash = createHash("sha256").update(`luna-tts:1:${voice.vuiId}:${voice.sample}`).digest("hex").slice(0, 16);
  const filename = `${voice.id}-${hash}.mp3`;
  const output = new URL(filename, directory);
  let bytes = await readFile(output).catch(() => null);
  if (!bytes) {
    const started = performance.now();
    const audio = await generateGameAudio(voice.sample, voice.id);
    const encoded = spawnSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-i", "pipe:0", "-vn", "-codec:a", "libmp3lame", "-b:a", "64k", "-f", "mp3", "pipe:1"], { input: Buffer.from(audio.bytes), maxBuffer: 4 * 1024 * 1024 });
    if (encoded.status !== 0 || encoded.stdout.length < 100) throw new Error(`Encoding failed: ${voice.id}`);
    bytes = encoded.stdout;
    await writeFile(output, bytes);
    console.log(JSON.stringify({ voice: voice.id, generationMs: Math.round(performance.now() - started), wavBytes: audio.bytes.byteLength, mp3Bytes: bytes.length }));
  }
  manifest[voice.id] = { text: voice.sample, vuiId: voice.vuiId, url: `/audio/previews/${filename}` };
}
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
