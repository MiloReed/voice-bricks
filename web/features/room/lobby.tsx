"use client";

import Image from "next/image";
import { ArrowRight, Copy, LinkSimple, ShareNetwork, SignOut, Sparkle } from "@phosphor-icons/react";
import { motion } from "motion/react";
import QRCode from "qrcode";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PlayerToken } from "@/components/room/player-token";
import { AppShell, Eyebrow } from "@/components/ui/app-shell";
import { Button } from "@/components/ui/buttons";
import { defaultConfig, getConfig, players } from "@/lib/mock-data";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { getLiveRoomSnapshot, leaveLiveRoom, leaveLiveRoomChannel, setLiveRoomReady, startLiveRoom, subscribeToLiveRoom, subscribeToRoomPresence } from "@/lib/supabase/room-service";
import type { RoomSnapshot } from "@/lib/supabase/types";
import { addTestBots } from "@/lib/supabase/test-bots";
import type { GameConfig, Player } from "@/types/game";

export function Lobby({ roomId }: { roomId: string }) {
  return roomId === "demo" ? <DemoLobby /> : <LiveLobby roomId={roomId} />;
}

function LiveLobby({ roomId }: { roomId: string }) {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState<RoomSnapshot | null>(null);
  const [qr, setQr] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [onlineUserIds, setOnlineUserIds] = useState<string[] | null>(null);

  const refresh = useCallback(async () => {
    try {
      const next = await getLiveRoomSnapshot(roomId);
      setSnapshot(next);
      setError("");
      const seat = next.players.find((player) => player.user_id === next.currentUserId)?.seat_index ?? 0;
      if (next.room.status === "playing") router.push(`/room/${roomId}/play?mode=${next.room.mode}&seat=${seat + 1}&live=1`);
      if (["assembly", "rendering"].includes(next.room.status)) router.push(`/room/${roomId}/assembly?live=1`);
      if (next.room.status === "revealed" || next.room.status === "completed") router.push(`/room/${roomId}/reveal?live=1`);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "无法读取房间");
    }
  }, [roomId, router]);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const frame = window.requestAnimationFrame(() => void refresh());
    const channel = subscribeToLiveRoom(roomId, () => void refresh());
    return () => { window.cancelAnimationFrame(frame); void leaveLiveRoomChannel(channel); };
  }, [refresh, roomId]);

  useEffect(() => {
    if (!snapshot?.currentUserId) return;
    const channel = subscribeToRoomPresence(roomId, snapshot.currentUserId, setOnlineUserIds);
    return () => { void leaveLiveRoomChannel(channel); };
  }, [roomId, snapshot?.currentUserId]);

  useEffect(() => {
    if (!snapshot) return;
    const inviteUrl = `${window.location.origin}/join?code=${snapshot.room.code}`;
    void QRCode.toDataURL(inviteUrl, { width: 180, margin: 1, color: { dark: "#242429", light: "#fffefa" } }).then(setQr);
  }, [snapshot]);

  if (!isSupabaseConfigured) {
    return <LobbyNotice title="多人房间还没有连接" description="填入 Supabase 环境变量并运行数据库迁移后，这个地址会成为实时房间。当前可以继续打开本地完整试玩。" action="进入本地试玩" onAction={() => router.push("/room/demo")} />;
  }
  if (!snapshot && !error) return <LobbyNotice title="正在进入房间" description="正在确认你的匿名身份和固定棒次…" />;
  if (!snapshot) return <LobbyNotice title="这个房间暂时进不去" description={error} action="返回加入页" onAction={() => router.push("/join")} />;
  if (snapshot.room.status === "cancelled") return <LobbyNotice title="主持人已取消房间" description="这个房间不会继续开局，你可以返回首页重新创建。" action="返回首页" onAction={() => router.push("/")} />;

  const { room } = snapshot;
  const current = snapshot.players.find((player) => player.user_id === snapshot.currentUserId);
  const isHost = room.host_user_id === snapshot.currentUserId;
  const allReady = snapshot.players.length === room.max_players
    && snapshot.players.every((player) => player.is_ready);
  const displayPlayers: Player[] = snapshot.players.map((player) => ({ id: player.id, name: player.display_name, color: player.color, ready: player.is_ready, host: player.user_id === room.host_user_id, online: onlineUserIds ? onlineUserIds.includes(player.user_id) : undefined }));
  const inviteUrl = typeof window === "undefined" ? "" : `${window.location.origin}/join?code=${room.code}`;

  const copyInvite = async () => {
    try {
      if (!navigator.clipboard) throw new Error("当前浏览器不支持复制，请让朋友输入房间码 " + room.code);
      await navigator.clipboard.writeText(inviteUrl || room.code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch { setError("复制未成功，请让朋友输入房间码 " + room.code); }
  };
  const toggleReady = async () => {
    if (!current) return;
    setBusy(true);
    try { await setLiveRoomReady(roomId, !current.is_ready); await refresh(); } catch (actionError) { setError(actionError instanceof Error ? actionError.message : "操作失败"); }
    finally { setBusy(false); }
  };
  const start = async () => {
    setBusy(true);
    try { await startLiveRoom(roomId); await refresh(); } catch (actionError) { setError(actionError instanceof Error ? actionError.message : "无法开始游戏"); setBusy(false); }
  };
  const addBots = async () => {
    setBusy(true);
    try { await addTestBots(snapshot); await refresh(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "机器人加入失败，请重试"); }
    finally { setBusy(false); }
  };
  const leave = async () => {
    if (isHost && !window.confirm("取消房间后，所有玩家都将退出。确定继续吗？")) return;
    setBusy(true);
    setError("");
    try { await leaveLiveRoom(roomId); router.push("/"); }
    catch (leaveError) { setError(leaveError instanceof Error ? leaveError.message : "暂时无法离开房间"); setBusy(false); }
  };

  const mainAction = isHost ? <Button onClick={start} disabled={!allReady || busy} icon={<ArrowRight weight="bold" />}>{busy ? "正在开始…" : allReady ? "开始游戏" : "等待大家准备"}</Button> : <Button onClick={toggleReady} disabled={busy}>{current?.is_ready ? "取消准备" : "我准备好了"}</Button>;
  return <LobbyFrame teamName={room.team_name} mode={room.mode} theme={room.theme} roomCode={room.code} qr={qr} copied={copied} onCopy={copyInvite} players={displayPlayers} playerCount={room.max_players} seatPicker={process.env.NODE_ENV === "development" && isHost ? <section className="test-seat-picker"><div><small>LOCAL PLAYTEST</small><h2>一个人也能开局</h2><p>机器人补齐空位，自动准备、接龙和准备揭晓。请保持此页面打开；生成声音仍会使用真实 API 额度。</p></div><Button variant="quiet" onClick={addBots} disabled={busy || snapshot.players.length >= room.max_players}>{busy ? "正在连接…" : "添加测试机器人"}</Button></section> : undefined} footerText={error || `你是第 ${(current?.seat_index ?? 0) + 1} 棒 · 正式开局后不可更换`} footerAction={<div className="lobby-action-buttons"><Button variant="quiet" onClick={leave} disabled={busy} icon={<SignOut weight="bold" />}>{isHost ? "取消房间" : "离开"}</Button>{mainAction}</div>} />;
}

function DemoLobby() {
  const router = useRouter();
  const [config, setConfig] = useState<GameConfig>(defaultConfig);
  const [qr, setQr] = useState("");
  const [copied, setCopied] = useState(false);
  const [testSeat, setTestSeat] = useState(1);
  const [copyError, setCopyError] = useState("");
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setConfig(getConfig()));
    void QRCode.toDataURL(`${window.location.origin}/room/demo`, { width: 180, margin: 1, color: { dark: "#242429", light: "#fffefa" } }).then(setQr);
    return () => window.cancelAnimationFrame(frame);
  }, []);
  const roomPlayers = useMemo(() => players.slice(0, config.playerCount), [config.playerCount]);
  const copyCode = async () => {
    try {
      if (!navigator.clipboard) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText("B4K7"); setCopied(true); setCopyError("");
      window.setTimeout(() => setCopied(false), 1400);
    } catch { setCopyError("复制未成功，试玩房间码为 B4K7"); }
  };
  const seatPicker = config.mode === "classic" ? <section className="test-seat-picker" aria-labelledby="test-seat-title"><div><small>LOCAL PLAYTEST</small><h2 id="test-seat-title">这次你想测试第几棒？</h2><p>只有试玩可以选择。正式房间会按加入顺序自动锁定棒次。</p></div><div className="test-seat-options" role="radiogroup" aria-label="试玩棒次">{roomPlayers.map((player, index) => <button key={player.id} type="button" role="radio" aria-checked={testSeat === index + 1} onClick={() => setTestSeat(index + 1)}><strong>第 {index + 1} 棒</strong><span>{testSeat === index + 1 ? "你 · Milo" : "选择"}</span></button>)}</div></section> : undefined;
  return <LobbyFrame teamName={config.teamName} mode={config.mode} theme={config.theme} roomCode="B4K7" qr={qr} copied={copied} onCopy={copyCode} players={roomPlayers} playerCount={config.playerCount} seatPicker={seatPicker} footerText={copyError || (config.mode === "classic" ? `试玩：你负责第 ${testSeat} 棒，其余由 Mock 玩家完成` : "这是本地模拟房间，四位玩家已准备就绪")} footerAction={<Button onClick={() => router.push(`/room/demo/play?mode=${config.mode}&seat=${testSeat}`)} icon={<ArrowRight weight="bold" />}>开始游戏</Button>} />;
}

