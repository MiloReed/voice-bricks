import assert from "node:assert/strict";
import { it } from "node:test";
import { partyThemes, demoReply } from "../lib/game/party-content.ts";
import { chaosBlocks, voiceOptions } from "../lib/mock-data.ts";

it("presets fit the theme, Chaos and preview input limits", () => {
  assert.equal(new Set(partyThemes).size, partyThemes.length);
  assert.ok(partyThemes.every(text => text.length > 0 && text.length <= 24));
  assert.ok(chaosBlocks.every(block => block.text.length <= 12));
  assert.ok(voiceOptions.every(voice => voice.sample.length <= 80));
});

it("demo replies vary by theme and stay within the shortest Classic input limit", () => {
  assert.notEqual(demoReply("老板说团建预算只有七块钱", 0), demoReply("冰箱把你的夜宵挂上了闲鱼", 0));
  for (const theme of [...partyThemes, "自定义星球"]) {
    for (let index = 0; index < 10; index++) assert.ok(demoReply(theme, index).length <= 12);
  }
});
