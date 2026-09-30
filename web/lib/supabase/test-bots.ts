import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { RoomSnapshot } from "./types";
import { estimateDuration } from "@/lib/audio/speech";
import { demoReply } from "@/lib/game/party-content";

const clients = new Map<number, SupabaseClient>();
const names = ["机器人·接梗鹅", "机器人·脑洞猫", "机器人·吐槽熊", "机器人·收尾鸭"];
const presenceRooms = new Map<number, string>();

export function disconnectTestBotPresence() {
  presenceRooms.clear();
  for (const bot of clients.values()) void bot.removeAllChannels();
}

function client(index: number) {
  if (process.env.NODE_ENV !== "development") throw new Error("机器人仅限本地开发测试");
  let bot = clients.get(index);
  if (!bot) {
    bot = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
      auth: { storageKey: `voice-bricks-test-bot-${index}`, detectSessionInUrl: false },
      global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(15000) }) },
    });
    clients.set(index, bot);
  }
  return bot;
}

async function rpc(bot: SupabaseClient, name: string, args: Record<string, unknown>) {
  const { data, error } = await bot.rpc(name, args);
  if (error) throw new Error(error.message);
  return data;
}

export async function addTestBots(snapshot: RoomSnapshot) {
  if (snapshot.currentUserId !== snapshot.room.host_user_id || snapshot.room.status !== "lobby") throw new Error("只有房主能在等待室添加机器人");
  for (let index = 0; index < snapshot.room.max_players - 1; index++) {
    const bot = client(index);
    let { data: { session } } = await bot.auth.getSession();
    if (!session) {
      const result = await bot.auth.signInAnonymously();
      if (result.error) throw new Error(`机器人登录失败：${result.error.message}`);
      session = result.data.session;
    }
    if (!session) throw new Error("机器人身份创建失败");
    const latest = await import("./room-service").then((service) => service.getLiveRoomSnapshot(snapshot.room.id));
    if (latest.players.length >= latest.room.max_players) break;
    await rpc(bot, "join_voice_bricks_room", { requested_code: snapshot.room.code, player_name: names[index] });
    localStorage.setItem(`voice-bricks-test-room-${index}`, snapshot.room.id);
    await rpc(bot, "set_voice_bricks_ready", { candidate_room_id: snapshot.room.id, ready: true });
  }
}

export async function tickTestBots(roomId: string) {
  for (let index = 0; index < names.length; index++) {
    const previousRoom = localStorage.getItem(`voice-bricks-test-room-${index}`);
    if (!previousRoom) continue;
    const bot = client(index);
    if (previousRoom !== roomId) {
      const previous = await rpc(bot, "voice_bricks_snapshot", { candidate_room_id: previousRoom }) as RoomSnapshot;
      if (previous.room.next_room_id !== roomId) continue;
      // Rematch copies the roster; only resume in the explicitly linked next room.
      localStorage.setItem(`voice-bricks-test-room-${index}`, roomId);
    }
    const snapshot = await rpc(bot, "voice_bricks_snapshot", { candidate_room_id: roomId }) as RoomSnapshot;
    const player = snapshot.players.find((entry) => entry.user_id === snapshot.currentUserId);
    if (!player) continue;
    if (presenceRooms.get(index) !== roomId) {
      await bot.removeAllChannels();
      const channel = bot.channel(`presence:${roomId}`, { config: { presence: { key: player.user_id } } });
      channel.subscribe(async (status) => { if (status === "SUBSCRIBED") await channel.track({ userId: player.user_id }); });
      presenceRooms.set(index, roomId);
    }
    if (snapshot.room.status === "lobby" && !player.is_ready) {
      await rpc(bot, "set_voice_bricks_ready", { candidate_room_id: roomId, ready: true });
    }
    if (snapshot.room.status === "playing" && !player.has_submitted && (snapshot.room.mode === "chaos" || player.seat_index === snapshot.room.current_player_index)) {
      const text = demoReply(snapshot.room.theme, index + snapshot.room.current_round);
      await rpc(bot, "submit_voice_brick", { candidate_room_id: roomId, submitted_text: text, submitted_duration: estimateDuration(text), expected_round: snapshot.room.current_round });
    }
    if ((snapshot.room.status === "revealed" || snapshot.room.status === "completed") && !player.audio_ready) {
      await rpc(bot, "ready_voice_bricks_audio", { candidate_room_id: roomId });
    }
  }
}
