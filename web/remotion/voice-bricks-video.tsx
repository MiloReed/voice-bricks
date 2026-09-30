import { Audio } from "@remotion/media";
import { AbsoluteFill, Img, Sequence, interpolate, useCurrentFrame } from "remotion";
import { getShareCommentary } from "../lib/share/commentary";
import type { GameConfig, VoiceBlockData } from "../types/game";

export const VIDEO_FPS = 30;
export const VIDEO_WIDTH = 1080;
export const VIDEO_HEIGHT = 1920;
export const VIDEO_INTRO_FRAMES = 36;
export const VIDEO_OUTRO_FRAMES = 96;
export interface VoiceBricksVideoProps extends Record<string, unknown> {
  config: GameConfig; blocks: VoiceBlockData[]; audioUrl?: string | null; qr?: string; commentary?: string | null;
}
export function getVoiceBricksVideoDuration(blocks: VoiceBlockData[]) {
  return VIDEO_INTRO_FRAMES + Math.max(1, Math.ceil(blocks.reduce((sum, b) => sum + b.duration, 0) * VIDEO_FPS)) + VIDEO_OUTRO_FRAMES;
}
export function VoiceBricksVideo({ config, blocks, audioUrl, qr, commentary }: VoiceBricksVideoProps) {
  const frame = useCurrentFrame();
  const spokenFrames = getVoiceBricksVideoDuration(blocks) - VIDEO_INTRO_FRAMES - VIDEO_OUTRO_FRAMES;
  const outro = frame >= VIDEO_INTRO_FRAMES + spokenFrames;
  const starts = blocks.map((_, i) => VIDEO_INTRO_FRAMES + blocks.slice(0, i).reduce((sum, b) => sum + b.duration * VIDEO_FPS, 0));
  const active = starts.findLastIndex(start => frame >= start);
  const creators = [...new Map(blocks.map(b => [b.player.id, b.player.name])).values()];
  const colors = { purple: "#dccbff", blue: "#b8dfff", green: "#b7ebbd", yellow: "#ffe45e", pink: "#ffc8df" };
  // Every sentence gets a readable moment, including additional rounds.
  const windowStart = Math.max(0, active - 2);
  return <AbsoluteFill style={{ backgroundColor: "#fff8e7", color: "#211b31", fontFamily: '"Arial", "PingFang SC", "Microsoft YaHei", sans-serif', padding: "100px 80px" }}>
    {audioUrl && <Sequence from={VIDEO_INTRO_FRAMES} durationInFrames={spokenFrames}><Audio src={audioUrl} /></Sequence>}
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 27, fontWeight: 900, borderBottom: "4px solid #211b31", paddingBottom: 25 }}><span>VOICE BRICKS / 声音积木</span><span>朋友局出品 ↗</span></div>
    <div style={{ marginTop: 66, fontSize: 34, fontWeight: 800 }}>{creators.length} 个人，一句接一句</div>
    <h1 style={{ margin: "20px 0 30px", fontSize: 110, lineHeight: 1.12, letterSpacing: -5 }}>怎么就接成<br /><span style={{ backgroundColor: "#ffe45e", padding: "0 12px" }}>这样了？！</span></h1>
    <p style={{ fontSize: 34, lineHeight: 1.5, margin: "20px 0", maxHeight: 160 }}>本局命题 / {config.theme}</p>
    {!outro ? <>
      <div style={{ marginTop: 55, display: "flex", flexDirection: "column", gap: 42 }}>
        {blocks.slice(windowStart, windowStart + 3).map((b, j) => {
          const index = windowStart + j;
          const shown = frame >= starts[index];
          return <div key={b.id} style={{ position: "relative", background: `linear-gradient(180deg, #ffffff55, transparent 28%), ${shown ? colors[b.player.color] : "#eae3d6"}`, border: "2px solid #ffffff80", borderRadius: 22, boxShadow: `0 12px 0 ${shown ? colors[b.player.color] : "#eae3d6"}, 0 16px 0 #211b3140, 0 25px 18px #211b3120, inset 0 7px 0 #ffffff30`, padding: "24px 30px", minHeight: 140, opacity: shown ? 1 : 0.55, translate: "0px " + interpolate(frame - starts[index], [0, 6, 8], [18, -2, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) + "px" }}>
            <div style={{ position: "absolute", top: -24, left: 30, right: 30, display: "flex", justifyContent: "space-between" }}>{Array.from({ length: 8 }, (_, stud) => <div key={stud} style={{ width: 56, height: 26, borderRadius: "50% 50% 35% 35%", background: shown ? colors[b.player.color] : "#eae3d6", boxShadow: "inset 0 4px 0 #ffffff70, inset 0 -5px 0 #211b3120, 0 5px 0 #211b3130" }}><div style={{ margin: "6px 12px", height: 10, borderRadius: "50%", boxShadow: "inset 0 2px 2px #211b3130, 0 1px 0 #ffffff80" }} /></div>)}</div>
            <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 12 }}>{String(index + 1).padStart(2, "0")} / {b.player.name}{index === active ? "  ← 正在接话" : ""}</div>
            <div style={{ fontSize: b.text.length > 18 ? 44 : 52, fontWeight: 900, lineHeight: 1.3 }}>{shown ? b.text : "下一句会怎么接？"}</div>
          </div>;
        })}
      </div>
      <div style={{ position: "absolute", left: 80, right: 80, bottom: 200 }}><p style={{ fontSize: 29 }}>把声音打开，离谱才完整。 · {config.teamName}</p><div style={{ height: 12, backgroundColor: "#ddd3bd" }}><div style={{ height: 12, backgroundColor: "#7747dc", width: interpolate(frame, [VIDEO_INTRO_FRAMES, VIDEO_INTRO_FRAMES + spokenFrames], [0, 100], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) + "%" }} /></div></div>
    </> : <div style={{ backgroundColor: "#7747dc", color: "#fff8e7", border: "4px solid #211b31", boxShadow: "12px 12px 0 #211b31", marginTop: 55, padding: 44 }}>
      <p style={{ fontSize: 44, lineHeight: 1.5, margin: "0 0 28px" }}>“{commentary || getShareCommentary(config, blocks)}”</p>
      <p style={{ fontSize: 26, lineHeight: 1.6 }}>{creators.join(" / ")}</p>
      <div style={{ borderTop: "2px dashed #d8c5ff", paddingTop: 34, display: "flex", alignItems: "center", gap: 30 }}>{qr && <Img src={qr} style={{ width: 210, height: 210, border: "12px solid #fff" }} />}<div><strong style={{ fontSize: 52, lineHeight: 1.25 }}>这句换你接，<br />能更离谱吗？</strong><p style={{ fontSize: 27 }}>扫码听原声 · 叫朋友开一局</p></div></div>
    </div>}
  </AbsoluteFill>;
}
