import assert from "node:assert/strict";
import { it } from "node:test";
import { isExpectedMediaUrl, shareMediaPath } from "../lib/share/media-path.ts";

it("accepts only the exact work asset URL, rejecting foreign hosts, rooms and query tricks", () => {
  const expected = `https://project.supabase.co/storage/v1/object/public/voice-bricks-share/${shareMediaPath("room-a", "image")}`;
  assert.equal(isExpectedMediaUrl(expected, expected), true);
  for (const candidate of [null, {}, "https://evil.example/share.png", expected.replace("room-a", "room-b"), `${expected}?redirect=evil`, expected.replace("share.png", "share.mp4")]) {
    assert.equal(isExpectedMediaUrl(candidate, expected), false);
  }
});
