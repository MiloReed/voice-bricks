"use client";

import { ArrowRight, Check, Clock, EyeSlash, Lightning, Sparkle, UsersThree, Waveform } from "@phosphor-icons/react";
import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { BrickComposer } from "@/components/gameplay/brick-composer";
import { GameCountdown } from "@/components/gameplay/game-countdown";
import { AppShell } from "@/components/ui/app-shell";
import { Button } from "@/components/ui/buttons";
import { VoiceBrick } from "@/components/voice-brick/voice-brick";
import { estimateDuration, speak } from "@/lib/audio/speech";
import { MIN_WORK_DURATION, shouldContinueClassicRound } from "@/lib/game/rules";
import { demoReply } from "@/lib/game/party-content";
import { chaosBlocks, defaultConfig, getConfig, players, saveBlocks } from "@/lib/mock-data";
import { playPartyCue } from "@/lib/audio/party-sound";
import type { GameConfig, GameMode, VoiceBlockData } from "@/types/game";

export function PlayScreen({ mode, testSeat = 1 }: { mode: GameMode; testSeat?: number }) {
  return mode === "chaos" ? <ChaosPlay /> : <ClassicPlay testSeat={testSeat} />;
}

function GameHeader({ config, label, duration }: { config: GameConfig; label: string; duration: number }) {
  return (
    <div className="game-topbar">
      <div><span>{label}</span><strong><Sparkle weight="fill" />{config.theme}</strong></div>
      <div className="duration-meter"><span style={{ width: `${Math.min(100, (duration / 15) * 100)}%` }} /><b>{duration.toFixed(1)} / 15s</b></div>
    </div>
  );
}

