import type { Metadata } from "next";
import { JoinRoom } from "@/features/room/join-room";

export const metadata: Metadata = { title: "加入声音积木房间" };

export default async function JoinPage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const { code = "" } = await searchParams;
  return <JoinRoom initialCode={code} />;
}
