"use client";

import { sessionStore } from "@/lib/browser-storage";

import { closestCenter, DndContext, type DragEndEvent, DragOverlay, KeyboardSensor, PointerSensor, TouchSensor, useSensor, useSensors } from "@dnd-kit/core";
import { arrayMove, sortableKeyboardCoordinates, SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowRight, Check, Clock, DotsSixVertical, PencilSimple, Play, Wrench, X } from "@phosphor-icons/react";
import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/ui/app-shell";
import { Button } from "@/components/ui/buttons";
import { VoiceBrick } from "@/components/voice-brick/voice-brick";
import { estimateDuration, speak } from "@/lib/audio/speech";
import { saveBlocks, saveConfig } from "@/lib/mock-data";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { finalEditLiveBlock, finishLiveAssembly, getLiveGameSnapshot, leaveLiveRoomChannel, reorderLiveBlocks, requestFinalRender, subscribeToLiveRoom } from "@/lib/supabase/room-service";
import type { RoomSnapshot } from "@/lib/supabase/types";
import type { Player, VoiceBlockData } from "@/types/game";

export function LiveAssemblyScreen({ roomId }: { roomId: string }) {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState<RoomSnapshot | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const settleTimer = useRef<number | null>(null);
  const renderRequested = useRef(false);
  const autoFinishRequested = useRef(false);
  const [settledId, setSettledId] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    try {
      const next = await getLiveGameSnapshot(roomId);
      setSnapshot(next);
      // Preserve action errors across background refreshes.
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "无法同步拼装桌");
    }
  }, [roomId]);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const frame = window.requestAnimationFrame(() => void refresh());
    const channel = subscribeToLiveRoom(roomId, () => void refresh());
    return () => {
      window.cancelAnimationFrame(frame);
      if (settleTimer.current) window.clearTimeout(settleTimer.current);
      void leaveLiveRoomChannel(channel);
    };
  }, [refresh, roomId]);

  const players: Player[] = useMemo(() => snapshot?.players.map((player) => ({ id: player.id, name: player.display_name, color: player.color, ready: player.is_ready, host: player.user_id === snapshot.room.host_user_id })) ?? [], [snapshot]);
  const blocks: VoiceBlockData[] = useMemo(() => snapshot?.blocks?.map((block) => ({ id: block.id, text: block.text, duration: Number(block.duration_seconds), audioUrl: block.preview_audio_url ?? undefined, player: players.find((player) => player.id === block.player_id)! })).filter((block) => block.player) ?? [], [players, snapshot?.blocks]);

  useEffect(() => {
    if (!snapshot || !["revealed", "completed"].includes(snapshot.room.status) || !blocks.length) return;
    saveConfig({ mode: snapshot.room.mode, playerCount: snapshot.room.max_players, theme: snapshot.room.theme, voice: snapshot.room.voice_id, teamName: snapshot.room.team_name });
    saveBlocks(blocks, snapshot.room.mode);
    if (snapshot.work?.final_audio_url) sessionStore.setItem("voice-bricks-final-audio", JSON.stringify({ roomId, audioUrl: snapshot.work.final_audio_url, duration: snapshot.work.duration_seconds }));
    router.push(`/room/${roomId}/reveal?live=1`);
  }, [blocks, roomId, router, snapshot]);

  useEffect(() => {
    if (!snapshot || snapshot.room.status !== "rendering" || snapshot.currentUserId !== snapshot.room.host_user_id || renderRequested.current) return;
    renderRequested.current = true;
    void requestFinalRender(roomId).then(() => refresh()).catch((renderError) => {
      setError(renderError instanceof Error ? renderError.message : "最终声音生成失败");
      // Explicit retry prevents a failed or rate-limited render from looping.
    });
  }, [refresh, roomId, snapshot]);

  useEffect(() => {
    if (!snapshot?.room.assembly_deadline_at || snapshot.room.status !== "assembly") return;
    const update = () => {
      const remaining = Math.max(0, Math.ceil((new Date(snapshot.room.assembly_deadline_at!).getTime() - Date.now() - (snapshot.clockOffset || 0)) / 1000));
      setSecondsLeft(remaining);
      if (remaining === 0 && !busy && snapshot.currentUserId === snapshot.room.host_user_id && !autoFinishRequested.current) {
        autoFinishRequested.current = true;
        void finishLiveAssembly(roomId).catch((finishError) => {
          setError(finishError instanceof Error ? finishError.message : "倒计时结束，但自动完成失败");
        });
      }
    };
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [busy, roomId, snapshot]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(TouchSensor, { activationConstraint: { delay: 140, tolerance: 8 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  if (!isSupabaseConfigured) return <AppShell backHref="/room/demo"><section className="lobby-notice"><h1>多人服务尚未配置</h1><p>当前可以继续使用本地完整试玩。</p></section></AppShell>;
  if (!snapshot) return <AppShell backHref={`/room/${roomId}/play?live=1`}><section className="lobby-notice"><h1>{error || "正在打开拼装桌"}</h1><p>正在读取主持人的最终排列。</p></section></AppShell>;

  const isHost = snapshot.currentUserId === snapshot.room.host_user_id;
  if (snapshot.room.status === "rendering") return <AppShell backHref={`/room/${roomId}/assembly?live=1`}><section className="render-waiting"><motion.span animate={{ rotate: 360 }} transition={{ duration: 2.4, ease: "linear", repeat: Infinity }}><Wrench weight="bold" /></motion.span><p>FINAL RENDER</p><h1>正在把所有积木，<br />封装成一段声音。</h1><small>{isHost ? "正在生成最终版本，请保持页面打开。" : "主持人正在生成最终版本，完成后会自动开始 Reveal。"}</small>{error && <><strong role="alert">{error}</strong>{isHost && <Button onClick={() => { renderRequested.current = false; void refresh(); }}>重试生成</Button>}</>}</section></AppShell>;
  const total = blocks.reduce((sum, block) => sum + block.duration, 0);
  const activeBlock = blocks.find((block) => block.id === activeId);
  const onDragEnd = async ({ active, over }: DragEndEvent) => {
    setActiveId(null);
    if (!over || active.id === over.id || busy) return;
    setBusy(true);
    setError("");
    const ordered = arrayMove(blocks, blocks.findIndex((block) => block.id === active.id), blocks.findIndex((block) => block.id === over.id));
    setSnapshot((current) => current ? { ...current, blocks: ordered.map((block, position) => ({ ...current.blocks!.find((record) => record.id === block.id)!, position })) } : current);
    setSettledId(String(active.id));
    if (settleTimer.current) window.clearTimeout(settleTimer.current);
    settleTimer.current = window.setTimeout(() => setSettledId(null), 260);
    try { await reorderLiveBlocks(roomId, ordered.map((block) => block.id)); await refresh(); }
    catch (reorderError) { setError(reorderError instanceof Error ? reorderError.message : "排序保存失败"); await refresh(); }
    finally { setBusy(false); }
  };
  const playBlock = (block: VoiceBlockData) => { setPlaying(block.id); speak(block.text, () => setPlaying(null), snapshot.room.voice_id, () => setPlaying(null), block.audioUrl); };
  const previewAll = () => {
    let index = 0;
    const next = () => { const block = blocks[index]; if (!block) { setPlaying(null); return; } setPlaying(block.id); index += 1; speak(block.text, next, snapshot.room.voice_id, () => setPlaying(null), block.audioUrl); };
    next();
  };
  const applyEdit = async () => {
    if (!editingId || !editText.trim() || busy) return;
    setBusy(true); setError("");
    try { await finalEditLiveBlock(roomId, editingId, editText.trim(), estimateDuration(editText)); setEditingId(null); await refresh(); }
    catch (editError) { setError(editError instanceof Error ? editError.message : "修补失败"); }
    finally { setBusy(false); }
  };
  const finish = async () => {
    if (busy) return;
    setBusy(true); setError("");
    try { renderRequested.current = false; await finishLiveAssembly(roomId); await refresh(); }
    catch (finishError) { setError(finishError instanceof Error ? finishError.message : "无法完成拼装"); }
    finally { setBusy(false); }
  };

  return <AppShell backHref={`/room/${roomId}/play?live=1`} headerAction={<span className="round-pill assembly-clock"><Clock weight="bold" />{secondsLeft === null ? "LIVE SYNC" : `00:${String(secondsLeft).padStart(2, "0")}`}</span>}><div className="assembly-layout">
    <section className="assembly-intro"><p className="eyebrow">Assembly table</p><h1>{snapshot.room.mode === "chaos" ? "把混乱救回来。" : "最后，拼成完整的一句。"}</h1><p>所有玩家都可以拖动；最后一次操作会实时同步到全房间。{isHost ? "你是主持人，负责确认完成。" : "房主会负责最终确认。"}</p><div className="assembly-stats"><strong>{blocks.reduce((sum, block) => sum + block.text.length, 0)} <small>/ 65 字</small> · {total.toFixed(1)} <small>/ 15s 估算 · 成片以实际音轨为准</small></strong><span className={snapshot.room.final_edit_available ? "" : "is-used"}><Wrench weight="bold" />Final Edit × {snapshot.room.final_edit_available ? 1 : 0}</span></div></section>
    <section className="assembly-board"><div className="board-top"><span>FINAL ORDER · TEAM CONTROL</span><button type="button" onClick={previewAll}><Play weight="fill" />整段试听</button></div><DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={({ active }) => setActiveId(String(active.id))} onDragCancel={() => setActiveId(null)} onDragEnd={onDragEnd}><SortableContext items={blocks.map((block) => block.id)} strategy={verticalListSortingStrategy}><div className="sortable-chain">{blocks.map((block, index) => <LiveSortableBrick key={block.id} block={block} order={index + 1} playing={playing === block.id} settling={settledId === block.id} onPlay={() => playBlock(block)} onEdit={() => { setEditingId(block.id); setEditText(block.text); }} canEdit={snapshot.room.final_edit_available && !busy} canDrag={!busy} />)}</div></SortableContext><DragOverlay dropAnimation={{ duration: 240, easing: "cubic-bezier(0.23, 1, 0.32, 1)" }}>{activeBlock ? <div className="drag-overlay"><VoiceBrick block={activeBlock} compact dragging /></div> : null}</DragOverlay></DndContext><div className="snap-legend"><i /><span>释放后自动吸附并同步给所有人</span><i /></div></section>
    <AnimatePresence>{editingId && <motion.section className="edit-drawer" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 30 }}><div className="edit-heading"><span><PencilSimple weight="bold" /></span><div><small>FINAL EDIT · ONLY ONCE</small><h2>这次确认后，全房间都不能再改。</h2></div><button type="button" onClick={() => setEditingId(null)} aria-label="关闭"><X weight="bold" /></button></div><input value={editText} maxLength={15} onChange={(event) => setEditText(event.target.value)} aria-label="修改积木文字" />{error && <p className="form-error">{error}</p>}<Button onClick={applyEdit} disabled={busy || !editText.trim()} icon={<Check weight="bold" />}>{busy ? "正在同步…" : "确认这次修补"}</Button></motion.section>}</AnimatePresence>
    <div className="assembly-action"><span>{error || (isHost ? `${blocks.length} 块 · 排列会实时保存` : "等待主持人完成最终拼装")}</span>{isHost ? <Button onClick={finish} disabled={!blocks.length || busy} icon={<ArrowRight weight="bold" />}>{busy ? "正在保存…" : "完成拼装"}</Button> : <Button disabled variant="secondary">主持人操作中</Button>}</div>
  </div></AppShell>;
}

function LiveSortableBrick({ block, order, playing, settling, onPlay, onEdit, canEdit, canDrag }: { block: VoiceBlockData; order: number; playing: boolean; settling: boolean; onPlay: () => void; onEdit: () => void; canEdit: boolean; canDrag: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging, isOver } = useSortable({ id: block.id, disabled: !canDrag });
  return <div ref={setNodeRef} className="sortable-item" data-over={isOver || undefined} data-dragging={isDragging || undefined} data-settling={settling || undefined} style={{ transform: CSS.Transform.toString(transform), transition }}><button className="drag-handle" type="button" {...attributes} {...listeners} disabled={!canDrag} aria-label={canDrag ? `拖动第 ${order} 块` : `第 ${order} 块由主持人排序`}><DotsSixVertical weight="bold" /></button><VoiceBrick block={block} compact order={order} playing={playing} settling={settling} onPlay={onPlay} /><button className="edit-brick" type="button" onClick={onEdit} disabled={!canEdit} aria-label={`修改 ${block.text}`}><PencilSimple weight="bold" /></button></div>;
}