function ClassicPlay({ testSeat }: { testSeat: number }) {
  const router = useRouter();
  const [config, setConfig] = useState(defaultConfig);
  const [blocks, setBlocks] = useState<VoiceBlockData[]>([]);
  const [draft, setDraft] = useState("");
  const [playing, setPlaying] = useState<string | null>(null);
  const [phase, setPhase] = useState<"compose" | "simulating" | "complete">(testSeat === 1 ? "compose" : "simulating");
  const turnPlayers = useMemo(() => {
    const mockPlayers = players.slice(1, config.playerCount);
    return [...mockPlayers.slice(0, testSeat - 1), players[0], ...mockPlayers.slice(testSeat - 1)].slice(0, config.playerCount);
  }, [config.playerCount, testSeat]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setConfig(getConfig()));
    return () => window.cancelAnimationFrame(frame);
  }, []);
  useEffect(() => {
    if (phase !== "simulating") return;

    const timer = window.setTimeout(() => {
      const player = turnPlayers[blocks.length % config.playerCount];
      const text = demoReply(config.theme, blocks.length);
      const next = [...blocks, { id: `c${blocks.length + 1}`, text, duration: estimateDuration(text), player }];
      setBlocks(next);
      saveBlocks(next, "classic");
      const total = next.reduce((sum, block) => sum + block.duration, 0);
      const completedRound = next.length % config.playerCount === 0;
      const currentRound = Math.ceil(next.length / config.playerCount);
      const minimumBlocks = config.playerCount === 2 ? 4 : config.playerCount;
      if ((total >= MIN_WORK_DURATION && next.length >= minimumBlocks) || total >= 14.5 || (completedRound && !shouldContinueClassicRound(config.playerCount, currentRound, total))) setPhase("complete");
      else if (next.length % config.playerCount + 1 === testSeat) setPhase("compose");
    }, 900);

    return () => window.clearTimeout(timer);
  }, [blocks, config.playerCount, config.theme, phase, testSeat, turnPlayers]);

  const currentPlayer = turnPlayers[blocks.length % config.playerCount];
  const currentTurn = blocks.length % config.playerCount + 1;
  const currentRound = phase === "complete"
    ? Math.max(1, Math.ceil(blocks.length / config.playerCount))
    : Math.floor(blocks.length / config.playerCount) + 1;
  const duration = blocks.reduce((sum, block) => sum + block.duration, 0) + (phase !== "compose" || !draft.trim() ? 0 : estimateDuration(draft));

  const play = (block: VoiceBlockData) => { setPlaying(block.id); speak(block.text, () => setPlaying(null), config.voice, () => setPlaying(null)); };
  const preview = () => { setPlaying("draft"); speak(draft, () => setPlaying(null), config.voice, () => setPlaying(null)); };
  const submit = () => {
    const text = draft.trim();
    if (!text) return;
    const next = [...blocks, { id: `c${blocks.length + 1}`, text, duration: estimateDuration(text), player: currentPlayer }];
    setBlocks(next);
    saveBlocks(next, "classic");
    setDraft("");
    playPartyCue("submit");
    const total = next.reduce((sum, block) => sum + block.duration, 0);
    const completedRound = next.length % config.playerCount === 0;
    const currentRound = Math.ceil(next.length / config.playerCount);
    const minimumBlocks = config.playerCount === 2 ? 4 : config.playerCount;
    setPhase((total >= MIN_WORK_DURATION && next.length >= minimumBlocks) || total >= 14.5 || (completedRound && !shouldContinueClassicRound(config.playerCount, currentRound, total)) ? "complete" : "simulating");
    setPlaying(null);
  };

  return (
    <AppShell backHref="/room/demo" headerAction={<span className="round-pill"><i />{phase === "complete" ? `作品完成 · ${blocks.length} 块` : `第 ${currentRound} 轮 · ${currentTurn} / ${config.playerCount} · ${currentPlayer.name}`}</span>}>
      <div className="game-layout">
        <GameHeader config={config} label="Classic · 顺序接龙" duration={duration} />
        <section className="chain-section">
          <div className="chain-heading"><div><span className="chain-pulse"><Waveform weight="bold" /></span><span><small>{blocks.length ? "正在接龙" : "单人试玩模式"}</small><strong>{blocks.length ? `${blocks.length} 块声音已经接好了` : `你负责第 ${testSeat} 棒，其余玩家由系统模拟`}</strong></span></div><p>{phase === "complete" ? "已经达到目标时长。" : phase === "simulating" ? `${currentPlayer.name} 正在完成第 ${currentTurn} 棒…` : `现在轮到你：第 ${testSeat} 棒。`}</p></div>
          <div className="block-chain">
            {!blocks.length && <div className="chain-empty"><span>01</span><strong>{testSeat === 1 ? "第一块还在等你制造" : "第一位 Mock 玩家正在制造积木"}</strong><small>{testSeat === 1 ? "提交后，其他玩家会自动把故事接下去" : `轮到第 ${testSeat} 棒时，系统会把创作权交给你`}</small></div>}
            {blocks.map((block, index) => (
              <motion.div key={block.id} className="chain-item" initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.08 }}>
                <VoiceBrick block={block} compact order={index + 1} playing={playing === block.id} onPlay={() => play(block)} />
                {index < blocks.length - 1 && <i className="chain-link" />}
              </motion.div>
            ))}
          </div>
        </section>

        {phase === "compose" ? (
          <BrickComposer value={draft} onChange={setDraft} player={currentPlayer} previewing={playing === "draft"} onPreview={preview} onSubmit={submit} label={`你的回合 · 第 ${testSeat} 棒`} />
        ) : phase === "simulating" ? (
          <motion.section className="submitted-stage handoff-stage simulating-stage" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
            <span className="simulating-token" data-color={currentPlayer.color}><Waveform weight="bold" /></span>
            <div><small>MOCK PLAYER · {blocks.length + 1} / {config.playerCount}</small><h2>{currentPlayer.name} 正在写下一句。</h2><p>你只负责第 {testSeat} 棒；其他位置会由 Mock 玩家依次完成。</p></div>
            <div className="waiting-dots" aria-label={`${currentPlayer.name} 正在输入`}><i /><i /><i /></div>
          </motion.section>
        ) : (
          <motion.section className="submitted-stage" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}>
            <span className="success-mark"><Check weight="bold" /></span>
            <div><small>SNAP!</small><h2>这一块接住了。</h2><p>{blocks.length} 块句子已经完整，去把它们排成最终版本。</p></div>
            <Button onClick={() => router.push("/room/demo/assembly")} icon={<ArrowRight weight="bold" />}>进入拼装</Button>
          </motion.section>
        )}
      </div>
    </AppShell>
  );
}

