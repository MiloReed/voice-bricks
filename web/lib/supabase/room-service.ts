import { sessionStore } from "@/lib/browser-storage";
import type { RealtimeChannel, User } from "@supabase/supabase-js";
import type { GameConfig } from "@/types/game";
import { getSupabaseBrowserClient } from "./client";
import type { RoomSnapshot } from "./types";
import { playPartyCue } from "@/lib/audio/party-sound";

let identityRequest: Promise<User> | null = null;
const pendingSnapshots = new Map<string, Promise<RoomSnapshot>>();
const cleanups = new Map<RealtimeChannel, () => void>();

async function ensureAnonymousUser() {
  if (identityRequest) return identityRequest;
  identityRequest = loadUser();
  try { return await identityRequest; } finally { identityRequest = null; }
}

async function loadUser() {
  const supabase = getSupabaseBrowserClient();
  const { data: sessionData } = await supabase.auth.getSession();
  if (sessionData.session?.user) return sessionData.session.user;
  const { data, error } = await supabase.auth.signInAnonymously();
  if (error || !data.user) throw error ?? new Error("无法创建匿名玩家身份");
  return data.user;
}

export async function createLiveRoom(config: GameConfig, playerName: string) {
  const supabase = getSupabaseBrowserClient();
  await ensureAnonymousUser();
  const receiptKey = `voice-bricks-create:${JSON.stringify([config, playerName])}`;
  const requestId = sessionStore.getItem(receiptKey) || crypto.randomUUID();
  sessionStore.setItem(receiptKey, requestId);
  const { data, error } = await supabase.rpc("create_voice_bricks_room", {
    request_id: requestId,
    player_name: playerName,
    requested_team_name: config.teamName,
    requested_mode: config.mode,
    requested_max_players: config.playerCount,
    requested_theme: config.theme,
    requested_voice_id: config.voice,
  });
  if (error) throw new Error(error.message);
  const room = data?.[0] as { created_room_id: string; created_room_code: string } | undefined;
  if (!room) throw new Error("房间创建失败");
  sessionStore.removeItem(receiptKey);
  playPartyCue("join");
  return room;
}

export async function joinLiveRoom(code: string, playerName: string) {
  const supabase = getSupabaseBrowserClient();
  await ensureAnonymousUser();
  const { data, error } = await supabase.rpc("join_voice_bricks_room", {
    requested_code: code,
    player_name: playerName,
  });
  if (error) throw new Error(error.message);
  const room = data?.[0] as { joined_room_id: string; joined_seat_index: number } | undefined;
  if (!room) throw new Error("加入房间失败");
  playPartyCue("join");
  return room;
}

export async function getLiveRoomSnapshot(roomId: string): Promise<RoomSnapshot> {
  const existing = pendingSnapshots.get(roomId);
  if (existing) return existing;
  const request = (async () => {
    await ensureAnonymousUser();
    const started = Date.now();
    const { data, error } = await getSupabaseBrowserClient().rpc("voice_bricks_snapshot", { candidate_room_id: roomId });
    if (error) throw new Error(error.message);
    if (!data?.room) throw new Error("房间不存在或你尚未加入，请通过邀请链接进入");
    const snapshot = data as RoomSnapshot;
    snapshot.clockOffset = snapshot.serverTime ? Date.parse(snapshot.serverTime) - (started + Date.now()) / 2 : 0;
    return snapshot;
  })().finally(() => pendingSnapshots.delete(roomId));
  pendingSnapshots.set(roomId, request);
  return request;
}

