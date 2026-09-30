"use client";

import { ArrowRight, Hash, UserCircle } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AppShell, PageIntro } from "@/components/ui/app-shell";
import { Button } from "@/components/ui/buttons";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { joinLiveRoom } from "@/lib/supabase/room-service";
import { roomErrorMessage } from "@/lib/supabase/errors";

export function JoinRoom({ initialCode }: { initialCode: string }) {
  const router = useRouter();
  const [code, setCode] = useState(initialCode.toUpperCase().slice(0, 4));
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const join = async () => {
    if (busy) return;
    if (!isSupabaseConfigured) {
      router.push("/room/demo");
      return;
    }
    if (code.length !== 4 || !name.trim()) {
      setError("请填写 4 位房间码和你的名字");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const room = await joinLiveRoom(code, name.trim());
      router.push(`/room/${room.joined_room_id}`);
    } catch (joinError) {
      setError(roomErrorMessage(joinError));
      setBusy(false);
    }
  };

  return <AppShell backHref="/"><div className="join-layout">
    <PageIntro eyebrow="Join the party" title={<>朋友到齐，<br />脑洞开席。</>} description="输入朋友发来的房间码，再起个大家认得出的名字。你的接力位置会自动安排好。" />
    <form className="join-ticket" onSubmit={(event) => { event.preventDefault(); void join(); }}>
      <label><span><Hash weight="bold" />房间码</span><input value={code} onChange={(event) => setCode(event.target.value.replace(/[^a-z0-9]/gi, "").toUpperCase().slice(0, 4))} maxLength={4} autoCapitalize="characters" inputMode="text" placeholder="B4K7" aria-label="四位房间码" /></label>
      <label><span><UserCircle weight="bold" />你的名字</span><input className="text-input" value={name} onChange={(event) => setName(event.target.value)} maxLength={16} placeholder="怎么称呼你？" aria-label="你的名字" /></label>
      {error && <p className="form-error" role="alert">{error}</p>}
      {!isSupabaseConfigured && <p className="join-demo-note">当前没有 Supabase 配置，点击后将进入本地完整试玩。</p>}
      <Button type="submit" disabled={busy} icon={<ArrowRight weight="bold" />}>{busy ? "正在占座…" : isSupabaseConfigured ? "加入房间" : "进入本地试玩"}</Button>
    </form>
  </div></AppShell>;
}
