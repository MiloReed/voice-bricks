"use client";

import { localStore } from "@/lib/browser-storage";

import { ArrowRight, Check, Clock, EyeSlash, Lightning, Sparkle, UsersThree, Waveform } from "@phosphor-icons/react";
import { motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { BrickComposer } from "@/components/gameplay/brick-composer";
import { GameCountdown } from "@/components/gameplay/game-countdown";
import { AppShell } from "@/components/ui/app-shell";
import { Button } from "@/components/ui/buttons";
import { VoiceBrick } from "@/components/voice-brick/voice-brick";
import { estimateDuration, speak } from "@/lib/audio/speech";
import { playPartyCue } from "@/lib/audio/party-sound";
import { classicBlockMaxLength, getTurnTimeHint } from "@/lib/game/rules";
import { saveBlocks, saveConfig } from "@/lib/mock-data";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { getLiveGameSnapshot, leaveLiveRoomChannel, skipLiveTurn, submitLiveBlock, subscribeToLiveRoom } from "@/lib/supabase/room-service";
import type { RoomSnapshot } from "@/lib/supabase/types";
import type { GameConfig, Player, VoiceBlockData } from "@/types/game";

export function LivePlayScreen({ roomId }: { roomId: string }) {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState<RoomSnapshot | null>(null);
  const [draft, setDraft] = useState("");
  const [playing, setPlaying] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [count, setCount] = useState(3);
  const [turnElapsed, setTurnElapsed] = useState(0);
  const [chaosRevealComplete, setChaosRevealComplete] = useState(false);
  const draftKey = snapshot ? `voice-bricks-draft:${roomId}:${snapshot.currentUserId}:${snapshot.room.current_round}` : "";
  const restoredKey = useRef("");
  useEffect(() => {
    if (!draftKey || restoredKey.current === draftKey) return;
    restoredKey.current = draftKey;
    const frame = requestAnimationFrame(() => setDraft(localStore.getItem(draftKey) || ""));
    return () => cancelAnimationFrame(frame);
  }, [draftKey]);
  const updateDraft = (value: string) => { setDraft(value); if (draftKey) localStore.setItem(draftKey, value); };

  const refresh = useCallback(async () => {
    try {
      const next = await getLiveGameSnapshot(roomId);
      setSnapshot(next);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "无法同步游戏状态");
    }
  }, [roomId]);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const frame = window.requestAnimationFrame(() => void refresh());
    const channel = subscribeToLiveRoom(roomId, () => void refresh());
    return () => { window.cancelAnimationFrame(frame); void leaveLiveRoomChannel(channel); };
  }, [refresh, roomId]);

  useEffect(() => {
    if (snapshot?.room.mode !== "chaos" || count <= 0) return;
    playPartyCue("count");
    const timer = window.setTimeout(() => setCount((current) => current - 1), 680);
    return () => window.clearTimeout(timer);
  }, [count, snapshot?.room.mode]);

  useEffect(() => {
    if (snapshot?.room.status !== "playing" || !snapshot.room.turn_started_at) return;
    const update = () => setTurnElapsed(Math.max(0, Math.floor((Date.now() + (snapshot.clockOffset || 0) - new Date(snapshot.room.turn_started_at!).getTime()) / 1000)));
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [snapshot?.clockOffset, snapshot?.room.mode, snapshot?.room.status, snapshot?.room.turn_started_at]);

  const displayPlayers: Player[] = useMemo(() => snapshot?.players.map((player) => ({ id: player.id, name: player.display_name, color: player.color, ready: player.is_ready, host: player.user_id === snapshot.room.host_user_id })) ?? [], [snapshot]);
  const blocks: VoiceBlockData[] = useMemo(() => snapshot?.blocks?.map((block) => ({ id: block.id, text: block.text, duration: Number(block.duration_seconds), audioUrl: block.preview_audio_url ?? undefined, player: displayPlayers.find((player) => player.id === block.player_id)! })).filter((block) => block.player) ?? [], [displayPlayers, snapshot?.blocks]);

  useEffect(() => {
    if (snapshot && ["revealed", "completed"].includes(snapshot.room.status)) router.replace(`/room/${roomId}/reveal?live=1`);
    if (snapshot?.room.status === "rendering") router.replace(`/room/${roomId}/assembly?live=1`);
  }, [snapshot, router, roomId]);

  useEffect(() => {
    if (!snapshot || snapshot.room.status !== "assembly" || !blocks.length) return;
    if (snapshot.room.mode === "chaos" && !chaosRevealComplete) return;
    saveConfig({ mode: snapshot.room.mode, playerCount: snapshot.room.max_players, theme: snapshot.room.theme, voice: snapshot.room.voice_id, teamName: snapshot.room.team_name });
    saveBlocks(blocks, snapshot.room.mode);
    router.push(`/room/${roomId}/assembly?live=1`);
  }, [blocks, chaosRevealComplete, roomId, router, snapshot]);

  if (!isSupabaseConfigured) return <AppShell backHref="/room/demo"><section className="lobby-notice"><h1>多人服务尚未配置</h1><p>当前可以继续使用本地完整试玩。</p></section></AppShell>;
  if (!snapshot) return <AppShell backHref={`/room/${roomId}`}><section className="lobby-notice"><h1>{error || "正在同步游戏"}</h1><Button onClick={() => void refresh()}>重新同步</Button><p>正在确认轮到哪一棒，以及你可以看到哪些积木。</p></section></AppShell>;
  if (snapshot.room.mode === "chaos" && count > 0) return <AppShell backHref={`/room/${roomId}`} className="countdown-shell"><GameCountdown count={count} variant="chaos" eyebrow="BLIND WRITING" caption="所有人同时写。别偷看。" /></AppShell>;

  if (snapshot.room.mode === "chaos" && snapshot.room.status === "assembly" && !chaosRevealComplete) {
    return <LiveChaosReveal blocks={blocks} voiceId={snapshot.room.voice_id} onComplete={() => setChaosRevealComplete(true)} />;
  }

  const currentPlayerRecord = snapshot.players.find((player) => player.user_id === snapshot.currentUserId);
  const currentPlayer = displayPlayers.find((player) => player.id === currentPlayerRecord?.id);
  if (!currentPlayerRecord || !currentPlayer) return <AppShell backHref={`/room/${roomId}`}><section className="lobby-notice"><h1>你不在这个房间里</h1><p>请使用邀请链接重新加入。</p></section></AppShell>;

  const config: GameConfig = { mode: snapshot.room.mode, playerCount: snapshot.room.max_players, theme: snapshot.room.theme, voice: snapshot.room.voice_id, teamName: snapshot.room.team_name };
  const duration = blocks.reduce((total, block) => total + block.duration, 0) + (!currentPlayerRecord.has_submitted && draft.trim() ? estimateDuration(draft) : 0);
  const characterCount = blocks.reduce((total, block) => total + block.text.length, 0) + (!currentPlayerRecord.has_submitted ? draft.trim().length : 0);
  const isYourClassicTurn = snapshot.room.mode === "classic" && currentPlayerRecord.seat_index === snapshot.room.current_player_index;
  const canCompose = !currentPlayerRecord.has_submitted && (snapshot.room.mode === "chaos" || isYourClassicTurn);
  const currentTurnPlayer = snapshot.players.find((player) => player.seat_index === snapshot.room.current_player_index);
  const preview = () => { setPlaying("draft"); speak(draft, () => setPlaying(null), config.voice, () => setPlaying(null)); };
  const play = (block: VoiceBlockData) => { setPlaying(block.id); speak(block.text, () => setPlaying(null), config.voice, () => setPlaying(null), block.audioUrl); };
  const submit = async () => {
    if (!draft.trim() || busy) return;
    setBusy(true);
    setError("");
    try { await submitLiveBlock(roomId, draft.trim(), estimateDuration(draft), snapshot.room.current_round); localStore.removeItem(draftKey); setDraft(""); await refresh(); }
    catch (submitError) { setError(submitError instanceof Error ? submitError.message : "提交失败"); }
    finally { setBusy(false); }
  };
  const skipTurn = async () => {
    setBusy(true);
    setError("");
    try { await skipLiveTurn(roomId); }
    catch (skipError) { setError(skipError instanceof Error ? skipError.message : "暂时不能跳过这一棒"); }
    finally { setBusy(false); }
  };
  const isHost = snapshot.currentUserId === snapshot.room.host_user_id;
  const recoverChaos = async () => {
    setBusy(true);
    const { error: recoveryError } = await getSupabaseBrowserClient().rpc("recover_voice_bricks_chaos", { candidate_room_id: roomId });
    if (recoveryError) setError(recoveryError.message);
    await refresh();
    setBusy(false);
  };
  const turnHint = getTurnTimeHint(turnElapsed);
  const classicMaxLength = classicBlockMaxLength(snapshot.players.length);

  return <AppShell backHref={`/room/${roomId}`} headerAction={<span className={`round-pill ${snapshot.room.mode === "chaos" ? "chaos-round" : ""}`}>{snapshot.room.mode === "chaos" ? <Clock weight="bold" /> : <i />}{snapshot.room.mode === "classic" ? `第 ${snapshot.room.current_round} 轮 · ${snapshot.room.current_player_index + 1} / ${snapshot.players.length}` : "同时创作中"}</span>}>
    <div className={`game-layout ${snapshot.room.mode === "chaos" ? "chaos-layout" : ""}`}>
      <div className="game-topbar"><div><span>{snapshot.room.mode === "classic" ? "Classic · 顺序接龙" : "Chaos · 同时创作"}</span><strong><Sparkle weight="fill" />{config.theme}</strong></div><div className="duration-meter"><span style={{ width: `${Math.min(100, duration / 15 * 100)}%` }} /><b>{characterCount} / 65 字 · {duration.toFixed(1)} / 15s</b></div></div>
      {snapshot.room.mode === "classic" ? <section className="chain-section"><div className="chain-heading"><div><span className="chain-pulse"><Waveform weight="bold" /></span><span><small>LIVE ROOM</small><strong>{blocks.length ? `${blocks.length} 块声音已经接好了` : "第一块正在被制造"}</strong></span></div><p>{isYourClassicTurn ? `现在轮到你：第 ${currentPlayerRecord.seat_index + 1} 棒。` : `${currentTurnPlayer?.display_name ?? "下一位玩家"} 正在写第 ${snapshot.room.current_player_index + 1} 棒…`}</p></div><div className="block-chain">{blocks.map((block, index) => <motion.div key={block.id} className="chain-item" initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }}><VoiceBrick block={block} compact order={index + 1} playing={playing === block.id} onPlay={() => play(block)} />{index < blocks.length - 1 && <i className="chain-link" />}</motion.div>)}</div></section> : <section className="peer-status"><div className="peer-heading"><span><EyeSlash weight="bold" /></span><div><small>嘘，先保密</small><h2>全部完成前，正文只对作者本人可见。</h2></div></div><div className="peer-row">{snapshot.players.map((player) => <div key={player.id} data-color={player.color} className={player.user_id === snapshot.currentUserId ? "is-you" : ""}><i /><span><strong>{player.display_name}</strong><small>{player.user_id === snapshot.currentUserId ? (player.has_submitted ? "你已封好" : "你正在写…") : player.has_submitted ? "已完成" : "writing…"}</small></span>{player.has_submitted && <Check weight="bold" />}</div>)}</div></section>}
      {turnHint && snapshot.room.mode === "classic" && <div className="turn-time-notice"><Clock weight="bold" /><span>{turnHint} · {turnElapsed}s</span>{isHost && turnElapsed >= 60 && <button type="button" onClick={skipTurn} disabled={busy}>跳过这一棒</button>}</div>}
      {error && <p className="form-error" role="alert">{error} <button onClick={() => void refresh()}>重新同步</button></p>}{snapshot.room.mode === "chaos" && <p className="writing-hint">第 {snapshot.room.current_round} 轮 · {snapshot.players.length === 2 ? "双人各写两句" : "每人一句"} · 短篇也算好作品{isHost && turnElapsed >= 90 && <button disabled={busy} onClick={() => void recoverChaos()}>用已提交的内容继续</button>}</p>}{canCompose ? <BrickComposer busy={busy} value={draft} onChange={updateDraft} hint={snapshot.room.mode === "chaos" ? "像一本正经地宣布一件荒唐事；第二句可以补刀。" : ["交代谁在干什么，先别急着收尾。", "给上一句制造麻烦：偏偏、结果、没想到……", "换个意外角度：原来真正想要的是……", "把前面的细节接回来，用小事收尾。"][Math.min(3, blocks.length)]} player={currentPlayer} previewing={playing === "draft"} onPreview={preview} onSubmit={submit} label={snapshot.room.mode === "classic" ? `你的回合 · 第 ${currentPlayerRecord.seat_index + 1} 棒` : "只管写，等会儿一起看结果"} maxLength={snapshot.room.mode === "chaos" ? 12 : classicMaxLength} /> : <motion.section className="waiting-stage" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}><span>{snapshot.room.mode === "chaos" ? <EyeSlash weight="bold" /> : <Waveform weight="bold" />}</span><div><small>{currentPlayerRecord.has_submitted ? "LOCKED" : "LIVE TURN"}</small><h2>{currentPlayerRecord.has_submitted ? "你的积木已经封好。" : `正在等 ${currentTurnPlayer?.display_name ?? "上一棒"}。`}</h2><p>{snapshot.room.mode === "chaos" ? "还没全部完成前，任何人的正文都不会公开。" : `你固定是第 ${currentPlayerRecord.seat_index + 1} 棒，轮到时会自动出现输入区。离线时座位仍会保留，房主可在 60 秒后跳过。`}</p>{error && <p className="form-error">{error}</p>}</div><div className="waiting-dots"><i /><i /><i /></div></motion.section>}
    </div>
  </AppShell>;
}

