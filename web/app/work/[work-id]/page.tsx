import type { Metadata } from "next";
import { WorkScreen } from "@/features/share/work-screen";

export const metadata: Metadata = { title: "作品分享" };

export default async function WorkPage({ params }: { params: Promise<{ "work-id": string }> }) {
  const { "work-id": workId } = await params;
  return <WorkScreen workId={workId} />;
}