export function subscribeToLiveRoom(roomId: string, onChange: () => void, pollMs = 8000): RealtimeChannel {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const notify = () => {
    // Continuous player/block events must not keep postponing a room refresh.
    if (timer !== undefined) return;
    timer = setTimeout(() => { timer = undefined; onChange(); }, 180);
  };
  const foreground = () => { if (document.visibilityState === "visible") notify(); };
  const poll = window.setInterval(foreground, pollMs);
  window.addEventListener("online", notify);
  document.addEventListener("visibilitychange", foreground);
  const channel = getSupabaseBrowserClient()
    .channel(`room:${roomId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "rooms", filter: `id=eq.${roomId}` }, notify)
    .on("postgres_changes", { event: "*", schema: "public", table: "room_players", filter: `room_id=eq.${roomId}` }, notify)
    .on("postgres_changes", { event: "*", schema: "public", table: "blocks", filter: `room_id=eq.${roomId}` }, notify)
    .subscribe((status) => { if (status === "SUBSCRIBED") notify(); });
  cleanups.set(channel, () => { clearTimeout(timer); clearInterval(poll); window.removeEventListener("online", notify); document.removeEventListener("visibilitychange", foreground); });
  return channel;
}

export function subscribeToRoomPresence(roomId: string, userId: string, onSync: (onlineUserIds: string[]) => void): RealtimeChannel {
  const channel = getSupabaseBrowserClient().channel(`presence:${roomId}`, {
    config: { presence: { key: userId } },
  });
  channel
    .on("presence", { event: "sync" }, () => {
      const presence = channel.presenceState<{ userId: string }>();
      const onlineUserIds = Object.values(presence).flat().map((entry) => entry.userId).filter(Boolean);
      onSync([...new Set(onlineUserIds)]);
    })
    .subscribe(async (status) => {
      if (status === "SUBSCRIBED") await channel.track({ userId, onlineAt: new Date().toISOString() });
    });
  return channel;
}

export async function leaveLiveRoomChannel(channel: RealtimeChannel) {
  cleanups.get(channel)?.();
  cleanups.delete(channel);
  await getSupabaseBrowserClient().removeChannel(channel);
}

export async function setLiveRoomReady(roomId: string, ready: boolean) {
  const { error } = await getSupabaseBrowserClient().rpc("set_voice_bricks_ready", { candidate_room_id: roomId, ready });
  if (error) throw new Error(error.message);
  if (ready) playPartyCue("join");
}

export async function startLiveRoom(roomId: string) {
  const { error } = await getSupabaseBrowserClient().rpc("start_voice_bricks_room", { candidate_room_id: roomId });
  if (error) throw new Error(error.message);
  playPartyCue("start");
}

export async function getLiveGameSnapshot(roomId: string): Promise<RoomSnapshot> {
  return getLiveRoomSnapshot(roomId);
}

export async function submitLiveBlock(roomId: string, text: string, duration: number, round: number) {
  const supabase = getSupabaseBrowserClient();
  const { data: blockId, error } = await supabase.rpc("submit_voice_brick", {
    candidate_room_id: roomId,
    submitted_text: text,
    submitted_duration: duration,
    expected_round: round,
  });
  if (error) throw new Error(error.message);
  if (!blockId) return { blockId: "", previewReady: false };
  playPartyCue("submit");
  void requestBlockPreview(String(blockId));
  return { blockId: String(blockId), previewReady: false };
}

export async function skipLiveTurn(roomId: string) {
  const { error } = await getSupabaseBrowserClient().rpc("skip_voice_bricks_turn", { candidate_room_id: roomId });
  if (error) throw new Error(error.message);
}

export async function completeLiveRoom(roomId: string) {
  const { error } = await getSupabaseBrowserClient().rpc("complete_voice_bricks_room", { candidate_room_id: roomId });
  if (error) throw new Error(error.message);
}

async function requestBlockPreview(blockId: string) {
  const { data: sessionData } = await getSupabaseBrowserClient().auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) return false;
  try {
    const response = await fetch("/api/tts/block", { signal: AbortSignal.timeout(55000), method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` }, body: JSON.stringify({ blockId }) });
    return response.ok;
  } catch {
    return false;
  }
}

export async function reorderLiveBlocks(roomId: string, blockIds: string[]) {
  const { error } = await getSupabaseBrowserClient().rpc("reorder_voice_bricks", {
    candidate_room_id: roomId,
    ordered_block_ids: blockIds,
  });
  if (error) throw new Error(error.message);
  playPartyCue("snap");
}

export async function finalEditLiveBlock(roomId: string, blockId: string, text: string, duration: number) {
  const { error } = await getSupabaseBrowserClient().rpc("final_edit_voice_brick", {
    candidate_room_id: roomId,
    candidate_block_id: blockId,
    edited_text: text,
    edited_duration: duration,
  });
  if (error) throw new Error(error.message);
  void requestBlockPreview(blockId);
}

export async function finishLiveAssembly(roomId: string) {
  const { error } = await getSupabaseBrowserClient().rpc("finish_voice_bricks_assembly", {
    candidate_room_id: roomId,
  });
  if (error) throw new Error(error.message);
}

export async function leaveLiveRoom(roomId: string) {
  const { data, error } = await getSupabaseBrowserClient().rpc("leave_voice_bricks_room", {
    candidate_room_id: roomId,
  });
  if (error) throw new Error(error.message);
  return Boolean(data);
}

export async function requestFinalRender(roomId: string) {
  const { data } = await getSupabaseBrowserClient().auth.getSession();
  const accessToken = data.session?.access_token;
  if (!accessToken) throw new Error("玩家身份已失效，请重新进入房间");
  const response = await fetch("/api/tts/final", {
    signal: AbortSignal.timeout(60000),
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ roomId }),
  });
  const result = await response.json() as { audioUrl?: string; error?: string };
  if (!response.ok || !result.audioUrl) throw new Error(result.error || "最终声音生成失败");
  return result.audioUrl;
}
