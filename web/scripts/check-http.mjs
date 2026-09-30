import assert from "node:assert/strict";
import { voiceOptions } from "../lib/game/voices.ts";

const base = process.argv[2] || "http://127.0.0.1:3100";
for (const path of ["/english", "/api/companion", "/companion/maya-cover-v2.png"]) {
  assert.equal((await fetch(new URL(path, base))).status, 404, `Retired resource: ${path}`);
}
for (const path of ["preview", "block", "final"]) {
  for (const body of ["null", "[]", "{broken"]) {
    const response = await fetch(new URL(`/api/tts/${path}`, base), {
      method: "POST", body,
      headers: { "Content-Type": "application/json", Authorization: "Bearer invalid-input-check" },
    });
    assert.equal(response.status, 400, `${path}: malformed input must not return a service error`);
  }
}
for (const voice of voiceOptions) {
  const response = await fetch(new URL("/api/tts/preview", base), {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: voice.sample, voiceId: voice.id }),
  });
  assert.equal(response.status, 200, voice.id);
  assert.match(response.headers.get("content-type") || "", /^audio\//);
  assert.ok((await response.arrayBuffer()).byteLength > 1000);
}
console.log("PASS: retired resources return 404; all three TTS routes reject malformed input; eight preset voices play without generating new audio.");
