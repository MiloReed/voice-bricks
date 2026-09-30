import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getShareCommentary } from "../lib/share/commentary.ts";
import { defaultConfig, players } from "../lib/mock-data.ts";

describe("share commentary fallback", () => {
  it("is deterministic for one work but varies with the work", () => {
    const first = [{ id: "1", text: "冰箱突然说话了。", duration: 2.4, player: players[0] }];
    const second = [{ id: "2", text: "月亮今晚请假！", duration: 3.1, player: players[1] }];
    assert.equal(getShareCommentary(defaultConfig, first), getShareCommentary(defaultConfig, first));
    assert.notEqual(getShareCommentary(defaultConfig, first), getShareCommentary({ ...defaultConfig, mode: "chaos" }, second));
  });
});
