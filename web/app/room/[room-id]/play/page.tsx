import type { Metadata } from "next";
import { PlayScreen } from "@/features/gameplay/play-screen";
import { LivePlayScreen } from "@/features/gameplay/live-play-screen";
import { SoloPlayScreen } from "@/features/gameplay/solo-play-screen";
import type { GameMode } from "@/types/game";

export const metadata: Metadata = { title: "创作声音积木" };

export default async function PlayPage({ params, searchParams }: { params: Promise<{ "room-id": string }>; searchParams: Promise<{ mode?: string | string[]; seat?: string | string[]; live?: string | string[] }> }) {
  const [routeParams, query] = await Promise.all([params, searchParams]);
  if (routeParams["room-id"] === "solo") return <SoloPlayScreen />;
  if (query.live === "1") return <LivePlayScreen roomId={routeParams["room-id"]} />;
  const mode: GameMode = query.mode === "chaos" ? "chaos" : "classic";
  const parsedSeat = Number(Array.isArray(query.seat) ? query.seat[0] : query.seat);
  const testSeat = Number.isInteger(parsedSeat) && parsedSeat >= 1 && parsedSeat <= 5 ? parsedSeat : 1;
  return <PlayScreen mode={mode} testSeat={testSeat} />;
}
