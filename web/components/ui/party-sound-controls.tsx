"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { MusicNote, SlidersHorizontal } from "@phosphor-icons/react";
import { configurePartySound, playPartyCue, suspendPartySound, unlockPartySound } from "@/lib/audio/party-sound";
import { readSoundSettings, SOUND_DEFAULTS, soundScene, type SoundSettings } from "@/lib/audio/party-score";
import { stopSpeech } from "@/lib/audio/speech";

export function PartySoundControls() {
  const path = usePathname();
  const [settings, setSettings] = useState({ ...SOUND_DEFAULTS });
  const [error, setError] = useState("");
  useEffect(() => () => { stopSpeech(); }, [path]);
  useEffect(() => () => { suspendPartySound(); }, []);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      try { setSettings(readSoundSettings(localStorage.getItem("voice-bricks-sound"))); } catch { /* Optional preference storage. */ }
    });
    return () => cancelAnimationFrame(frame);
  }, []);
  useEffect(() => {
    configurePartySound({ ...settings, enabled: settings.enabled }, soundScene(path));
    if (!settings.enabled) suspendPartySound();
    document.body.classList.add("has-party-sound");
    return () => document.body.classList.remove("has-party-sound");
  }, [path, settings]);
  useEffect(() => {
    const unlock = () => { if (settings.enabled) void unlockPartySound().catch(() => setError("声音未开启，请再点一次开启声音。")); };
    const click = (event: MouseEvent) => {
      const target = event.target;
      if (target instanceof Element && !target.closest(".party-sound-controls") && target.closest("button:not(:disabled), [role=radio], a")) playPartyCue("tap");
    };
    const visibility = () => { if (document.hidden) suspendPartySound(); else unlock(); };
    document.addEventListener("pointerdown", unlock);
    document.addEventListener("keydown", unlock);
    document.addEventListener("click", click);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      document.removeEventListener("pointerdown", unlock); document.removeEventListener("keydown", unlock);
      document.removeEventListener("click", click); document.removeEventListener("visibilitychange", visibility);
    };
  }, [settings.enabled]);
  const update = async (next: SoundSettings) => {
    setSettings(next); setError("");
    configurePartySound(next, soundScene(path));
    try { localStorage.setItem("voice-bricks-sound", JSON.stringify(next)); } catch { /* Still works without storage. */ }
    if (next.enabled) {
      try { await unlockPartySound(); if (!settings.enabled) playPartyCue("join"); }
      catch (cause) { setError(cause instanceof Error ? cause.message : "无法开启声音"); }
    } else suspendPartySound();
  };
  return <aside className="party-sound-controls" aria-label="游戏声音设置">
    <button type="button" aria-pressed={settings.enabled} onClick={() => void update({ ...settings, enabled: !settings.enabled })}><MusicNote size={18} weight="bold" aria-hidden="true" /><span>{settings.enabled ? "声音已开启" : "开启游戏声音"}</span></button>
    <details><summary aria-label="调整音乐与音效"><SlidersHorizontal size={18} weight="bold" aria-hidden="true" /><span>设置</span></summary><div className="party-sound-panel">
      <strong>玩具积木小乐队</strong><small>只影响 BGM 和音效，不改变人声音量</small>
      <label><input type="checkbox" checked={settings.music} onChange={e => void update({ ...settings, music: e.target.checked })} />背景音乐</label>
      <label><input type="checkbox" checked={settings.effects} onChange={e => void update({ ...settings, effects: e.target.checked })} />操作音效</label>
      <label>氛围音量<input aria-label="氛围音量" type="range" min="0" max="1" step="0.05" value={settings.volume} onChange={e => void update({ ...settings, volume: Number(e.target.value) })} /></label>
      <small>人声优先 · 揭晓与作品页不放背景音乐</small>
    </div></details>{error && <span role="status">{error}</span>}
  </aside>;
}
