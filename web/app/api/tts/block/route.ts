import { allVoiceOptions as voiceOptions } from "@/lib/game/voices";
import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { generateGameAudio, getVuiVoiceId } from "@/lib/tts/providers/vui";
import { validateUserText } from "@/lib/content/safety";
import { reserveTtsCapacity } from "@/lib/tts/rate-limit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !publishableKey || !serviceRoleKey) return Response.json({ error: "Supabase server credentials are not configured" }, { status: 503 });

    const authorization = request.headers.get("authorization") ?? "";
    const accessToken = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
    if (!accessToken) return Response.json({ error: "Authentication required" }, { status: 401 });
    const body = await request.json().catch(() => null) as { blockId?: unknown } | null;
    if (!body || typeof body !== "object" || Array.isArray(body)) return Response.json({ error: "请求需要有效的 JSON 对象" }, { status: 400 });
    const blockId = typeof body.blockId === "string" ? body.blockId : "";
    if (!/^[0-9a-f-]{36}$/i.test(blockId)) return Response.json({ error: "Invalid block" }, { status: 400 });

    const userClient = createClient(supabaseUrl, publishableKey, {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser(accessToken);
    if (userError || !userData.user) return Response.json({ error: "Invalid player session" }, { status: 401 });
    const { data: claimData, error: claimError } = await userClient.rpc("claim_voice_brick_preview", { candidate_block_id: blockId });
    if (claimError) return Response.json({ error: claimError.message }, { status: 403 });
    const claim = claimData?.[0] as { preview_room_id: string; preview_voice_id: string; preview_text: string; existing_audio_url: string | null } | undefined;
    if (!claim) return Response.json({ error: "Block preview is unavailable" }, { status: 404 });

    const voice = voiceOptions.find((option) => option.id === claim.preview_voice_id);
    const validation = validateUserText(claim.preview_text, 30);
    if (!voice || !validation.ok) return Response.json({ error: "Selected voice or text is unavailable" }, { status: 400 });
    const revision = createHash("sha256").update(`vui\0${getVuiVoiceId(voice.id)}\0${validation.value}`).digest("hex").slice(0, 16);
    if (claim.existing_audio_url?.endsWith(`/${blockId}-vui-${revision}.wav`)) return Response.json({ audioUrl: claim.existing_audio_url, cached: true });
    if (!await reserveTtsCapacity(request, `block:${blockId}:${revision}`)) return Response.json({ error: "语音正在生成或请求过于频繁，请稍后再试" }, { status: 429 });
    const audio = await generateGameAudio(validation.value, voice.id);
    const serviceClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const audioPath = `${claim.preview_room_id}/blocks/${blockId}-vui-${revision}.wav`;
    const { error: uploadError } = await serviceClient.storage.from("voice-bricks-audio").upload(audioPath, audio.bytes, {
      contentType: audio.contentType,
      cacheControl: "31536000",
      upsert: true,
    });
    if (uploadError) throw uploadError;
    const { data: publicUrl } = serviceClient.storage.from("voice-bricks-audio").getPublicUrl(audioPath);
    // A slower pre-edit request must not replace audio for the revised text.
    const { error: blockError } = await serviceClient.from("blocks").update({ preview_audio_url: publicUrl.publicUrl, status: "rendered" }).eq("id", blockId).eq("text", claim.preview_text);
    if (blockError) throw blockError;
    return Response.json({ audioUrl: publicUrl.publicUrl, cached: false });
  } catch {
    return Response.json({ error: "积木语音暂时不可用，请稍后重试" }, { status: 503 });
  }
}
