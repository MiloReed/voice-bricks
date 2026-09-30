"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { getLiveRoomSnapshot, subscribeToLiveRoom, leaveLiveRoomChannel } from "@/lib/supabase/room-service";
import type { RoomSnapshot } from "@/lib/supabase/types";

export function RematchLink({ roomId }: { roomId: string }) {
  const [snapshot, setSnapshot] = useState<RoomSnapshot | null>(null);
  useEffect(() => {
    if (roomId === "demo" || !isSupabaseConfigured) return;
    let cancelled = false;
    let channel: ReturnType<typeof subscribeToLiveRoom> | undefined;
    const refresh = async () => { try { const data = await getLiveRoomSnapshot(roomId); if (!cancelled) setSnapshot(data); } catch { /* Public visitors are not room members. */ } };
    void getSupabaseBrowserClient().auth.getSession().then(({ data }) => {
      if (cancelled || !data.session) return;
      void refresh();
      channel = subscribeToLiveRoom(roomId, () => void refresh());
    });
    return () => { cancelled = true; if (channel) void leaveLiveRoomChannel(channel); };
  }, [roomId]);
  if (!snapshot) return null;
  return <Link className="writing-hint" href={snapshot.room.next_room_id ? `/room/${snapshot.room.next_room_id}?live=1` : `/room/${roomId}/reveal?live=1`}>{snapshot.room.next_room_id ? "朋友已开好下一局，点这里归队 →" : "回到本局 · 原班人马再来一次 →"}</Link>;
}
