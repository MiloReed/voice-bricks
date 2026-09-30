import { allVoiceOptions as voiceOptions } from "@/lib/game/voices";
import { generateGameAudio } from "@/lib/tts/providers/vui";
import { validateUserText } from "@/lib/content/safety";
import { reserveTtsCapacity } from "@/lib/tts/rate-limit";
import { getPresetPreview } from "@/lib/audio/preset-preview";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null) as { text?: unknown; voiceId?: unknown } | null;
    if (!body || typeof body !== "object" || Array.isArray(body)) return Response.json({ error: "请求需要有效的 JSON 对象" }, { status: 400 });
    const rawText = typeof body.text === "string" ? body.text : "";
    const voiceId = typeof body.voiceId === "string" ? body.voiceId : "";
    const voice = voiceOptions.find((option) => option.id === voiceId);

    const validation = validateUserText(rawText, 80);
    if (!validation.ok || !voice) {
      return Response.json({ error: "Invalid TTS preview request" }, { status: 400 });
    }

    const preset = getPresetPreview(validation.value, voice.id);
    if (preset) return Response.redirect(new URL(preset, request.url), 303);
    if (!await reserveTtsCapacity(request)) return Response.json({ error: "试听次数较多，请稍后再试" }, { status: 429, headers: { "Retry-After": "60" } });
    const audio = await generateGameAudio(validation.value, voice.id);
    return new Response(audio.bytes, {
      headers: {
        "Content-Type": audio.contentType,
        "Cache-Control": "no-store",
        "X-TTS-Provider": audio.provider,
      },
    });
  } catch {
    return Response.json({ error: "TTS preview is temporarily unavailable" }, { status: 503 });
  }
}