function LiveChaosReveal({ blocks, voiceId, onComplete }: { blocks: VoiceBlockData[]; voiceId: string; onComplete: () => void }) {
  const [activeIndex, setActiveIndex] = useState(-1);
  const [started, setStarted] = useState(false);

  const playRandomVersion = useCallback(() => {
    if (started || !blocks.length) return;
    setStarted(true);
    let index = 0;
    const next = () => {
      const block = blocks[index];
      if (!block) { setActiveIndex(-1); window.setTimeout(onComplete, 650); return; }
      setActiveIndex(index);
      index += 1;
      void speak(block.text, next, voiceId, next, block.audioUrl);
    };
    next();
  }, [blocks, onComplete, started, voiceId]);

  useEffect(() => {
    const timer = window.setTimeout(playRandomVersion, 450);
    return () => window.clearTimeout(timer);
  }, [playRandomVersion]);

  return <AppShell className="chaos-layout"><section className="scatter-stage live-scatter-stage">
    <div className="scatter-copy"><span><Lightning weight="fill" /></span><div><small>RANDOM VERSION · AUTO PLAY</small><h1>它们第一次见面，<br />居然已经开始说话。</h1><p>先听随机版本，再一起修补。大家看完后，由房主确认完成。</p></div></div>
    <div className="scatter-table">{blocks.map((block, index) => <motion.div key={block.id} initial={{ opacity: 0, x: index % 2 ? 80 : -80, y: -40, rotate: (index - 1.5) * 9 }} animate={{ opacity: 1, x: 0, y: activeIndex === index ? -8 : 0, rotate: (index - 1.5) * 2 }} transition={{ delay: index * 0.14, type: "spring", stiffness: 240, damping: 20 }}><VoiceBrick block={block} compact playing={activeIndex === index} /></motion.div>)}</div>
    <div className="scatter-action"><span><UsersThree weight="fill" />全部内容现在才公开</span><Button onClick={started ? onComplete : playRandomVersion} icon={<ArrowRight weight="bold" />}>{started ? "跳过播放 · 开始修补" : "播放随机版本"}</Button></div>
  </section></AppShell>;
}