function LobbyFrame({ teamName, mode, theme, roomCode, qr, copied, onCopy, players: roomPlayers, playerCount, seatPicker, footerText, footerAction }: { teamName: string; mode: GameConfig["mode"]; theme: string; roomCode: string; qr: string; copied: boolean; onCopy: () => void; players: Player[]; playerCount: number; seatPicker?: React.ReactNode; footerText: string; footerAction: React.ReactNode }) {
  return <AppShell backHref="/create" headerAction={<span className="live-pill"><i />房间已开启</span>}><div className="lobby-layout">
    <section className="lobby-copy"><Eyebrow>Waiting room</Eyebrow><h1>{teamName}</h1><p>朋友正在陆续进场。加入顺序就是正式开局后的固定棒次。</p><div className="room-meta"><span>{mode === "classic" ? "Classic · 顺序接龙" : "Chaos · 同时创作"}</span><strong><Sparkle weight="fill" />{theme}</strong></div></section>
    <motion.section className="room-ticket" initial={{ opacity: 0, y: 18, rotate: -1.5 }} animate={{ opacity: 1, y: 0, rotate: -1 }}><div className="ticket-code"><span>ROOM CODE</span><button type="button" onClick={onCopy} aria-label="复制邀请链接">{roomCode} <Copy weight="bold" /></button><small>{copied ? "已复制，发给朋友吧" : "输入房间码即可加入"}</small></div><div className="ticket-qr">{qr ? <Image src={qr} alt="加入房间二维码" width={122} height={122} unoptimized /> : <div className="qr-loading" />}<span>扫码加入</span></div></motion.section>
    <section className="party-area"><div className="party-heading"><div><span className="pulse-dot" /><strong>{roomPlayers.length} / {playerCount}</strong><small>今晚的玩家</small></div><button type="button" onClick={onCopy}><ShareNetwork weight="bold" />邀请朋友</button></div><div className="player-grid">{roomPlayers.map((player, index) => <motion.div key={player.id} initial={{ opacity: 0, scale: 0.8, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ delay: index * 0.1 }}><PlayerToken player={player} /></motion.div>)}{Array.from({ length: Math.max(0, playerCount - roomPlayers.length) }, (_, index) => <PlayerToken key={`empty-${index}`} empty />)}</div></section>
    {seatPicker}<div className="lobby-actions"><span><LinkSimple weight="bold" />{footerText}</span>{footerAction}</div>
  </div></AppShell>;
}

function LobbyNotice({ title, description, action, onAction }: { title: string; description: string; action?: string; onAction?: () => void }) {
  return <AppShell backHref="/"><section className="lobby-notice"><span className="live-pill"><i />Room connection</span><h1>{title}</h1><p>{description}</p>{action && <Button onClick={onAction} icon={<ArrowRight weight="bold" />}>{action}</Button>}</section></AppShell>;
}
