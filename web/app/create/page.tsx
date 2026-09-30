import type { Metadata } from "next";
import { CreateRoom } from "@/features/room/create-room";

export const metadata: Metadata = { title: "创建游戏" };

export default async function CreatePage({ searchParams }: { searchParams: Promise<{ solo?: string }> }) {
  const query = await searchParams;
  return <CreateRoom solo={query.solo === "1"} />;
}
