import type { Metadata } from "next";
import { RevealScreen } from "@/features/reveal/reveal-screen";

export const metadata: Metadata = { title: "最终揭晓" };

export default async function RevealPage({ params }: { params: Promise<{ "room-id": string }> }) {
  const { "room-id": roomId } = await params;
  return <RevealScreen roomId={roomId} />;
}
