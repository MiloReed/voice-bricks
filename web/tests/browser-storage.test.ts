import assert from "node:assert/strict";
import { it } from "node:test";
import { sessionStore, localStore } from "../lib/browser-storage.ts";
import { clearBlocks, defaultConfig, getConfig, saveConfig } from "../lib/mock-data.ts";

it("keeps settings, drafts and navigation usable when browser storage is denied", () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", { configurable: true, value: {
    get sessionStorage() { throw new Error("SecurityError"); },
    get localStorage() { throw new Error("SecurityError"); },
  } });
  try {
    const config = { ...defaultConfig, mode: "chaos" as const, teamName: "存储不可用测试" };
    saveConfig(config);
    assert.deepEqual(getConfig(), config);
    localStore.setItem("draft", "冰箱辞职了");
    assert.equal(localStore.getItem("draft"), "冰箱辞职了");
    localStore.removeItem("draft");
    assert.equal(localStore.getItem("draft"), null);
    sessionStore.setItem("voice-bricks-final-audio", "old audio");
    clearBlocks();
    assert.equal(sessionStore.getItem("voice-bricks-final-audio"), null);
  } finally {
    sessionStore.removeItem("voice-bricks-config");
    if (original) Object.defineProperty(globalThis, "window", original);
    else Reflect.deleteProperty(globalThis, "window");
  }
});

it("uses the latest value when quota prevents replacing or removing older data", () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", { configurable: true, value: { sessionStorage: {
    getItem() { return "old"; },
    setItem() { throw new Error("QuotaExceededError"); },
    removeItem() { throw new Error("SecurityError"); },
  } } });
  try {
    sessionStore.setItem("quota-draft", "new");
    assert.equal(sessionStore.getItem("quota-draft"), "new");
    sessionStore.removeItem("quota-draft");
    assert.equal(sessionStore.getItem("quota-draft"), null);
  } finally {
    if (original) Object.defineProperty(globalThis, "window", original);
    else Reflect.deleteProperty(globalThis, "window");
  }
});
