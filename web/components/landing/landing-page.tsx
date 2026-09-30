"use client";

import Link from "next/link";
import { ArrowRight, Robot, Sparkle, UsersThree, Waveform } from "@phosphor-icons/react";
import { motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { AppShell } from "@/components/ui/app-shell";
import { Button } from "@/components/ui/buttons";
import { VoiceBrick } from "@/components/voice-brick/voice-brick";
import { speak } from "@/lib/audio/speech";
import { defaultConfig, players } from "@/lib/mock-data";
import type { VoiceBlockData } from "@/types/game";

const heroBlocks: VoiceBlockData[] = [
  { id: "hero-1", text: "我的冰箱辞职了，", duration: 1.541, audioUrl: "/audio/home/fridge-1.mp3", player: players[0] },
  { id: "hero-2", text: "说要去北极，", duration: 1.410375, audioUrl: "/audio/home/fridge-2.mp3", player: players[2] },
  { id: "hero-3", text: "应聘空调。", duration: 1.227625, audioUrl: "/audio/home/fridge-3.mp3", player: players[3] },
];

export function LandingPage() {
  const reduceMotion = useReducedMotion();
  const [playing, setPlaying] = useState<string | null>(null);

  const play = (block: VoiceBlockData) => {
    setPlaying(block.id);
    speak(block.text, () => setPlaying(null), defaultConfig.voice, () => setPlaying(null), block.audioUrl);
  };

  return (
    <AppShell className="landing-shell" headerAction={<nav className="landing-nav" aria-label="首页导航"><Link href="#how-to-play">怎么玩</Link><span className="hero-kicker"><UsersThree weight="fill" />2–5 人一起玩</span></nav>}>
      <section className="hero landing-main">
        <motion.div className="hero-copy" initial={reduceMotion ? false : { opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28 }}>
          <p className="hero-kicker"><Sparkle weight="fill" />今晚，嘴角别想下班。</p>
          <h1>你接一句，<span>全场<span className="hero-punch">笑出声。</span></span></h1>
          <p className="hero-subtitle">叫上朋友，一人一句，把故事越接越离谱。<br />最后让 AI 一本正经地念出来。</p>
          <div className="hero-actions">
            <Button asChild icon={<ArrowRight weight="bold" />}><Link href="/create">开一局！</Link></Button>
            <Button asChild variant="secondary"><Link href="/join">有房间码？加入</Link></Button>
          </div>
          <Link href="/create?solo=1" className="solo-entry"><Robot weight="bold" /><span><strong>一个人？先和机器人玩一局</strong><small>不用等朋友 · 体验完整接龙和拼装</small></span><ArrowRight weight="bold" /></Link>
          <div className="hero-proof">
            <span><UsersThree weight="bold" />2–5 位朋友</span>
            <span><Waveform weight="bold" />把脑洞念出声</span>
          </div>
        </motion.div>
        <motion.div className="hero-stage" initial={reduceMotion ? false : { opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.08, duration: 0.28 }} aria-label="三块声音积木正在拼成一句话">
          <div className="stage-orbit" />
          <span className="party-stamp" aria-hidden="true">越离谱<br />越好玩！</span>
          <div className="stage-label">声音试验台 <span>PLAY A LITTLE</span></div>
          {heroBlocks.map((block, index) => (
            <div key={block.id} className={`hero-brick-${["one", "two", "three"][index]}`}>
              <VoiceBrick block={block} compact playing={playing === block.id} onPlay={() => play(block)} />
            </div>
          ))}
          <div className="stage-caption"><Waveform weight="bold" />点积木，听听有多离谱</div>
        </motion.div>
      </section>
      <section id="how-to-play" className="party-how" aria-label="怎么玩">
        <div><b>01</b><span><strong>朋友就位</strong><small>发个房间码，大家一起进场</small></span></div>
        <div><b>02</b><span><strong>脑洞接力</strong><small>顺着接，或者一起盲写</small></span></div>
        <div><b>03</b><span><strong>收获名场面</strong><small>拼起来，放出来，笑出来</small></span></div>
      </section>
      <p className="landing-footnote">VOICE BRICKS / 声音积木 <span>好故事不一定合理，但一定有你。</span></p>
    </AppShell>
  );
}
