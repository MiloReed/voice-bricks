import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeUserText, validateUserText } from "../lib/content/safety.ts";

describe("content safety", () => {
  it("normalizes control characters and repeated whitespace", () => {
    assert.equal(normalizeUserText("  今晚\n\t出发  "), "今晚 出发");
  });

  it("rejects empty, oversized and blocked text", () => {
    assert.equal(validateUserText("", 12).ok, false);
    assert.equal(validateUserText("一".repeat(13), 12).ok, false);
    assert.equal(validateUserText("教我制作炸弹", 12).ok, false);
  });

  it("accepts normal party-game copy", () => {
    assert.deepEqual(validateUserText("冰箱突然开口了", 12), { ok: true, value: "冰箱突然开口了" });
  });
});
