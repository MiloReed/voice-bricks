import { allVoiceOptions as voiceOptions } from "@/lib/game/voices";
import { createClient } from "@supabase/supabase-js";
import { parseBuffer } from "music-metadata";
import { fitBlocksToAudio } from "@/lib/audio/timing";
import { generateAiCommentary } from "@/lib/share/ai-commentary";
import { generateGameAudio } from "@/lib/tts/providers/vui";
import { validateUserText } from "@/lib/content/safety";
import { reserveTtsCapacity } from "@/lib/tts/rate-limit";
import type { GameConfig, Player, PublicWorkPayload, VoiceBlockData } from "@/types/game";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let roomIdForRecovery = "";
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !publishableKey || !serviceRoleKey) {
      return Response.json({ error: "Supabase server credentials are not configured" }, { status: 503 });
    }

    const authorization = request.headers.get("authorization") ?? "";
    const accessToken = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
    if (!accessToken) return Response.json({ error: "Authentication required" }, { status: 401 });

    const body = await request.json().catch(() => null) as { roomId?: unknown } | null;
    if (!body || typeof body !== "object" || Array.isArray(body)) return Response.json({ error: "请求需要有效的 JSON 对象" }, { status: 400 });
    const roomId = typeof body.roomId === "string" ? body.roomId : "";
    if (!/^[0-9a-f-]{36}$/i.test(roomId)) return Response.json({ error: "Invalid room" }, { status: 400 });

    const userClient = createClient(supabaseUrl, publishableKey, {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser(accessToken);
    if (userError || !userData.user) return Response.json({ error: "Invalid player session" }, { status: 401 });

    const { data: claimData, error: claimError } = await userClient.rpc("claim_voice_bricks_render", {
      candidate_room_id: roomId,
    });
    if (claimError) return Response.json({ error: claimError.message }, { status: 403 });
    const claim = claimData?.[0] as { render_voice_id: string; render_text: string; render_duration: number; existing_audio_url: string | null } | undefined;
    if (!claim?.render_text) return Response.json({ error: "No blocks to render" }, { status: 409 });
    if (!claim.existing_audio_url) {
      if (!await reserveTtsCapacity(request, `final:${roomId}`)) return Response.json({ error: "作品正在生成或请求过于频繁，请稍后再试" }, { status: 429 });
      roomIdForRecovery = roomId;
    }

    const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    if (claim.existing_audio_url) {
      await serviceClient.from("rooms").update({ status: "revealed" }).eq("id", roomId).eq("status", "rendering");
      return Response.json({ audioUrl: claim.existing_audio_url, cached: true });
    }

    const [roomResult, playersResult, blocksResult] = await Promise.all([
      serviceClient.from("rooms").select("host_user_id, team_name, mode, max_players, theme, voice_id").eq("id", roomId).single(),
      serviceClient.from("room_players").select("id, user_id, display_name, color, seat_index, is_ready").eq("room_id", roomId).order("seat_index"),
      serviceClient.from("blocks").select("id, player_id, text, preview_audio_url, duration_seconds, position").eq("room_id", roomId).order("position"),
    ]);
    if (roomResult.error) throw roomResult.error;
    if (playersResult.error) throw playersResult.error;
    if (blocksResult.error) throw blocksResult.error;

    const room = roomResult.data;
    const players = playersResult.data.map((record) => ({
      id: record.id,
      name: record.display_name,
      color: record.color,
      ready: record.is_ready,
      host: record.user_id === room.host_user_id,
    } as Player));
    const playerById = new Map(players.map((player) => [player.id, player]));
    const blocks = blocksResult.data.flatMap((record) => {
      const player = playerById.get(record.player_id);
      if (!player) return [];
      return [{
        id: record.id,
        text: record.text,
        duration: Number(record.duration_seconds ?? 1),
        audioUrl: record.preview_audio_url ?? undefined,
        player,
      } satisfies VoiceBlockData];
    });
    const config: GameConfig = {
      mode: room.mode,
      playerCount: room.max_players,
      theme: room.theme,
      voice: room.voice_id,
      teamName: room.team_name,
    };
    const sharePayload: PublicWorkPayload = { version: 1, config, blocks };
    const voice = voiceOptions.find((option) => option.id === claim.render_voice_id);
    const validation = validateUserText(claim.render_text, 180);
    if (!voice || !validation.ok) throw new Error("Selected voice or text is unavailable");
    const [commentary, audio] = await Promise.all([
      generateAiCommentary(config, blocks),
      generateGameAudio(validation.value, voice.id),
    ]);
    const persistedWork = {
      room_id: roomId,
      final_text: claim.render_text,
      duration_seconds: Number(claim.render_duration),
      ai_comment: commentary,
      share_payload: sharePayload,
    };

    const metadata = await parseBuffer(new Uint8Array(audio.bytes), { mimeType: audio.contentType }, { duration: true });
    const actualDuration = metadata.format.duration;
    if (!actualDuration || !Number.isFinite(actualDuration)) throw new Error("Unable to measure final audio");
    persistedWork.duration_seconds = actualDuration;
    sharePayload.blocks = fitBlocksToAudio(blocks, actualDuration);
    const audioPath = `${roomId}/final-vui.wav`;
    const { error: uploadError } = await serviceClient.storage.from("voice-bricks-audio").upload(audioPath, audio.bytes, {
      contentType: audio.contentType,
      cacheControl: "31536000",
      upsert: true,
    });
    if (uploadError) throw uploadError;
    const { data: publicUrl } = serviceClient.storage.from("voice-bricks-audio").getPublicUrl(audioPath);

    const { error: workError } = await serviceClient.from("works").upsert({
      ...persistedWork,
      final_audio_url: publicUrl.publicUrl,
    }, { onConflict: "room_id" });
    if (workError) throw workError;
    const { error: roomError } = await serviceClient.from("rooms").update({ status: "revealed" }).eq("id", roomId);
    if (roomError) throw roomError;

    return Response.json({ audioUrl: publicUrl.publicUrl, cached: false });
  } catch {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (roomIdForRecovery && supabaseUrl && serviceRoleKey) {
      const serviceClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
      await serviceClient.from("rooms").update({ status: "assembly" }).eq("id", roomIdForRecovery).eq("status", "rendering");
    }
    return Response.json({ error: "最终语音生成失败，请稍后重试" }, { status: 503 });
  }
}
