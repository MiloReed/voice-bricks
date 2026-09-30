"use client";

import { sessionStore } from "@/lib/browser-storage";

import { ArrowRight, Check, CircleNotch, Copy, DownloadSimple, ImageSquare, Play, ShareNetwork, Video, Waveform } from "@phosphor-icons/react";
import dynamic from "next/dynamic";
import Link from "next/link";
import QRCode from "qrcode";
import { useCallback, useEffect, useRef, useState } from "react";
import { ShareCard } from "@/components/share/share-card";
import { RematchLink } from "@/components/share/rematch-link";
import { AppShell, PageIntro } from "@/components/ui/app-shell";
import { Button } from "@/components/ui/buttons";
import { SOLO_BLOCK_COUNT } from "@/lib/game/solo";
import { defaultConfig, getBlocks, getConfig } from "@/lib/mock-data";
import { playRenderedAudio } from "@/lib/audio/speech";
import { fitBlocksToAudio, measureAudio } from "@/lib/audio/timing";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import type { WorkRecord } from "@/lib/supabase/types";
import type { GameConfig, VoiceBlockData } from "@/types/game";

const VideoPreview = dynamic(() => import("@/components/share/video-preview").then((module) => module.VideoPreview), {
  ssr: false,
  loading: () => <div className="video-preview-loading"><CircleNotch className="spin" weight="bold" />正在准备视频画布</div>,
});

