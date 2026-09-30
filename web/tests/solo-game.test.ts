import assert from "node:assert/strict";
import { test } from "node:test";
import { soloPlayers, SOLO_BLOCK_COUNT } from "../lib/game/solo.ts";
import { clearBlocks, getBlocks, getConfig, saveBlocks, saveConfig, defaultConfig } from "../lib/mock-data.ts";
import { sessionStore } from "../lib/browser-storage.ts";
import { roomErrorMessage } from "../lib/supabase/errors.ts";

test("two solo rounds contain two human turns and four labelled robot turns", () => {
  assert.equal(SOLO_BLOCK_COUNT, 6);
  assert.equal(soloPlayers.length, 3);
  assert.ok(soloPlayers.slice(1).every(player => player.name.startsWith("机器人·")));
});

test("solo progress survives reads and restarts without overwriting the demo or multiplayer setup", () => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const values = new Map<string, string>();
  Object.defineProperty(globalThis, "window", { configurable: true, value: { sessionStorage: { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) } } });
  try {
    saveConfig({ ...defaultConfig, theme: "多人主题" });
    saveConfig({ ...defaultConfig, theme: "机器人主题", playerCount: 3 }, "solo");
    const demo = getBlocks("classic");
    const solo = [{ id: "solo-1", text: "我的第一句", player: soloPlayers[0], duration: 2 }];
    saveBlocks(solo, "classic", "solo");
    assert.deepEqual(getBlocks("classic", "solo"), solo);
    assert.deepEqual(getBlocks("classic"), demo);
    assert.equal(getConfig().theme, "多人主题");
    assert.equal(getConfig("solo").theme, "机器人主题");
    saveConfig({ ...defaultConfig, voice: "removed-custom-voice" }, "solo");
    assert.equal(getConfig("solo").voice, defaultConfig.voice);
    saveConfig({ ...defaultConfig, voice: "cinema" }, "solo");
    assert.equal(getConfig("solo").voice, "cinema");
    sessionStore.setItem("voice-bricks-solo-edit-used", "1");
    clearBlocks("solo");
    assert.deepEqual(getBlocks("classic", "solo"), []);
    assert.equal(sessionStore.getItem("voice-bricks-solo-edit-used"), null);
    assert.deepEqual(getBlocks("classic"), demo);
  } finally {
    if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
    else Reflect.deleteProperty(globalThis, "window");
  }
});

test("connection failures have an actionable Chinese message without hiding room errors", () => {
  for (const error of [new TypeError("Failed to fetch"), { message: "NetworkError when attempting to fetch resource." }, new Error("The operation was aborted")]) {
    assert.match(roomErrorMessage(error), /多人服务.*单人模式/);
  }
  assert.equal(roomErrorMessage(new Error("房间已满")), "房间已满");
});
