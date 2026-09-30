"use client";

import { motion, useReducedMotion } from "motion/react";
import { Play, Waveform } from "@phosphor-icons/react";
import type { CSSProperties } from "react";
import type { VoiceBlockData } from "@/types/game";

export interface VoiceBrickProps {
  block: VoiceBlockData;
  playing?: boolean;
  dragging?: boolean;
  settling?: boolean;
  disabled?: boolean;
  compact?: boolean;
  order?: number;
  className?: string;
  style?: CSSProperties;
  onPlay?: () => void;
  animateEntrance?: boolean;
}

export function VoiceBrick({
  block,
  playing = false,
  dragging = false,
  settling = false,
  disabled = false,
  compact = false,
  order,
  className = "",
  style,
  onPlay,
  animateEntrance = true,
}: VoiceBrickProps) {
  const reduceMotion = useReducedMotion();
  const units = block.text.length > 10 || block.duration > 3 ? 8 : block.text.length > 6 || block.duration > 2 ? 7 : 6;
  const brickWidth = units * (compact ? 44 : 48);
  const brickHeight = compact ? 88 : 100;
  const brickStyle = {
    ...style,
    "--brick-width": `${brickWidth}px`,
    "--brick-height": `${brickHeight}px`,
  } as CSSProperties;

  return (
    <motion.article
      data-color={block.player.color}
      data-playing={playing || undefined}
      data-dragging={dragging || undefined}
      data-settling={settling || undefined}
      data-disabled={disabled || undefined}
      className={`voice-brick ${compact ? "voice-brick-compact" : ""} ${className}`}
      style={brickStyle}
      initial={animateEntrance ? { opacity: 0, transform: "translate3d(0, 0, 0) rotateX(0deg) rotateZ(0deg) scale(1)" } : false}
      animate={{
        opacity: 1,
        transform: reduceMotion
          ? "translate3d(0, 0, 0) rotateX(0deg) rotateZ(0deg) scale(1)"
          : dragging
            ? "translate3d(0, -10px, 0) rotateX(0deg) rotateZ(1.5deg) scale(1.025)"
            : playing
              ? "translate3d(0, -3px, 0) rotateX(0deg) rotateZ(0deg) scale(1)"
              : "translate3d(0, 0, 0) rotateX(0deg) rotateZ(0deg) scale(1)",
      }}
      transition={{ duration: 0.24, ease: [0.23, 1, 0.32, 1] }}
    >
      <div className="brick-studs" aria-hidden="true">
        {Array.from({ length: units }, (_, index) => <i key={index} />)}
      </div>
      <div className="brick-face">
        {onPlay ? <button
          type="button"
          className="brick-play"
          aria-label={playing ? `重新播放 ${block.text}` : `播放 ${block.text}`}
          onClick={onPlay}
          disabled={disabled}
        >
          {playing ? <Waveform weight="bold" /> : <Play weight="fill" />}
        </button> : <span className="brick-play brick-play-static" aria-hidden="true"><Waveform weight="bold" /></span>}
        <div className="brick-copy">
          <strong>{block.text}</strong>
          <span>{block.duration.toFixed(1)}s</span>
        </div>
        <div className="brick-player">
          {order && <span className="brick-order">{order}</span>}
          <span>{block.player.name}</span>
        </div>
      </div>
      <div className="brick-depth" aria-hidden="true" />
    </motion.article>
  );
}
