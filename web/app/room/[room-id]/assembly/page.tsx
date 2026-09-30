import type { Metadata } from "next";
import { AssemblyScreen } from "@/features/assembly/assembly-screen";
import { LiveAssemblyScreen } from "@/features/assembly/live-assembly-screen";

export const metadata: Metadata = { title: "拼装作品" };

export default async function AssemblyPage({ params, searchParams }: { params: Promise<{ "room-id": string }>; searchParams: Promise<{ live?: string }> }) {
  const [routeParams, query] = await Promise.all([params, searchParams]);
  if (routeParams["room-id"] === "solo") return <AssemblyScreen roomId="solo" />;
  if (query.live === "1") return <LiveAssemblyScreen roomId={routeParams["room-id"]} />;
  return <AssemblyScreen roomId={routeParams["room-id"]} isLive={query.live === "1"} />;
}
