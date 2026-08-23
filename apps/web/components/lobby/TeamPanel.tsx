"use client";

import type { PlayerView, Side } from "@repo/protocol";
import { Avatar } from "../avatar/Avatar";

interface Seat {
  slot: number;
  player: PlayerView | null;
}

/** One team's column of seats. Empty seats on my available slots are clickable. */
export function TeamPanel({
  side,
  players,
  teamSize,
  myUserId,
  onTake,
  disabled,
}: {
  side: Side;
  players: PlayerView[];
  teamSize: number;
  myUserId: string | null;
  onTake: (slot: number) => void;
  disabled: boolean;
}) {
  const color = side === "A" ? "var(--color-side-a)" : "var(--color-side-b)";
  const seats: Seat[] = Array.from({ length: teamSize }, (_, slot) => ({
    slot,
    player: players.find((p) => p.side === side && p.slot === slot) ?? null,
  }));

  return (
    <div className="flex flex-1 flex-col gap-3">
      <div className="flex items-center gap-2">
        <span
          className="flex h-6 w-6 items-center justify-center rounded-md text-sm font-bold"
          style={{
            color,
            background: `color-mix(in srgb, ${color} 15%, transparent)`,
          }}
        >
          {side}
        </span>
        <span className="text-sm font-medium" style={{ color: "var(--color-ink-dim)" }}>
          Team {side}
        </span>
      </div>

      <div className="flex flex-col gap-2">
        {seats.map(({ slot, player }) => (
          <SeatRow
            key={slot}
            slot={slot}
            player={player}
            color={color}
            isMe={player?.userId === myUserId}
            onTake={() => onTake(slot)}
            disabled={disabled}
          />
        ))}
      </div>
    </div>
  );
}

function SeatRow({
  slot,
  player,
  color,
  isMe,
  onTake,
  disabled,
}: {
  slot: number;
  player: PlayerView | null;
  color: string;
  isMe: boolean;
  onTake: () => void;
  disabled: boolean;
}) {
  if (!player) {
    return (
      <button
        onClick={onTake}
        disabled={disabled}
        className="seat-empty flex h-14 items-center justify-center rounded-[10px] border border-dashed text-sm transition-all disabled:cursor-not-allowed disabled:opacity-40"
        style={
          {
            borderColor: "var(--color-line-strong)",
            color: "var(--color-ink-faint)",
            "--seat-color": color,
          } as React.CSSProperties
        }
      >
        + Take seat {slot + 1}
      </button>
    );
  }

  const offline = player.presence !== "ONLINE";

  return (
    <div
      className="flex h-14 items-center justify-between rounded-[10px] border px-3.5 transition-all"
      style={{
        borderColor: isMe
          ? `color-mix(in srgb, ${color} 55%, transparent)`
          : "var(--color-line)",
        background: isMe
          ? `color-mix(in srgb, ${color} 12%, var(--color-surface))`
          : "var(--color-surface-2)",
        boxShadow: isMe ? `0 8px 26px -14px ${color}` : undefined,
      }}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <Avatar
          avatarId={player.avatarId}
          color={player.avatarColor}
          size={32}
          rounded={7}
          ring={offline ? undefined : color}
        />
        <div className="flex flex-col min-w-0">
          <span className="truncate text-sm font-medium">
            {player.displayName}
            {isMe && (
              <span className="ml-1.5 text-xs" style={{ color: "var(--color-ink-faint)" }}>
                (you)
              </span>
            )}
          </span>
          <span className="flex items-center gap-1.5 text-xs" style={{ color: "var(--color-ink-faint)" }}>
            {player.isHost && <span>Host</span>}
            {offline && <span style={{ color: "var(--color-warn)" }}>reconnecting…</span>}
          </span>
        </div>
      </div>

      <span
        className="chip shrink-0"
        style={
          player.ready
            ? {
                color: "var(--color-good)",
                borderColor: "color-mix(in srgb, var(--color-good) 35%, transparent)",
                background: "color-mix(in srgb, var(--color-good) 10%, transparent)",
              }
            : undefined
        }
      >
        {player.ready ? "Ready" : "Not ready"}
      </span>
    </div>
  );
}
