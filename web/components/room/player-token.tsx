import { Check, Crown, Plus } from "@phosphor-icons/react";
import type { Player } from "@/types/game";

export function PlayerToken({ player, empty = false }: { player?: Player; empty?: boolean }) {
  if (empty || !player) {
    return (
      <div className="player-token player-token-empty">
        <span className="token-brick"><Plus weight="bold" /></span>
        <strong>空位</strong>
        <small>分享给朋友</small>
      </div>
    );
  }

  return (
    <div className="player-token" data-color={player.color} data-offline={player.online === false || undefined}>
      <span className="token-brick"><i /><i /><i /></span>
      <strong>{player.name}{player.host && <Crown weight="fill" />}</strong>
      <small>{player.online === false ? "暂时离线" : player.ready ? <><Check weight="bold" />准备好了</> : "正在加入"}</small>
    </div>
  );
}