export function WorkScreen({ workId = "demo" }: { workId?: string }) {
  const [config, setConfig] = useState<GameConfig>(defaultConfig);
  const [blocks, setBlocks] = useState<VoiceBlockData[]>([]);
  const [qr, setQr] = useState("");
  const [format, setFormat] = useState<"image" | "video">("image");
  const [copied, setCopied] = useState(false);
  const [finalAudioUrl, setFinalAudioUrl] = useState<string | null>(null);
  const [playingFinal, setPlayingFinal] = useState(false);
  const [aiComment, setAiComment] = useState<string | null>(null);
  const [loadError, setLoadError] = useState("");
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const [audioLoading, setAudioLoading] = useState(false);
  const [audioError, setAudioError] = useState("");
  const [shareFile, setShareFile] = useState<File | null>(null);
  const [mediaStatus, setMediaStatus] = useState("");
  const shareCardRef = useRef<HTMLElement>(null);
  const generatedAudioUrlRef = useRef<string | null>(null);
  const audioPromiseRef = useRef<Promise<string> | null>(null);
  const measuredAudioRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const frame = window.requestAnimationFrame(() => {
      const load = async () => {
        if (workId === "demo" || workId === "solo") {
          const savedConfig = getConfig(workId);
          if (!cancelled) {
            setConfig(savedConfig);
            const localBlocks = getBlocks(savedConfig.mode, workId);
            setBlocks(localBlocks);
            if (workId === "solo" && localBlocks.length < SOLO_BLOCK_COUNT) setLoadError(localBlocks.length ? "这局接龙还没完成，请先写完两轮。" : "这台设备还没有单人作品，请先玩一局。");
          }
        } else {
          try {
            const response = await fetch(`/api/works/${encodeURIComponent(workId)}`, { signal: AbortSignal.timeout(20000) });
            const result = await response.json() as WorkRecord & { error?: string };
            if (!response.ok) throw new Error(result.error || "作品加载失败");
            if (!result.share_payload) throw new Error("这个作品是在分享功能上线前生成的，请房主重新生成最终声音");
            if (!cancelled) {
              setConfig(result.share_payload.config);
              setBlocks(result.share_payload.blocks);
              setFinalAudioUrl(result.final_audio_url);
              if (Number(result.duration_seconds) > 0 && result.final_audio_url) {
                measuredAudioRef.current = result.final_audio_url;
                setBlocks(fitBlocksToAudio(result.share_payload.blocks, Number(result.duration_seconds)));
              }
              setAiComment(result.ai_comment);
            }
          } catch (error) {
            if (!cancelled) setLoadError(error instanceof Error ? error.message : "作品加载失败");
          }
        }
        const storedAudio = sessionStore.getItem("voice-bricks-final-audio");
        if (storedAudio) {
          try {
            const parsed = JSON.parse(storedAudio) as { roomId?: string; audioUrl?: string };
            if (!cancelled && parsed.roomId === workId && parsed.audioUrl) setFinalAudioUrl(parsed.audioUrl);
          } catch {
            sessionStore.removeItem("voice-bricks-final-audio");
          }
        }
      };
      void load();
    });
    void QRCode.toDataURL(workId === "solo" ? `${window.location.origin}/create?solo=1` : `${window.location.origin}/work/${workId}`, { width: 240, margin: 1, color: { dark: "#242429", light: "#fffefa" } }).then((value) => {
      if (!cancelled) setQr(value);
    });
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
    };
  }, [workId]);

  useEffect(() => () => {
    if (generatedAudioUrlRef.current) URL.revokeObjectURL(generatedAudioUrlRef.current);
  }, []);

  useEffect(() => {
    // Production works already carry the server-measured duration. Avoid a
    // second audio download just to rediscover metadata before sharing.
    if (!finalAudioUrl || measuredAudioRef.current === finalAudioUrl) return;
    let cancelled = false;
    void measureAudio(finalAudioUrl).then(seconds => { if (!cancelled) setBlocks(current => fitBlocksToAudio(current, seconds)); }).catch(() => { if (!cancelled) setAudioError("音轨加载较慢，可以重新试听或重试生成视频。"); });
    return () => { cancelled = true; };
  }, [finalAudioUrl]);

  const ensureFinalAudio = useCallback(async () => {
    if (finalAudioUrl) return finalAudioUrl;
    if (audioPromiseRef.current) return audioPromiseRef.current;
    const request = (async () => {
      const response = await fetch("/api/tts/preview", {
        signal: AbortSignal.timeout(25000),
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: blocks.map((block) => block.text).join(""), voiceId: config.voice }),
      });
      if (!response.ok) throw new Error("最终音轨生成失败，请稍后重试");
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      generatedAudioUrlRef.current = objectUrl;
      setFinalAudioUrl(objectUrl);
      return objectUrl;
    })();
    audioPromiseRef.current = request;
    try {
      return await request;
    } finally {
      audioPromiseRef.current = null;
    }
  }, [blocks, config.voice, finalAudioUrl]);

  const selectVideo = () => {
    setShareFile(null);
    setFormat("video");
    setAudioError("");
    setAudioLoading(true);
    void ensureFinalAudio().catch((error) => {
      setAudioError(error instanceof Error ? error.message : "最终音轨生成失败");
    }).finally(() => setAudioLoading(false));
  };

  const rememberMedia = useCallback(async (file: File, kind: "image" | "video") => {
    setShareFile(file);
    if (workId === "demo" || workId === "solo" || !isSupabaseConfigured) return;
    setMediaStatus("正在保存到作品页…");
    try {
      const client = getSupabaseBrowserClient();
      const { data } = await client.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("只有房主可以保存分享媒体");
      const createResponse = await fetch(`/api/works/${encodeURIComponent(workId)}/media`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ kind }),
      });
      const upload = await createResponse.json() as { path?: string; token?: string; publicUrl?: string; error?: string };
      if (!createResponse.ok || !upload.path || !upload.token || !upload.publicUrl) throw new Error(upload.error || "无法创建上传地址");
      const { error: uploadError } = await client.storage.from("voice-bricks-share").uploadToSignedUrl(upload.path, upload.token, file, { contentType: file.type });
      if (uploadError) throw uploadError;
      const saveResponse = await fetch(`/api/works/${encodeURIComponent(workId)}/media`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ kind, publicUrl: upload.publicUrl }),
      });
      if (!saveResponse.ok) throw new Error("媒体已上传，但作品记录保存失败");
      setMediaStatus(kind === "image" ? "分享图片已保存到作品" : "分享视频已保存到作品");
    } catch (mediaError) {
      setMediaStatus(mediaError instanceof Error ? mediaError.message : "云端保存失败，本地文件仍可使用");
    }
  }, [workId]);

  const copyLink = async () => {
    setExportError("");
    try {
      if (!navigator.clipboard) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(workId === "solo" ? `${window.location.origin}/create?solo=1` : window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch { setExportError(workId === "solo" ? `当前浏览器无法复制，试玩邀请：${window.location.origin}/create?solo=1` : "当前浏览器无法复制，请从地址栏复制作品链接。"); }
  };
  const share = async () => {
    const data: ShareData = { title: "怎么就接成这样了？！", text: `「${blocks.at(-1)?.text || config.theme}」——这是我们接龙的结尾。你们能更离谱吗？`, url: workId === "solo" ? `${window.location.origin}/create?solo=1` : window.location.href };
    if (shareFile && navigator.canShare?.({ files: [shareFile] })) data.files = [shareFile];
    try {
      if (navigator.share) await navigator.share(data);
      else await copyLink();
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) setExportError("分享未成功，请下载图片或复制作品链接。");
    }
  };
  const downloadShareImage = async () => {
    if (!shareCardRef.current || !qr) return;
    setExporting(true);
    setExportError("");
    let exportMount: HTMLDivElement | null = null;
    try {
      await document.fonts.ready;
      const { toPng } = await import("html-to-image");
      exportMount = document.createElement("div");
      Object.assign(exportMount.style, {
        position: "fixed",
        left: "-10000px",
        top: "0",
        width: "560px",
        height: "700px",
      });
      const exportCard = shareCardRef.current.cloneNode(true) as HTMLElement;
      exportCard.classList.add("share-card-export");
      exportCard.style.width = "560px";
      exportCard.style.height = "700px";
      exportCard.style.aspectRatio = "auto";
      exportMount.append(exportCard);
      document.body.append(exportMount);
      await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
      const dataUrl = await toPng(exportCard, {
        backgroundColor: "#fffefa",
        cacheBust: true,
        pixelRatio: 1080 / 560,
        width: 560,
        height: 700,
      });
      const safeName = config.teamName.trim().replace(/[^a-zA-Z0-9\u4e00-\u9fff-]+/g, "-") || "voice-bricks";
      const imageBlob = await (await fetch(dataUrl)).blob();
      const imageFile = new File([imageBlob], `${safeName}-voice-bricks.png`, { type: "image/png" });
      void rememberMedia(imageFile, "image");
      const link = document.createElement("a");
      link.download = `${safeName}-voice-bricks.png`;
      link.href = dataUrl;
      link.click();
    } catch (error) {
      setExportError(error instanceof Error ? error.message : "分享图片导出失败");
    } finally {
      exportMount?.remove();
      setExporting(false);
    }
  };
  const playFinal = () => {
    setPlayingFinal(true);
    void playRenderedAudio(
      { text: blocks.map((block) => block.text).join(""), voiceId: config.voice, audioUrl: finalAudioUrl, allowDeviceVoice: workId === "solo" },
      () => undefined,
      () => setPlayingFinal(false),
      () => setPlayingFinal(false),
    );
  };

  if (!blocks.length || (workId === "solo" && blocks.length < SOLO_BLOCK_COUNT)) return <AppShell><section className="lobby-notice"><h1>{loadError || "正在打开这局作品…"}</h1><p>先加载正文，再准备声音和分享素材。</p>{workId === "solo" && loadError ? <Button asChild><Link href={blocks.length ? "/room/solo/play" : "/create?solo=1"}>{blocks.length ? "继续接龙" : "开始单人试玩"}</Link></Button> : <Button onClick={() => window.location.reload()}>重新加载</Button>}</section></AppShell>;

  return (
    <AppShell backHref={workId === "demo" || workId === "solo" ? `/room/${workId}/reveal` : "/"} headerAction={<span className="live-pill"><i />{workId === "solo" ? "单人作品 · 本机保存" : "作品已生成"}</span>}>
      <div className="work-layout">
        <section className="work-copy">
          <PageIntro eyebrow={workId === "solo" ? "MADE WITH YOUR ROBOT TEAM" : "MADE BY YOUR CHAOTIC FRIENDS"} title={<>这局的离谱，<br />别只留在群里。</>} description={workId === "solo" ? "把你和机器人接出的故事做成一张海报，发给朋友。下次，把真正的朋友也叫来接。" : "发一张看得懂的故事海报，或一段先卖关子、再逐句揭晓的有声短片。下一句，换朋友来接。"} />
          {workId !== "solo" && <RematchLink roomId={workId} />}
          {workId === "solo" && <Button asChild variant="quiet"><Link href="/create?solo=1">再和机器人玩一局 →</Link></Button>}
          <div className="format-switch" role="tablist" aria-label="分享格式">
            <button type="button" role="tab" aria-selected={format === "image"} onClick={() => { setShareFile(null); setFormat("image"); }}><ImageSquare weight="bold" />故事海报<span>4:5</span></button>
            {workId !== "solo" && <button type="button" role="tab" aria-selected={format === "video"} onClick={selectVideo}><Video weight="bold" />分享视频<span>9:16</span></button>}
          </div>
          <div className="work-actions">
            <Button variant="secondary" onClick={playFinal} icon={playingFinal ? <Waveform weight="bold" /> : <Play weight="fill" />}>{playingFinal ? "最终声音播放中" : "试听最终声音"}</Button>
            <Button onClick={share} icon={copied ? <Check weight="bold" /> : <ShareNetwork weight="bold" />}>{copied ? "链接已复制" : "分享给朋友"}</Button>
            {format === "image" && <Button variant="secondary" onClick={downloadShareImage} disabled={exporting || !qr || Boolean(loadError)} icon={exporting ? <CircleNotch className="spin" weight="bold" /> : <DownloadSimple weight="bold" />}>{exporting ? "正在生成高清图片" : "下载高清分享图"}</Button>}
            <Button variant="secondary" onClick={() => void copyLink()} icon={copied ? <Check weight="bold" /> : <Copy weight="bold" />}>{copied ? "链接已复制" : workId === "solo" ? "复制试玩邀请" : "复制作品链接"}</Button>
            <Button asChild variant="quiet" icon={<ArrowRight weight="bold" />}><Link href="/create">我也要和朋友拼一段</Link></Button>
          </div>
          {loadError ? <p className="mock-note work-error">{loadError}</p> : <p className="mock-note">{workId === "solo" ? "单人作品保存在当前浏览器，下载海报后可发给朋友；二维码和邀请链接会带朋友开始自己的单人试玩。" : "海报 1080 × 1350，视频 1080 × 1920。二维码指向这一局，朋友无需登录即可听作品。视频导出需要浏览器支持；不支持时可分享海报和作品链接。"}</p>}
          {exportError && <p className="mock-note work-error">{exportError}</p>}
          {audioLoading && <p className="mock-note">正在准备 最终音轨，视频画面可以先预览。</p>}
          {audioError && <p className="mock-note work-error">{audioError}</p>}
          {mediaStatus && <p className="mock-note">{mediaStatus}</p>}
        </section>
        <section className={`preview-stage preview-${format}`}>
          {format === "image" ? <ShareCard ref={shareCardRef} config={config} blocks={blocks} qr={qr} commentary={aiComment} solo={workId === "solo"} /> : <VideoPreview config={config} blocks={blocks} audioUrl={finalAudioUrl} qr={qr} commentary={aiComment} ensureAudio={ensureFinalAudio} onRendered={(file) => rememberMedia(file, "video")} />}
        </section>
      </div>
    </AppShell>
  );
}
