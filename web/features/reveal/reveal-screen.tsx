"use client";

import { sessionStore } from "@/lib/browser-storage";

import Link from "next/link";
import { ArrowClockwise, ArrowRight, Confetti, Play, Sparkle, Waveform } from "@phosphor-icons/react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { AppShell, BrandMark } from "@/components/ui/app-shell";
import { GameCountdown } from "@/components/gameplay/game-countdown";
import { Button } from "@/components/ui/buttons";
import { VoiceBrick } from "@/components/voice-brick/voice-brick";
import { playRenderedAudio } from "@/lib/audio/speech";
import { defaultConfig, getBlocks, getConfig, players } from "@/lib/mock-data";
import { SOLO_BLOCK_COUNT } from "@/lib/game/solo";
import { getShareCommentary } from "@/lib/share/commentary";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { completeLiveRoom } from "@/lib/supabase/room-service";
import type { VoiceBlockData } from "@/types/game";
import { LiveRevealScreen } from "./live-reveal-screen";

export function RevealScreen({ roomId = "demo" }: { roomId?: string }) {
  return roomId !== "demo" && roomId !== "solo" && isSupabaseConfigured ? <LiveRevealScreen roomId={roomId} /> : <DemoRevealScreen roomId={roomId} />;
}

function DemoRevealScreen({ roomId }: { roomId: string }) {
  const [blocks, setBlocks] = useState<VoiceBlockData[]>([]);
  const [config, setConfig] = useState(defaultConfig);
  const [phase, setPhase] = useState<"countdown" | "playing" | "done">("countdown");
  const [count, setCount] = useState(3);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [finalAudioUrl, setFinalAudioUrl] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const total = useMemo(() => blocks.reduce((sum, block) => sum + block.duration, 0), [blocks]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const savedConfig = getConfig(roomId);
      setConfig(savedConfig);
      setBlocks(getBlocks(savedConfig.mode, roomId));
      setLoaded(true);
      const storedAudio = sessionStore.getItem("voice-bricks-final-audio");
      if (storedAudio) {
        try {
          const parsed = JSON.parse(storedAudio) as { roomId?: string; audioUrl?: string };
          if (parsed.roomId === roomId && parsed.audioUrl) setFinalAudioUrl(parsed.audioUrl);
        } catch {
          sessionStore.removeItem("voice-bricks-final-audio");
        }
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [roomId]);

  useEffect(() => {
    if (phase !== "countdown" || !blocks.length || (roomId === "solo" && blocks.length < SOLO_BLOCK_COUNT)) return;
    const timer = window.setInterval(() => setCount((current) => {
      if (current <= 1) { window.clearInterval(timer); setPhase("playing"); return 0; }
      return current - 1;
    }), 760);
    return () => window.clearInterval(timer);
  }, [blocks.length, phase, roomId]);

  useEffect(() => {
    if (phase !== "playing") return;
    const transcript = blocks.map((block) => block.text).join("");
    void playRenderedAudio(
      { text: transcript, voiceId: config.voice, audioUrl: finalAudioUrl, allowDeviceVoice: roomId === "solo" },
      (currentTime, actualDuration) => {
        const timelineTime = Number.isFinite(actualDuration) && actualDuration > 0 ? currentTime / actualDuration * total : currentTime;
        let elapsed = 0;
        const index = blocks.findIndex((block) => { elapsed += block.duration; return timelineTime <= elapsed; });
        setActiveIndex(index < 0 ? blocks.length - 1 : index);
      },
      () => { setActiveIndex(-1); setPhase("done"); },
      () => { setActiveIndex(-1); setPhase("done"); },
    );
  }, [blocks, config.voice, finalAudioUrl, phase, roomId, total]);

  const commentary = useMemo(() => getShareCommentary(config, blocks), [blocks, config]);
  const creators = useMemo(() => [...new Map(blocks.map((block) => [block.player.id, block.player.name])).values()], [blocks]);
  useEffect(() => {
    if (phase !== "done" || roomId === "demo" || roomId === "solo" || !isSupabaseConfigured) return;
    void completeLiveRoom(roomId);
  }, [phase, roomId]);
  const replay = () => { setCount(3); setActiveIndex(-1); setPhase("countdown"); };

  if (roomId === "solo" && loaded && blocks.length < SOLO_BLOCK_COUNT) return <AppShell backHref="/"><section className="lobby-notice"><h1>{blocks.length ? "先把两轮接龙完成，再听作品。" : "这里还没有单人作品。"}</h1><Button asChild><Link href={blocks.length ? "/room/solo/play" : "/create?solo=1"}>{blocks.length ? "继续接龙" : "开始单人试玩"}</Link></Button></section></AppShell>;

  return (
    <main className="reveal-shell">
      <div className="reveal-ambient reveal-ambient-one" /><div className="reveal-ambient reveal-ambient-two" />
      <header><BrandMark /></header>
      <AnimatePresence mode="wait">
        {phase === "countdown" ? (
          <GameCountdown key="countdown" count={count} variant="reveal" eyebrow="READY TO HEAR IT?" caption="把声音打开。" />
        ) : (
          <motion.section key="reveal" className="reveal-stage" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="reveal-copy">
              <span>{phase === "playing" ? <><Waveform weight="bold" />正在播放</> : <><Confetti weight="fill" />拼好了</>}</span>
              <h1>{config.theme}</h1>
            </div>
            <div className="reveal-chain">
              {blocks.map((block, index) => (
                <motion.div key={block.id} initial={{ opacity: 0, transform: "translate3d(0, 38px, 0) scale(0.94)" }} animate={{ opacity: 1, transform: "translate3d(0, 0, 0) scale(1)" }} transition={{ delay: index * 0.08, duration: 0.24, ease: [0.23, 1, 0.32, 1] }}>
                  <VoiceBrick block={block} compact order={index + 1} playing={activeIndex === index} animateEntrance={false} />
                </motion.div>
              ))}
            </div>
            <AnimatePresence>
              {phase === "done" && (
                <motion.div className="reveal-result" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}>
                  <strong>{total.toFixed(1)}s</strong>
                  <span>Made by {(creators.length ? creators : players.slice(0, config.playerCount).map((player) => player.name)).join(" · ")}</span>
                  <p><Sparkle weight="fill" />“{commentary}”</p>
                  <div>
                    <Button variant="secondary" onClick={replay} icon={<ArrowClockwise weight="bold" />}>再听一次</Button>
                    <Button asChild icon={<ArrowRight weight="bold" />}><Link href={`/work/${roomId}`}>生成分享</Link></Button>
                    {roomId === "solo" && <Button asChild variant="quiet"><Link href="/create?solo=1">再玩一局</Link></Button>}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            {phase === "playing" && <div className="playing-note"><Play weight="fill" />声音积木正在逐块亮起</div>}
          </motion.section>
        )}
      </AnimatePresence>
    </main>
  );
}
