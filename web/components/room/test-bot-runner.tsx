"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { disconnectTestBotPresence, tickTestBots } from "@/lib/supabase/test-bots";

export function TestBotRunner() {
  const pathname = usePathname();
  const [error, setError] = useState("");
  const roomId = pathname.match(/^\/room\/([0-9a-f-]{36})(?:\/|$)/)?.[1];
  useEffect(() => {
    if (process.env.NODE_ENV !== "development" || !roomId) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      try { await tickTestBots(roomId); if (!stopped) setError(""); }
      catch (cause) { if (!stopped) setError(cause instanceof Error ? cause.message : "连接失败"); }
      if (!stopped) timer = setTimeout(tick, 2500);
    };
    timer = setTimeout(tick, 1000);
    return () => { stopped = true; clearTimeout(timer); disconnectTestBotPresence(); };
  }, [roomId]);
  return error ? <div role="status" style={{ position: "fixed", bottom: 12, left: 12, zIndex: 100, background: "#fff8e7", padding: 12, maxWidth: 340 }}>测试机器人暂时掉线，正在重试：{error}</div> : null;
}
