import type { GameConfig, VoiceBlockData } from "@/types/game";

function stableHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function getShareCommentary(config: GameConfig, blocks: VoiceBlockData[]) {
  if (!blocks.length) return "故事还没开口，积木已经先把舞台占好了。";

  const transcript = blocks.map((block) => block.text.trim()).join("");
  const totalDuration = blocks.reduce((sum, block) => sum + block.duration, 0);
  const longest = blocks.reduce((current, block, index) => block.duration > current.duration
    ? { duration: block.duration, index }
    : current, { duration: -1, index: 0 });
  const shortestDuration = Math.min(...blocks.map((block) => block.duration));
  const durationSpread = longest.duration - shortestDuration;
  const hasQuestion = /[？?]/.test(transcript);
  const hasExclamation = /[！!]/.test(transcript);
  const themeEcho = config.theme.split(/[，。！？\s]/).filter((part) => part.length >= 2).some((part) => transcript.includes(part));
  const playerCount = new Set(blocks.map(block => block.player.id)).size;
  const lastLine = blocks.at(-1)!.text.replace(/[，。！？]+$/, "").slice(0, 12);

  const candidates = [
    config.mode === "chaos"
      ? `${playerCount} 个人各写各的，逻辑决定先下班。`
      : `故事走到“${lastLine}”，已经回不了头了。`,
    `第 ${longest.index + 1} 块：话最多，建议承担主要责任。`,
    durationSpread >= 1
      ? `${playerCount} 位编剧，一起把正常剧情挤下了车。`
      : `${playerCount} 个人一起写，谁也别说自己无辜。`,
    totalDuration >= 12
      ? "前半段认真铺垫，后半段成功把故事拐出了地图。"
      : "全程没给逻辑喘气，笑点倒先冲过终点。",
    hasQuestion
      ? "问题有人问了，答案显然被下一块积木藏起来了。"
      : "没有一句废话，但每一句都把事情推向更奇怪的地方。",
    hasExclamation
      ? "情绪先冲到终点，逻辑在后面努力追赶。"
      : "大家说得都很冷静，内容却完全不是这么回事。",
    themeEcho
      ? "主题还在场，只是已经被你们玩出了另一种物种。"
      : "从主题出发没多久，故事就自己改签了目的地。",
    longest.index === blocks.length - 1
      ? "最后一块稳稳落下，也把正常的结局一起压没了。"
      : "包袱来得比预计早，后面的积木只好继续装作镇定。",
    "开头像一次普通聚会，结尾已经像一份离奇证词。",
    "每块单听都很合理，合起来就只剩下勇气。",
    "节奏没有散，散的是故事原本打算去的方向。",
    "这段最厉害的地方，是所有意外都接得理直气壮。",
  ];
  const signature = [config.mode, config.theme, transcript, ...blocks.map((block) => `${block.player.id}:${block.duration.toFixed(2)}`)].join("|");

  return candidates[stableHash(signature) % candidates.length];
}
