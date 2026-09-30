import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canFitDuration, classicBlockMaxLength, getTurnTimeHint, shouldContinueClassicRound } from "../lib/game/rules.ts";

describe("Classic game rules", () => {
  it("forces two players to contribute at least two rounds", () => {
    assert.equal(shouldContinueClassicRound(2, 1, 12), true);
    assert.equal(shouldContinueClassicRound(2, 2, 12), false);
    assert.equal(shouldContinueClassicRound(2, 2, 8.5), true);
  });

  it("continues three-to-five-player games until the work reaches ten seconds", () => {
    assert.equal(shouldContinueClassicRound(3, 1, 6.5), true);
    assert.equal(shouldContinueClassicRound(4, 1, 8.5), true);
    assert.equal(shouldContinueClassicRound(5, 1, 9.5), true);
    assert.equal(shouldContinueClassicRound(3, 1, 10), false);
  });

  it("uses player-count-aware block limits", () => {
    assert.equal(classicBlockMaxLength(2), 15);
    assert.equal(classicBlockMaxLength(4), 13);
    assert.equal(classicBlockMaxLength(5), 12);
  });

  it("never accepts work beyond 15 seconds", () => {
    assert.equal(canFitDuration(12.4, 2.6), true);
    assert.equal(canFitDuration(12.4, 2.7), false);
  });

  it("exposes the PRD turn reminders", () => {
    assert.equal(getTurnTimeHint(29), "");
    assert.match(getTurnTimeHint(30), /慢慢想/);
    assert.match(getTurnTimeHint(45), /尽快/);
    assert.match(getTurnTimeHint(60), /跳过/);
  });
});
