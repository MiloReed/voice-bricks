import assert from "node:assert/strict";
import { test } from "node:test";
import { fitBlocksToAudio } from "../lib/audio/timing.ts";
import { classicBlocks } from "../lib/mock-data.ts";
test("final timeline fits actual audio without dropping or mutating any sentence", () => {
  const before = JSON.stringify(classicBlocks);
  const result = fitBlocksToAudio(classicBlocks, 3.500313);
  assert.ok(Math.abs(result.reduce((s, b) => s + b.duration, 0) - 3.500313) < 0.000001);
  assert.deepEqual(result.map(b => b.id), classicBlocks.map(b => b.id));
  assert.equal(JSON.stringify(classicBlocks), before);
  assert.equal(fitBlocksToAudio(classicBlocks, NaN), classicBlocks);
  assert.deepEqual(fitBlocksToAudio([], 4), []);
});
