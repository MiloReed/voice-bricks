"use client";

import { Check, CircleNotch, DownloadSimple, WarningCircle } from "@phosphor-icons/react";
import { Player } from "@remotion/player";
import { useMemo, useState } from "react";
import {
  VIDEO_FPS,
  VIDEO_HEIGHT,
  VIDEO_WIDTH,
  VoiceBricksVideo,
  getVoiceBricksVideoDuration,
  type VoiceBricksVideoProps,
} from "@/remotion/voice-bricks-video";
import type { GameConfig, VoiceBlockData } from "@/types/game";
import { fitBlocksToAudio, measureAudio } from "@/lib/audio/timing";

interface VideoPreviewProps {
  config: GameConfig;
  blocks: VoiceBlockData[];
  audioUrl: string | null;
  qr: string;
  commentary?: string | null;
  ensureAudio: () => Promise<string>;
  onRendered?: (file: File) => Promise<void> | void;
}

export function VideoPreview({ config, blocks, audioUrl, qr, commentary, ensureAudio, onRendered }: VideoPreviewProps) {
  const [rendering, setRendering] = useState(false);
  const [progress, setProgress] = useState(0);
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState("");
  const durationInFrames = getVoiceBricksVideoDuration(blocks);
  const inputProps = useMemo<VoiceBricksVideoProps>(() => ({ config, blocks, audioUrl, qr, commentary }), [audioUrl, blocks, commentary, config, qr]);

  const renderVideo = async () => {
    if (!blocks.length || rendering) return;
    setRendering(true);
    setComplete(false);
    setError("");
    setProgress(0);
    try {
      const resolvedAudioUrl = audioUrl || await ensureAudio();
      const timedBlocks = fitBlocksToAudio(blocks, await measureAudio(resolvedAudioUrl));
      const videoProps: VoiceBricksVideoProps = { config, blocks: timedBlocks, audioUrl: resolvedAudioUrl, qr, commentary };
      const [{ canRenderMediaOnWeb, renderMediaOnWeb }] = await Promise.all([
        import("@remotion/web-renderer"),
        document.fonts.ready,
      ]);
      const capability = await canRenderMediaOnWeb({
        container: "mp4",
        videoCodec: "h264",
        audioCodec: "aac",
        width: VIDEO_WIDTH,
        height: VIDEO_HEIGHT,
        videoBitrate: "high",
        audioBitrate: "high",
      });
      if (!capability.canRender) {
        throw new Error(capability.issues.filter((issue) => issue.severity === "error").map((issue) => issue.message).join("；") || "当前浏览器不支持视频导出");
      }

      const { getBlob } = await renderMediaOnWeb({
        composition: {
          id: "VoiceBricksShare",
          component: VoiceBricksVideo,
          durationInFrames: getVoiceBricksVideoDuration(timedBlocks),
          fps: VIDEO_FPS,
          width: VIDEO_WIDTH,
          height: VIDEO_HEIGHT,
          defaultProps: videoProps,
        },
        inputProps: videoProps,
        container: "mp4",
        videoCodec: "h264",
        audioCodec: "aac",
        videoBitrate: "high",
        audioBitrate: "high",
        hardwareAcceleration: "no-preference",
        licenseKey: "free-license",
        pageResponsiveness: "high",
        onProgress: ({ progress: nextProgress }) => setProgress(nextProgress),
      });
      const blob = await getBlob();
      const safeName = config.teamName.trim().replace(/[^a-zA-Z0-9\u4e00-\u9fff-]+/g, "-") || "voice-bricks";
      const file = new File([blob], `${safeName}-voice-bricks-9x16.mp4`, { type: "video/mp4" });
      void Promise.resolve(onRendered?.(file)).catch(() => setError("本地视频已生成，但云端保存失败，可以重新分享本地文件。"));
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.download = `${safeName}-voice-bricks-9x16.mp4`;
      link.href = objectUrl;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 30_000);
      setProgress(1);
      setComplete(true);
    } catch (renderError) {
      setError(renderError instanceof Error ? renderError.message : "视频生成失败");
    } finally {
      setRendering(false);
    }
  };

  return (
    <article className="remotion-preview" aria-label="9:16 分享视频预览">
      <div className="remotion-player-frame">
        <Player
          component={VoiceBricksVideo}
          inputProps={inputProps}
          durationInFrames={durationInFrames}
          compositionWidth={VIDEO_WIDTH}
          compositionHeight={VIDEO_HEIGHT}
          fps={VIDEO_FPS}
          acknowledgeRemotionLicense
          controls
          style={{ width: "100%", aspectRatio: "9 / 16" }}
        />
      </div>
      <div className="video-render-panel">
        <div className="video-render-meta"><strong>9:16 · 1080 × 1920</strong><span>H.264 MP4 · 含 最终音轨</span></div>
        <button type="button" onClick={renderVideo} disabled={rendering || !blocks.length}>
          {rendering ? <CircleNotch className="spin" weight="bold" /> : complete ? <Check weight="bold" /> : <DownloadSimple weight="bold" />}
          {rendering ? `正在生成 ${Math.round(progress * 100)}%` : complete ? "已下载，可再次生成" : "生成并下载视频"}
        </button>
        {rendering && <div className="video-render-progress" aria-label={`视频生成进度 ${Math.round(progress * 100)}%`}><i style={{ width: `${Math.max(2, progress * 100)}%` }} /></div>}
        {error && <p className="video-render-error"><WarningCircle weight="bold" />{error}</p>}
      </div>
    </article>
  );
}
