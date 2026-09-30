import Image from "next/image";
import { forwardRef } from "react";
import { getShareCommentary } from "@/lib/share/commentary";
import type { GameConfig, VoiceBlockData } from "@/types/game";

export const ShareCard = forwardRef<HTMLElement, { config: GameConfig; blocks: VoiceBlockData[]; qr: string; commentary?: string | null; solo?: boolean }>(function ShareCard({ config, blocks, qr, commentary, solo = false }, ref) {
  const creators = [...new Map(blocks.map(b => [b.player.id, b.player])).values()];
  return <article className="share-card party-poster" aria-label="Voice Bricks 分享卡预览" ref={ref}>
    <header className="poster-masthead"><span>VOICE BRICKS / 声音积木</span><b>{solo ? "机器人小队出品 ↗" : "朋友局出品 ↗"}</b></header>
    <div className="poster-hook"><span>{solo ? "一个人、两位机器人，一句接一句" : `${creators.length} 个人，一句接一句`}</span><h2>怎么就接成<br /><em>这样了？！</em></h2><span className="poster-stamp">建议<br />开声音</span></div>
    <p className="poster-theme">本局命题 / {config.theme}</p>
    <div className="poster-story" style={{ fontSize: blocks.map(b => b.text).join("").length > 50 ? 22 : 27 }}>
      {blocks.map((b, i) => <span key={b.id} data-color={b.player.color}><small>{String(i + 1).padStart(2, "0")}</small>{b.text}</span>)}
    </div>
    <p className="poster-roast">“{commentary || getShareCommentary(config, blocks)}”</p>
    <div className="poster-credits">{creators.map(p => <span key={p.id} data-color={p.color}>{p.name}</span>)}</div>
    <footer className="poster-footer"><div><strong>{solo ? "这次，换你接个梗。" : "听完这局，换你接。"}</strong><span>{solo ? "扫码试玩 → 机器人陪你开一局" : "扫码听原声 → 叫朋友开下一局"}</span><small>{config.teamName} · {config.mode === "chaos" ? "全员盲写" : "一句接一句"}</small></div>{qr && <Image src={qr} width={84} height={84} alt={solo ? "扫码开始单人试玩" : "扫码听这局并开始你的朋友局"} unoptimized />}</footer>
  </article>;
});
