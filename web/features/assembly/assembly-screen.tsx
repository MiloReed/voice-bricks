"use client";

import { closestCenter, DndContext, DragEndEvent, DragOverlay, KeyboardSensor, PointerSensor, TouchSensor, useSensor, useSensors } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowRight, Check, Clock, DotsSixVertical, PencilSimple, Play, Wrench, X } from "@phosphor-icons/react";
import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/ui/app-shell";
import { Button } from "@/components/ui/buttons";
import { VoiceBrick } from "@/components/voice-brick/voice-brick";
import { estimateDuration, speak } from "@/lib/audio/speech";
import { defaultConfig, getBlocks, getConfig, saveBlocks } from "@/lib/mock-data";
import { playPartyCue } from "@/lib/audio/party-sound";
import { sessionStore } from "@/lib/browser-storage";
import { validateUserText } from "@/lib/content/safety";
import { SOLO_BLOCK_COUNT } from "@/lib/game/solo";
import type { VoiceBlockData } from "@/types/game";

export function AssemblyScreen({ roomId = "demo", isLive = false }: { roomId?: string; isLive?: boolean }) {
  const router = useRouter();
  const [blocks, setBlocks] = useState<VoiceBlockData[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [settledId, setSettledId] = useState<string | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [finalEditAvailable, setFinalEditAvailable] = useState(true);
  const [mode, setMode] = useState(defaultConfig.mode);
  const [voice, setVoice] = useState(defaultConfig.voice);
  const [secondsLeft, setSecondsLeft] = useState(30);
  const [loaded, setLoaded] = useState(false);
  const [editError, setEditError] = useState("");
  const settleTimer = useRef<number | null>(null);
  const autoFinishTriggered = useRef(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const config = getConfig(roomId);
      setMode(config.mode);
      setVoice(config.voice);
      setBlocks(getBlocks(config.mode, roomId));
      if (roomId === "solo") setFinalEditAvailable(sessionStore.getItem("voice-bricks-solo-edit-used") !== "1");
      setLoaded(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [roomId]);

  useEffect(() => () => {
    if (settleTimer.current) window.clearTimeout(settleTimer.current);
  }, []);

  useEffect(() => {
    if (mode !== "chaos") return;
    const timer = window.setInterval(() => setSecondsLeft((current) => {
      if (current <= 1) {
        window.clearInterval(timer);
        return 0;
      }
      return current - 1;
    }), 1000);
    return () => window.clearInterval(timer);
  }, [mode]);

  useEffect(() => {
    if (mode !== "chaos" || secondsLeft !== 0 || autoFinishTriggered.current) return;
    autoFinishTriggered.current = true;
    saveBlocks(blocks, mode, roomId);
    router.push(`/room/${roomId}/reveal${isLive ? "?live=1" : ""}`);
  }, [blocks, isLive, mode, roomId, router, secondsLeft]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 140, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const total = blocks.reduce((sum, block) => sum + block.duration, 0);
  const editLimit = roomId === "solo" ? Math.min(15, 65 - blocks.reduce((sum, block) => sum + block.text.length, 0) + (blocks.find(block => block.id === editingId)?.text.length ?? 0)) : 15;
  const activeBlock = useMemo(() => blocks.find((block) => block.id === activeId), [activeId, blocks]);

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveId(null);
    if (!over || active.id === over.id) return;
    const movedId = String(active.id);
    playPartyCue("snap");
    setBlocks((current) => {
      const next = arrayMove(current, current.findIndex((block) => block.id === active.id), current.findIndex((block) => block.id === over.id));
      saveBlocks(next, mode, roomId);
      return next;
    });
    setSettledId(movedId);
    if (settleTimer.current) window.clearTimeout(settleTimer.current);
    settleTimer.current = window.setTimeout(() => setSettledId(null), 260);
  };

  const playBlock = (block: VoiceBlockData) => { setPlaying(block.id); speak(block.text, () => setPlaying(null), voice, () => setPlaying(null), block.audioUrl, undefined, roomId === "solo"); };

  const previewAll = () => {
    let index = 0;
    const next = () => {
      const block = blocks[index];
      if (!block) { setPlaying(null); return; }
      setPlaying(block.id);
      index += 1;
      speak(block.text, next, voice, () => setPlaying(null), block.audioUrl, undefined, roomId === "solo");
    };
    next();
  };

  const openEdit = (block: VoiceBlockData) => {
    if (!finalEditAvailable) return;
    setEditingId(block.id);
    setEditText(block.text);
    setEditError("");
  };

  const applyEdit = () => {
    if (!editingId || !editText.trim()) return;
    if (roomId === "solo") {
      const validation = validateUserText(editText, editLimit);
      if (!validation.ok) { setEditError(validation.error); return; }
    }
    const next = blocks.map((block) => block.id === editingId ? { ...block, text: editText.trim(), duration: estimateDuration(editText), audioUrl: undefined } : block);
    setBlocks(next);
    saveBlocks(next, mode, roomId);
    if (roomId === "solo") sessionStore.setItem("voice-bricks-solo-edit-used", "1");
    setEditingId(null);
    setFinalEditAvailable(false);
  };

  const finish = () => {
    saveBlocks(blocks, mode, roomId);
    router.push(`/room/${roomId}/reveal${isLive ? "?live=1" : ""}`);
  };

  if (roomId === "solo" && loaded && blocks.length < SOLO_BLOCK_COUNT) return <AppShell backHref="/"><section className="lobby-notice"><h1>先接几句，再来拼装。</h1><Button asChild><Link href={blocks.length ? "/room/solo/play" : "/create?solo=1"}>{blocks.length ? "继续接龙" : "开始单人试玩"}</Link></Button></section></AppShell>;

  return (
    <AppShell backHref={`/room/${roomId}/play${isLive ? "?live=1" : ""}`} headerAction={<span className="round-pill assembly-clock"><Clock weight="bold" />{roomId === "solo" ? "单人 · 自由拼装" : mode === "chaos" ? `00:${String(secondsLeft).padStart(2, "0")}` : "LIVE"}</span>}>
      <div className="assembly-layout">
        <section className="assembly-intro">
          <p className="eyebrow">Assembly table</p>
          <h1>{mode === "chaos" ? "把混乱救回来。" : "最后，拼成完整的一句。"}</h1>
          <p>按住积木拖动排序，松手放入位置。故事没有标准答案，拼成你喜欢的版本。</p>
          <div className="assembly-stats"><strong>{blocks.reduce((sum, block) => sum + block.text.length, 0)} <small>/ 65 字</small> · {total.toFixed(1)} <small>/ 15s</small></strong><span className={finalEditAvailable ? "" : "is-used"}><Wrench weight="bold" />Final Edit × {finalEditAvailable ? 1 : 0}</span></div>
        </section>

        <section className="assembly-board">
          <div className="board-top"><span>FINAL ORDER</span><button type="button" onClick={previewAll}><Play weight="fill" />整段试听</button></div>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={({ active }) => setActiveId(String(active.id))} onDragCancel={() => setActiveId(null)} onDragEnd={onDragEnd}>
            <SortableContext items={blocks.map((block) => block.id)} strategy={verticalListSortingStrategy}>
              <div className="sortable-chain">
                {blocks.map((block, index) => (
                  <SortableBrick key={block.id} block={block} order={index + 1} playing={playing === block.id} settling={settledId === block.id} onPlay={() => playBlock(block)} onEdit={() => openEdit(block)} canEdit={finalEditAvailable} />
                ))}
              </div>
            </SortableContext>
            <DragOverlay dropAnimation={{ duration: 240, easing: "cubic-bezier(0.23, 1, 0.32, 1)" }}>{activeBlock ? <div className="drag-overlay"><VoiceBrick block={activeBlock} compact dragging /></div> : null}</DragOverlay>
          </DndContext>
          <div className="snap-legend"><i /><span>拖到这里会自动吸附</span><i /></div>
        </section>

        <AnimatePresence>
          {editingId && (
            <motion.section className="edit-drawer" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 30 }}>
              <div className="edit-heading"><span><PencilSimple weight="bold" /></span><div><small>FINAL EDIT · ONLY ONCE</small><h2>修好这一块，就不能再改了。</h2></div><button type="button" onClick={() => setEditingId(null)} aria-label="关闭"><X weight="bold" /></button></div>
              <input value={editText} maxLength={editLimit} onChange={(event) => { setEditText(event.target.value); setEditError(""); }} aria-label="修改积木文字" />
              {editError && <p role="alert">{editError}</p>}
              <Button onClick={applyEdit} disabled={!editText.trim()} icon={<Check weight="bold" />}>确认这次修补</Button>
            </motion.section>
          )}
        </AnimatePresence>

        <div className="assembly-action"><span>{blocks.length} 块 · {total.toFixed(1)} 秒 · 顺序已保存</span><Button onClick={finish} disabled={!blocks.length} icon={<ArrowRight weight="bold" />}>完成拼装</Button></div>
      </div>
    </AppShell>
  );
}

function SortableBrick({ block, order, playing, settling, onPlay, onEdit, canEdit }: { block: VoiceBlockData; order: number; playing: boolean; settling: boolean; onPlay: () => void; onEdit: () => void; canEdit: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging, isOver } = useSortable({ id: block.id });
  return (
    <div ref={setNodeRef} className="sortable-item" data-over={isOver || undefined} data-dragging={isDragging || undefined} data-settling={settling || undefined} style={{ transform: CSS.Transform.toString(transform), transition }}>
      <button className="drag-handle" type="button" {...attributes} {...listeners} aria-label={`拖动第 ${order} 块`}><DotsSixVertical weight="bold" /></button>
      <VoiceBrick block={block} compact order={order} playing={playing} settling={settling} onPlay={onPlay} />
      <button className="edit-brick" type="button" onClick={onEdit} disabled={!canEdit} aria-label={`修改 ${block.text}`}><PencilSimple weight="bold" /></button>
    </div>
  );
}
