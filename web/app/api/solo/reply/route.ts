import { generateSoloReply, parseSoloStory } from "@/lib/ai/solo-reply";
import { reserveSoloReplyCapacity } from "@/lib/tts/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const story = parseSoloStory(await request.json().catch(() => null));
  if (!story) return Response.json({ error: "需要有效的主题和故事，且当前应轮到机器人" }, { status: 400 });
  const key = process.env.DEEPSEEK_API_KEY?.trim();
  if (!key) return Response.json({ error: "未配置 DEEPSEEK_API_KEY，机器人暂时无法接龙" }, { status: 503 });
  try {
    if (!await reserveSoloReplyCapacity(request)) return Response.json({ error: "接龙请求较多，请稍后再试" }, { status: 429, headers: { "Retry-After": "60" } });
  } catch {
    return Response.json({ error: "机器人服务暂时不可用，请稍后重试" }, { status: 503 });
  }
  try {
    const text = await generateSoloReply(story, { key, model: process.env.DEEPSEEK_MODEL });
    return Response.json({ text }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error && error.name === "Error" ? error.message : "机器人回应超时或连接失败，请重试；你的故事已保留";
    return Response.json({ error: message }, { status: 502 });
  }
}
