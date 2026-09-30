"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/ui/app-shell";
import { Button } from "@/components/ui/buttons";
import { VoiceBrick } from "@/components/voice-brick/voice-brick";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { getLiveGameSnapshot, subscribeToLiveRoom, leaveLiveRoomChannel } from "@/lib/supabase/room-service";
import type { RoomSnapshot } from "@/lib/supabase/types";
import { playPartyCue } from "@/lib/audio/party-sound";

export function LiveRevealScreen({ roomId }: { roomId: string }) {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState<RoomSnapshot | null>(null);
  const [error, setError] = useState("");
  const [state, setState] = useState("点击准备声音，大家到齐一起听");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [duration, setDuration] = useState(0);
  const audio = useRef<HTMLAudioElement | null>(null);
  const hasPlayed = useRef(false);
  const fastPoll = !snapshot?.room.reveal_at;
  const refresh = useCallback(async () => {
    try { setSnapshot(await getLiveGameSnapshot(roomId)); }
    catch { setError("同步暂时失败，请检查网络后重新同步。"); }
  }, [roomId]);
  useEffect(() => {
    const frame = requestAnimationFrame(() => void refresh());
    const channel = subscribeToLiveRoom(roomId, () => void refresh(), fastPoll ? 1000 : 8000);
    return () => { cancelAnimationFrame(frame); void leaveLiveRoomChannel(channel); };
  }, [refresh, roomId, fastPoll]);
  const url = snapshot?.work?.final_audio_url;
  useEffect(() => {
    if (!url) return;
    const player = new Audio(url);
    player.preload = "auto";
    player.onloadedmetadata = () => setDuration(player.duration);
    player.ontimeupdate = () => setElapsed(player.currentTime);
    player.onended = () => { setState("这段离谱，值得让更多人听见。"); playPartyCue("finish"); };
    player.onerror = () => { setReady(false); setError("音频未加载成功。可以重新准备，或先阅读本局作品。"); };
    audio.current = player;
    return () => { player.pause(); player.removeAttribute("src"); player.load(); audio.current = null; };
  }, [url]);
  const rpc = async (name: string) => {
    const { data, error: rpcError } = await getSupabaseBrowserClient().rpc(name, { candidate_room_id: roomId });
    if (rpcError) throw new Error(rpcError.message);
    return data;
  };
  const prepare = async () => {
    const player = audio.current;
    if (!player || busy) return;
    setBusy(true); setError("");
    try {
      // Direct user gesture unlocks this exact audio element on mobile browsers.
      player.muted = true;
      await Promise.race([player.play(), new Promise<never>((_, reject) => setTimeout(() => reject(new Error("音频加载较慢，请重试准备声音")), 20000))]);
      player.pause(); player.currentTime = 0; player.muted = false;
      await rpc("ready_voice_bricks_audio");
      setReady(true); setState("声音准备好了，等房主一起开播");
      await refresh();
    } catch (e) { player.pause(); player.muted = false; setError(e instanceof Error ? e.message : "请重新准备声音"); }
    finally { setBusy(false); }
  };
  const revealAt = snapshot?.room.reveal_at;
  useEffect(() => { if (remaining !== null && remaining > 0 && remaining <= 3) playPartyCue("count"); }, [remaining]);
  const offset = snapshot?.clockOffset || 0;
  useEffect(() => {
    if (!ready || !revealAt || hasPlayed.current) return;
    const tick = () => {
      const delay = Date.parse(revealAt) - Date.now() - offset;
      setRemaining(Math.max(0, Math.ceil(delay / 1000)));
      if (delay > 0 || !audio.current || hasPlayed.current) return;
      const player = audio.current;
      hasPlayed.current = true;
      if (Number.isFinite(player.duration) && -delay / 1000 >= player.duration) { setState("共同首播已结束，点下面再听一次"); return; }
      player.currentTime = Math.max(0, -delay / 1000);
      void player.play().then(() => setState("全员首播中 · 迟到会从当前进度接上")).catch(() => setError("浏览器需要再点一次：请点击下方播放。"));
    };
    tick(); const timer = setInterval(tick, 100);
    return () => clearInterval(timer);
  }, [offset, ready, revealAt]);
  const act = async (name: string) => {
    setBusy(true); setError("");
    try { const result = await rpc(name); if (name === "rematch_voice_bricks") router.push(`/room/${result}?live=1`); else await refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : "操作失败，请重试"); }
    finally { setBusy(false); }
  };
  const host = snapshot?.room.host_user_id === snapshot?.currentUserId;
  const readyCount = snapshot?.players.filter(p => p.audio_ready).length || 0;
  const blocks = snapshot?.work?.share_payload?.blocks || [];
  const estimated = blocks.reduce((sum, block) => sum + block.duration, 0);
  const active = blocks.findIndex((_, i) => elapsed / (duration || estimated) * estimated < blocks.slice(0, i + 1).reduce((sum, b) => sum + b.duration, 0));
  return <AppShell><section className="party-reveal">
    <p className="eyebrow">THE WORLD PREMIERE · 本群首映</p>
    <h1>{snapshot?.room.theme || "正在接回这一局…"}</h1>
    <p role="status">{remaining !== null && remaining > 0 ? `${remaining} 秒后一起听` : state}</p>
    <div className="reveal-readiness">{snapshot?.players.map(p => <span key={p.id}>{p.audio_ready ? "●" : "○"} {p.display_name}</span>)}</div>
    {!ready && <Button onClick={() => void prepare()} disabled={busy || !url}>{busy ? "正在准备…" : "我准备好了 · 打开声音"}</Button>}
    {host && !revealAt && <Button onClick={() => void act("start_voice_bricks_reveal")} disabled={busy || !ready || readyCount !== snapshot?.players.length}>一起开播（{readyCount}/{snapshot?.players.length || 0}）</Button>}
    <div className="party-brick-transcript">{blocks.map((b, i) => <VoiceBrick key={b.id} block={b} compact order={i + 1} playing={elapsed > 0 && active === i} />)}</div>
    <p>{duration > 0 ? `实际音轨 ${duration.toFixed(1)} 秒` : "实际时长加载中"} · 每个人的一句，拼成了这一段。</p>
    <div className="party-result-actions">
      <Button variant="secondary" disabled={!url} onClick={() => { if (!audio.current) return; audio.current.currentTime = 0; void audio.current.play().catch(() => setError("播放失败，请重新准备声音")); }}>单独播放 / 再听一次</Button>
      <Button asChild><Link href={`/work/${roomId}`}>把这局发出去</Link></Button>
      {snapshot?.room.next_room_id ? <Button asChild><Link href={`/room/${snapshot.room.next_room_id}?live=1`}>朋友在下一局等你 →</Link></Button> : host ? <Button variant="secondary" disabled={busy} onClick={() => void act("rematch_voice_bricks")}>原班人马，再来一局</Button> : <p>房主开好下一局后，入口会出现在这里。</p>}
    </div>
    {error && <p role="alert" className="form-error">{error}</p>}
    <button type="button" onClick={() => void refresh()}>重新同步房间</button>
  </section></AppShell>;
}