function ChaosPlay() {
  const router = useRouter();
  const [config, setConfig] = useState({ ...defaultConfig, mode: "chaos" as const });
  const [phase, setPhase] = useState<"countdown" | "compose" | "waiting" | "scatter">("countdown");
  const [count, setCount] = useState(3);
  const [draft, setDraft] = useState("");
  const [playing, setPlaying] = useState(false);
  const [composeSecondsLeft, setComposeSecondsLeft] = useState(30);
  const [scattered, setScattered] = useState<VoiceBlockData[]>([chaosBlocks[2], chaosBlocks[0], chaosBlocks[3], chaosBlocks[1]]);
  const [revealedBlocks, setRevealedBlocks] = useState<VoiceBlockData[]>(scattered);
  const [activeRevealIndex, setActiveRevealIndex] = useState(-1);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setConfig({ ...getConfig(), mode: "chaos" });
      const rotated = [...chaosBlocks];
      const offset = Date.now() % rotated.length;
      const randomOrder = [...rotated.slice(offset), ...rotated.slice(0, offset)].reverse();
      setScattered(randomOrder);
      setRevealedBlocks(randomOrder);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);
  useEffect(() => {
    if (phase !== "countdown") return;
    const timer = window.setInterval(() => setCount((current) => {
      if (current <= 1) { window.clearInterval(timer); setPhase("compose"); return 0; }
      return current - 1;
    }), 680);
    return () => window.clearInterval(timer);
  }, [phase]);

  useEffect(() => {
    if (phase !== "waiting") return;
    const timer = window.setTimeout(() => setPhase("scatter"), 1400);
    return () => window.clearTimeout(timer);
  }, [phase]);

  useEffect(() => {
    if (phase !== "compose" || composeSecondsLeft <= 0) return;
    const timer = window.setTimeout(() => setComposeSecondsLeft((current) => Math.max(0, current - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [composeSecondsLeft, phase]);

  useEffect(() => {
    if (phase !== "scatter" || !revealedBlocks.length) return;
    let index = 0;
    const next = () => {
      const block = revealedBlocks[index];
      if (!block) { setActiveRevealIndex(-1); return; }
      setActiveRevealIndex(index);
      index += 1;
      void speak(block.text, next, config.voice, next);
    };
    const timer = window.setTimeout(next, 450);
    return () => window.clearTimeout(timer);
  }, [config.voice, phase, revealedBlocks]);

  const preview = () => { setPlaying(true); speak(draft, () => setPlaying(false), config.voice, () => setPlaying(false)); };
  const submit = () => {
    const final = scattered.map((block) => block.id === "h4" ? { ...block, text: draft, duration: estimateDuration(draft) } : block);
    saveBlocks(final, "chaos");
    playPartyCue("submit");
    setRevealedBlocks(final);
    setPhase("waiting");
  };

  if (phase === "countdown") {
    return (
      <AppShell backHref="/room/demo" className="countdown-shell">
        <GameCountdown count={count} variant="chaos" eyebrow="BLIND WRITING" caption="所有人同时写。别偷看。" />
      </AppShell>
    );
  }

  return (
    <AppShell backHref="/room/demo" headerAction={<span className="round-pill chaos-round"><Clock weight="bold" />{phase === "compose" ? (composeSecondsLeft > 0 ? `00:${String(composeSecondsLeft).padStart(2, "0")}` : "请尽快提交") : "已提交"}</span>}>
      <div className="game-layout chaos-layout">
        <GameHeader config={config} label="Chaos · 同时创作" duration={phase === "scatter" ? revealedBlocks.reduce((sum, block) => sum + block.duration, 0) : estimateDuration(draft)} />
        <AnimatePresence mode="wait">
          {phase === "compose" || phase === "waiting" ? (
            <motion.div key="compose" className="chaos-compose" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, y: -12 }}>
              <section className="peer-status">
                <div className="peer-heading"><span><EyeSlash weight="bold" /></span><div><small>BLIND WRITING</small><h2>先写自己的，别人暂时看不见。</h2></div></div>
                <div className="peer-row">
                  {players.slice(0, 4).map((player, index) => (
                    <div key={player.id} data-color={player.color} className={index === 0 ? "is-you" : ""}>
                      <i />
                      <span><strong>{player.name}</strong><small>{phase === "waiting" ? (index === 2 ? "刚刚完成" : "已完成") : index === 0 ? "你正在写…" : index === 2 ? "writing…" : "已完成"}</small></span>
                      {(phase === "waiting" || (index !== 0 && index !== 2)) && <Check weight="bold" />}
                    </div>
                  ))}
                </div>
              </section>
              {phase === "compose" ? (
                <BrickComposer value={draft} onChange={setDraft} player={players[0]} previewing={playing} onPreview={preview} onSubmit={submit} label="只管写，等会儿一起看结果" maxLength={12} />
              ) : (
                <motion.section className="waiting-stage" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                  <span><EyeSlash weight="bold" /></span>
                  <div><small>LOCKED</small><h2>你的积木已经封好。</h2><p>还没全部完成前，任何人的正文都不会公开。</p></div>
                  <div className="waiting-dots"><i /><i /><i /></div>
                </motion.section>
              )}
            </motion.div>
          ) : (
            <motion.section key="scatter" className="scatter-stage" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="scatter-copy"><span><Lightning weight="fill" /></span><div><small>RANDOM VERSION</small><h1>呃……它们真的拼在一起了。</h1><p>系统先随手扔出一个版本。现在给你们 30 秒，把它救回来。</p></div></div>
              <div className="scatter-table">
                {revealedBlocks.map((block, index) => <motion.div key={block.id} initial={{ opacity: 0, x: index % 2 ? 80 : -80, y: -40, rotate: (index - 1.5) * 9 }} animate={{ opacity: 1, x: 0, y: activeRevealIndex === index ? -8 : 0, rotate: (index - 1.5) * 2 }} transition={{ delay: index * 0.14, type: "spring", stiffness: 240, damping: 20 }}><VoiceBrick block={block} compact playing={activeRevealIndex === index} /></motion.div>)}
              </div>
              <div className="scatter-action"><span><UsersThree weight="fill" />四个人都看见了</span><Button onClick={() => router.push("/room/demo/assembly")} icon={<ArrowRight weight="bold" />}>开始修补 · 30s</Button></div>
            </motion.section>
          )}
        </AnimatePresence>
      </div>
    </AppShell>
  );
}
