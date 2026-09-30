import type { Metadata } from "next";
import { Lobby } from "@/features/room/lobby";

export const metadata: Metadata = { title: "等待朋友加入" };

export default async function LobbyPage({ params }: { params: Promise<{ "room-id": string }> }) {
  const { "room-id": roomId } = await params;
  return <Lobby roomId={roomId} />;
}
