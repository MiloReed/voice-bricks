"use client";

import Link from "next/link";
import { ArrowRight, Check, Robot, Waveform } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { BrickComposer } from "@/components/gameplay/brick-composer";
import { AppShell } from "@/components/ui/app-shell";
import { Button } from "@/components/ui/buttons";
import { VoiceBrick } from "@/components/voice-brick/voice-brick";
import { estimateDuration, speak } from "@/lib/audio/speech";
import { playPartyCue } from "@/lib/audio/party-sound";
import { sessionStore } from "@/lib/browser-storage";
import { validateUserText } from "@/lib/content/safety";
import { SOLO_BLOCK_COUNT, soloPlayers } from "@/lib/game/solo";
import { defaultConfig, getBlocks, getConfig, saveBlocks } from "@/lib/mock-data";
import type { VoiceBlockData } from "@/types/game";

export function SoloPlayScreen() {
  const [config, setConfig] = useState(defaultConfig);
  const [blocks, setBlocks] = useState<VoiceBlockData[]>([]);
  const [draft, setDraft] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [started, setStarted] = useState(false);
  const [playing, setPlaying] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [botError, setBotError] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setStarted(Boolean(sessionStore.getItem("voice-bricks-solo-config")));
      setConfig(getConfig("solo"));
      setBlocks(getBlocks("classic", "solo"));
      setDraft(sessionStore.getItem("voice-bricks-solo-draft") || "");
      setLoaded(true);
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  const complete = blocks.length >= SOLO_BLOCK_COUNT;
  const yourTurn = blocks.length % 3 === 0;
  const currentPlayer = soloPlayers[blocks.length % 3];
  const round = Math.min(2, Math.floor(blocks.length / 3) + 1);

  useEffect(() => {
    if (!loaded || !started || complete || yourTurn) return;
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch("/api/solo/reply", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ theme: config.theme, blocks: blocks.map(block => block.text) }),
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(55_000)]),
        });
        const payload = await response.json() as { text?: string; error?: string };
        if (!response.ok || !payload.text) throw new Error(payload.error || "机器人没有接上，请重试");
        if (controller.signal.aborted) return;
        const next = [...blocks, { id: `solo-${blocks.length + 1}`, text: payload.text, duration: estimateDuration(payload.text), player: currentPlayer }];
        saveBlocks(next, "classic", "solo");
        setBlocks(next);
        playPartyCue("submit");
      } catch (error) {
        if (!controller.signal.aborted) setBotError(error instanceof Error ? error.message : "连接失败，请重试；你的故事已保留");
      }
    })();
    return () => controller.abort();
  }, [blocks, complete, config.theme, currentPlayer, loaded, started, yourTurn, retry]);

  const changeDraft = (value: string) => {
    setDraft(value);
    setError("");
    sessionStore.setItem("voice-bricks-solo-draft", value);
  };
  const submit = () => {
    if (!yourTurn || complete) return;
    const validation = validateUserText(draft, 12);
    if (!validation.ok) { setError(validation.error); return; }
    const next = [...blocks, { id: `solo-${blocks.length + 1}`, text: validation.value, duration: estimateDuration(validation.value), player: soloPlayers[0] }];
    saveBlocks(next, "classic", "solo");
    setBlocks(next);
    changeDraft("");
    playPartyCue("submit");
  };
  const play = (text: string, id: string) => {
    setPlaying(id);
    const finish = () => setPlaying(null);
    void speak(text, finish, config.voice, finish, undefined, undefined, true);
  };

  if (!loaded) return <AppShell><p role="status">正在打开单人试玩…</p></AppShell>;
  if (!started) return <AppShell backHref="/"><section className="lobby-notice"><h1>先选个主题，再开一局。</h1><p>两位机器人已经准备好了。</p><Button asChild><Link href="/create?solo=1">开始单人试玩</Link></Button></section></AppShell>;

  return <AppShell backHref="/create?solo=1" headerAction={<span className="round-pill"><Robot weight="bold" />单人试玩 · {complete ? "接龙完成" : `第 ${round} / 2 轮`}</span>}>
    <div className="game-layout">
      <div className="game-topbar"><div><span>你和两位机器人 · 顺序接龙</span><strong>{config.theme}</strong></div><div className="duration-meter"><span style={{ width: `${Math.min(100, blocks.length / SOLO_BLOCK_COUNT * 100)}%` }} /><b>{blocks.length} / {SOLO_BLOCK_COUNT} 块</b></div></div>
      <section className="chain-section">
        <div className="chain-heading"><div><span className="chain-pulse"><Waveform weight="bold" /></span><span><small>一句开头，两位搭子接梗</small><strong>{complete ? "六块积木到齐了" : yourTurn ? round === 1 ? "先由你来开个头" : "轮到你，把故事再拐个弯" : botError ? `${currentPlayer.name} 等待重试` : `${currentPlayer.name} 正在接下一句`}</strong></span></div></div>
        <div className="block-chain">
          {!blocks.length && <div className="chain-empty"><span>01</span><strong>写一句，让机器人接下去。</strong><small>共两轮；你写两块，机器人各写两块。</small></div>}
          {blocks.map((block, index) => <div key={block.id} className="chain-item"><VoiceBrick block={block} compact order={index + 1} playing={playing === block.id} onPlay={() => play(block.text, block.id)} />{index < blocks.length - 1 && <i className="chain-link" />}</div>)}
        </div>
      </section>
      {complete ? <section className="submitted-stage"><span className="success-mark"><Check weight="bold" /></span><div><h2>现在，你来当导演。</h2><p>拖动排序、修补一句，把故事拼成你喜欢的版本。</p></div><Button asChild icon={<ArrowRight weight="bold" />}><Link href="/room/solo/assembly">进入拼装</Link></Button></section>
        : yourTurn ? <><BrickComposer value={draft} onChange={changeDraft} player={soloPlayers[0]} maxLength={12} previewing={playing === "draft"} onPreview={() => play(draft, "draft")} onSubmit={submit} label={round === 1 ? "写下故事的第一句" : "接住机器人的上一句"} hint={round === 1 ? `从「${config.theme}」里挑个角色，让它遇到一点麻烦。` : "回应上一句，再留下一个意外。"} />{error && <p role="alert" className="writing-hint">{error}</p>}</>
          : <section className="submitted-stage simulating-stage" role={botError ? "alert" : "status"}><span className="simulating-token" data-color={currentPlayer.color}><Robot weight="bold" /></span><div><h2>{botError ? "这句暂时没接上" : `${currentPlayer.name} 正在想梗…`}</h2><p>{botError || "正在读你的故事，下一句会自动接上。"}</p></div>{botError ? <Button onClick={() => { setBotError(""); setRetry(value => value + 1); }}>重新接这句</Button> : <div className="waiting-dots" aria-hidden="true"><i /><i /><i /></div>}</section>}
      <p className="mock-note">单人进度保存在当前浏览器。两位机器人通过 DeepSeek 阅读整段故事再接龙。</p>
    </div>
  </AppShell>;
}
