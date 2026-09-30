import type { VoiceBlockData } from "../../types/game.ts";

// Approximate sentence highlighting, not speech-recognition word timestamps.
export function fitBlocksToAudio(blocks: VoiceBlockData[], seconds: number): VoiceBlockData[] {
  const total = blocks.reduce((sum, block) => sum + block.duration, 0);
  if (!Number.isFinite(seconds) || seconds <= 0 || total <= 0) return blocks;
  return blocks.map(block => ({ ...block, duration: block.duration / total * seconds }));
}

export function measureAudio(url: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const audio = new Audio();
    const finish = (error?: Error) => {
      clearTimeout(timer);
      const duration = audio.duration;
      audio.onloadedmetadata = null; audio.onerror = null;
      audio.removeAttribute("src"); audio.load();
      if (error) reject(error); else resolve(duration);
    };
    const timer = setTimeout(() => finish(new Error("音轨加载较慢，请检查网络后重试")), 20000);
    audio.onloadedmetadata = () => finish(Number.isFinite(audio.duration) && audio.duration > 0 ? undefined : new Error("无法读取音轨时长"));
    audio.onerror = () => finish(new Error("音轨加载失败，请重试"));
    audio.preload = "metadata";
    audio.src = url;
  });
}
