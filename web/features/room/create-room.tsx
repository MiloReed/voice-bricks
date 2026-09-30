"use client";

import * as RadioGroup from "@radix-ui/react-radio-group";
import { ArrowRight, ArrowsClockwise, Check, CircleNotch, CirclesFour, DiceFive, Lightning, ListChecks, Play, Rows, Sparkle, UsersThree, Waveform } from "@phosphor-icons/react";
import { motion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AppShell, PageIntro } from "@/components/ui/app-shell";
import { Button } from "@/components/ui/buttons";
import { speak, stopSpeech } from "@/lib/audio/speech";
import { getPresetPreview } from "@/lib/audio/preset-preview";
import { clearBlocks, defaultConfig, saveConfig, voiceOptions } from "@/lib/mock-data";
import { localStore } from "@/lib/browser-storage";
import { pickPartyTheme } from "@/lib/game/party-content";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { createLiveRoom } from "@/lib/supabase/room-service";
import { roomErrorMessage } from "@/lib/supabase/errors";
import type { GameConfig, GameMode } from "@/types/game";

export function CreateRoom({ solo = false }: { solo?: boolean }) {
  const router = useRouter();
  const [config, setConfig] = useState<GameConfig>(solo ? { ...defaultConfig, playerCount: 3, teamName: "我的机器人小队" } : defaultConfig);
  const [themeType, setThemeType] = useState<"random" | "open" | "custom">("random");
  const [themeReady, setThemeReady] = useState(false);
  const [playingVoice, setPlayingVoice] = useState<string | null>(null);
  const [voiceLoading, setVoiceLoading] = useState(false);
  const [voiceBatch, setVoiceBatch] = useState(0);
  const [hostName, setHostName] = useState("Milo");
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const voicesPerBatch = 4;
  const visibleVoices = voiceOptions.slice(voiceBatch * voicesPerBatch, (voiceBatch + 1) * voicesPerBatch);
  const voiceBatchCount = Math.ceil(voiceOptions.length / voicesPerBatch);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const theme = pickPartyTheme(localStore.getItem("voice-bricks-last-theme"));
      localStore.setItem("voice-bricks-last-theme", theme);
      setConfig(current => ({ ...current, theme }));
      setThemeReady(true);
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
    if (connection?.saveData || connection?.effectiveType?.includes("2g")) return;
    const controller = new AbortController();
    // Only warm the visible four short clips; never spend TTS credits on hover.
    for (const voice of voiceOptions.slice(voiceBatch * 4, (voiceBatch + 1) * 4)) {
      const url = getPresetPreview(voice.sample, voice.id);
      if (url) void fetch(url, { cache: "force-cache", signal: controller.signal }).then(response => response.arrayBuffer()).catch(() => {});
    }
    return () => controller.abort();
  }, [voiceBatch]);

  useEffect(() => () => stopSpeech(), []);

  const update = <K extends keyof GameConfig>(key: K, value: GameConfig[K]) => setConfig((current) => ({ ...current, [key]: value }));

  const chosenTheme = useMemo(() => {
    if (themeType === "open") return "不限主题";
    return config.theme;
  }, [config.theme, themeType]);

  const submit = async () => {
    if (isCreating || !themeReady) return;
    const theme = chosenTheme.trim();
    if (!theme) {
      setCreateError("请填写自定义主题");
      return;
    }
    const finalConfig = { ...config, theme };
    if (solo) {
      saveConfig({ ...finalConfig, mode: "classic", playerCount: 3 }, "solo");
      clearBlocks("solo");
      router.push("/room/solo/play");
      return;
    }
    saveConfig(finalConfig);
    clearBlocks();
    setCreateError("");
    if (!isSupabaseConfigured) {
      router.push("/room/demo");
      return;
    }

    setIsCreating(true);
    try {
      const room = await createLiveRoom(finalConfig, hostName.trim() || "Milo");
      router.push(`/room/${room.created_room_id}`);
    } catch (error) {
      setCreateError(roomErrorMessage(error));
      setIsCreating(false);
    }
  };

  const shuffleTheme = () => {
    const theme = pickPartyTheme(config.theme);
    localStore.setItem("voice-bricks-last-theme", theme);
    update("theme", theme);
  };

  const shuffleVoices = () => {
    stopSpeech();
    setVoiceLoading(false);
    const nextBatch = (voiceBatch + 1) % voiceBatchCount;
    setVoiceBatch(nextBatch);
    update("voice", voiceOptions[nextBatch * voicesPerBatch].id);
    setPlayingVoice(null);
  };

  const previewVoice = (voice: (typeof voiceOptions)[number]) => {
    update("voice", voice.id);
    setPlayingVoice(voice.id);
    setVoiceLoading(true);
    const finish = () => { setPlayingVoice(null); setVoiceLoading(false); };
    void speak(voice.sample, finish, voice.id, finish, undefined, () => setVoiceLoading(false));
  };

  return (
    <AppShell backHref="/" headerAction={<span className="setup-overview"><ListChecks weight="bold" />{solo ? "单人 · 两位机器人陪玩" : "5 个快速选择"}</span>}>
      <div className="create-layout">
        <PageIntro eyebrow={solo ? "Solo play" : "Create a game"} title={solo ? <>朋友还没来？<br />机器人陪你玩。</> : <>先定个玩法，<br />再把朋友叫来。</>} description={solo ? "你、接梗鹅和反转猫，轮流接两轮。写一句、拼一段，再听听有多离谱。" : "不用填一张表。几步选择，一分钟后就能开局。"} />

        <div className="setup-stack">
          {solo ? <section className="setup-section solo-partners"><strong>你 → 机器人·接梗鹅 → 机器人·反转猫</strong><p>机器人自动接句子，你负责创作和最终拼装。不需要房间码，也不用等人。</p></section> : <><SetupSection number="01" title="想怎么玩？">
            <RadioGroup.Root className="mode-grid" value={config.mode} onValueChange={(value) => update("mode", value as GameMode)}>
              <RadioGroup.Item value="classic" className="mode-option mode-classic">
                <span className="mode-icon"><Rows weight="fill" /></span>
                <span className="mode-check"><Check weight="bold" /></span>
                <strong>Classic</strong>
                <b>顺序接龙</b>
                <small>一句接一句，把故事慢慢接出来。</small>
                <span className="mode-visual" aria-hidden="true"><i /><i /><i /></span>
              </RadioGroup.Item>
              <RadioGroup.Item value="chaos" className="mode-option mode-chaos">
                <span className="mode-icon"><Lightning weight="fill" /></span>
                <span className="mode-check"><Check weight="bold" /></span>
                <strong>Chaos</strong>
                <b>同时创作</b>
                <small>大家同时写，再看看能不能拼起来。</small>
                <span className="mode-visual mode-visual-chaos" aria-hidden="true"><i /><i /><i /></span>
              </RadioGroup.Item>
            </RadioGroup.Root>
          </SetupSection>

          <SetupSection number="02" title="几个人一起？" aside="推荐 3–4 人">
            <RadioGroup.Root className="count-row" value={String(config.playerCount)} onValueChange={(value) => update("playerCount", Number(value))}>
              {[2, 3, 4, 5].map((count) => (
                <RadioGroup.Item key={count} value={String(count)} className="count-option">
                  <span>{count}</span>
                  {(count === 3 || count === 4) && <small>推荐</small>}
                </RadioGroup.Item>
              ))}
            </RadioGroup.Root>
          </SetupSection></>}

          <SetupSection number={solo ? "01" : "03"} title="今晚的主题">
            <RadioGroup.Root className="theme-tabs" value={themeType} onValueChange={(value) => {
              const nextType = value as typeof themeType;
              setThemeType(nextType);
              setCreateError("");
              if (nextType === "random") shuffleTheme();
            }}>
              <RadioGroup.Item value="random"><DiceFive weight="bold" />随机灵感</RadioGroup.Item>
              <RadioGroup.Item value="open"><CirclesFour weight="bold" />不限主题</RadioGroup.Item>
              <RadioGroup.Item value="custom"><Sparkle weight="bold" />自定义</RadioGroup.Item>
            </RadioGroup.Root>
            {themeType === "random" && (
              <motion.div className="theme-prompt" key={config.theme} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}>
                <span>如果今晚聊点……</span>
                <strong>{themeReady ? config.theme : "正在挑选灵感…"}</strong>
                <button type="button" onClick={shuffleTheme} disabled={!themeReady} aria-label="换一个随机主题"><ArrowsClockwise weight="bold" /></button>
              </motion.div>
            )}
            {themeType === "open" && <div className="theme-prompt theme-open"><span>没有题目限制</span><strong>想到什么，就拼什么。</strong></div>}
            {themeType === "custom" && <input className="text-input" value={config.theme} maxLength={24} onChange={(event) => update("theme", event.target.value)} aria-label="自定义主题" placeholder="例如：如果电梯会读心" />}
          </SetupSection>

          <SetupSection number={solo ? "02" : "04"} title="选一个共同音色">
            <div className="voice-toolbar">
              <span>{voiceBatch === 0 ? "自然声线 · 适合接龙叙事" : "角色反差 · 适合一本正经地胡说"}</span>
              <button type="button" onClick={shuffleVoices}><ArrowsClockwise weight="bold" />换一批</button>
            </div>
            <RadioGroup.Root className="voice-row" value={config.voice} onValueChange={(value) => update("voice", value)}>
              {visibleVoices.map((voice) => (
                <RadioGroup.Item key={voice.id} value={voice.id} className="voice-card" data-selected={config.voice === voice.id || undefined} onClick={() => previewVoice(voice)} aria-label={`选择并试听${voice.name}音色，${voice.note}`}>
                  <span className="voice-play" aria-hidden="true">
                    {playingVoice === voice.id ? voiceLoading ? <CircleNotch className="spin" weight="bold" /> : <Waveform weight="bold" /> : <Play weight="fill" />}
                  </span>
                  <span className="voice-copy"><strong>{voice.name}</strong><small>{voice.note}</small><small>VUI · {voice.sourceName}</small></span>
                  <i><Check weight="bold" /></i>
                </RadioGroup.Item>
              ))}
            </RadioGroup.Root>
            <p role="status" className="writing-hint">{playingVoice ? voiceLoading ? "正在加载试听…" : "正在试听，再点其他音色可切换" : "点击即听 · 示例声音已提前准备"}</p>
            <div className="voice-pagination" aria-label={`音色第 ${voiceBatch + 1} 批，共 ${voiceBatchCount} 批`}>
              {Array.from({ length: voiceBatchCount }, (_, index) => <i key={index} data-active={index === voiceBatch || undefined} />)}
            </div>
          </SetupSection>

          {!solo && <SetupSection number="05" title="给小队起个名字" aside="可选">
            <input className="text-input" value={config.teamName} maxLength={16} onChange={(event) => update("teamName", event.target.value)} aria-label="小队名称" placeholder="周末小剧场" />
            <label className="creator-name-field">
              <span>你的名字</span>
              <input className="text-input" value={hostName} maxLength={16} onChange={(event) => setHostName(event.target.value)} aria-label="你的名字" placeholder="Milo" />
            </label>
          </SetupSection>}
        </div>

        <div className="create-summary">
          <div className="create-status"><span role={createError ? "alert" : undefined}><UsersThree weight="fill" />{createError || (solo ? "1 位玩家 + 2 位机器人 · 两轮接龙" : `${config.playerCount} 人 · ${config.mode === "classic" ? "顺序接龙" : "同时创作"}`)}</span>{createError && <Link href="/create?solo=1">先玩单人模式 →</Link>}</div>
          <Button onClick={submit} disabled={isCreating || !themeReady} icon={<ArrowRight weight="bold" />}>{isCreating ? "正在开房…" : solo ? "开始单人试玩" : "创建房间"}</Button>
        </div>
      </div>
    </AppShell>
  );
}

function SetupSection({ number, title, aside, children }: { number: string; title: string; aside?: string; children: React.ReactNode }) {
  return (
    <section className="setup-section">
      <div className="setup-heading"><span>{number}</span><h2>{title}</h2>{aside && <small>{aside}</small>}</div>
      {children}
    </section>
  );
}
