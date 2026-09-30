"use client";

import { Check, Play, Sparkle, Waveform } from "@phosphor-icons/react";
import { AnimatePresence, motion } from "motion/react";
import { Button } from "@/components/ui/buttons";
import { VoiceBrick } from "@/components/voice-brick/voice-brick";
import { estimateDuration } from "@/lib/audio/speech";
import type { Player } from "@/types/game";

export function BrickComposer({
  value,
  onChange,
  player,
  onPreview,
  onSubmit,
  previewing,
  label = "制造你的声音积木",
  maxLength = 15,
  busy = false,
  hint = "给它一个小麻烦，再留半句话让朋友接。",
}: {
  value: string;
  onChange: (value: string) => void;
  player: Player;
  onPreview: () => void;
  onSubmit: () => void;
  previewing: boolean;
  label?: string;
  maxLength?: number;
  busy?: boolean;
  hint?: string;
}) {
  const duration = estimateDuration(value);
  const block = { id: "draft", text: value || "你写下的文字会出现在这里", duration, player };

  return (
    <section className="brick-composer">
      <div className="composer-title"><span><Sparkle weight="fill" /></span><div><small>YOUR TURN</small><h2>{label}</h2></div></div>
      <div className="composer-workbench">
        <p className="writing-hint">没灵感？{hint}</p>
        <textarea value={value} maxLength={maxLength} onChange={(event) => onChange(event.target.value)} placeholder="写一句能让朋友接下去的话……" aria-label="声音积木文字" />
        <div className="composer-metrics"><span>{value.length} / {maxLength} 字</span><span><Waveform weight="bold" />约 {duration.toFixed(1)}s</span></div>
        <AnimatePresence mode="wait">
          <motion.div key="preview" className="composer-preview" initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: value ? 1 : 0.45, scale: 1, y: 0 }}>
            <VoiceBrick block={block} playing={previewing} disabled={!value} onPlay={value ? onPreview : undefined} />
          </motion.div>
        </AnimatePresence>
      </div>
      <div className="composer-actions">
        <Button variant="secondary" onClick={onPreview} disabled={!value} icon={previewing ? <Waveform weight="bold" /> : <Play weight="fill" />}>试听</Button>
        <Button onClick={onSubmit} disabled={!value.trim() || busy} icon={<Check weight="bold" />}>{busy ? "正在接上…" : "提交这一块"}</Button>
      </div>
    </section>
  );
}
