"use client";

import { formatClock } from "../../lib/format";

/** The live match clock. Turns amber under a minute, red under ten seconds. */
export function BattleTimer({ remainingMs }: { remainingMs: number }) {
  const urgent = remainingMs < 10_000;
  const low = remainingMs < 60_000;
  const color = urgent
    ? "var(--color-bad)"
    : low
      ? "var(--color-warn)"
      : "var(--color-ink)";

  return (
    <div className="flex flex-col items-end">
      <span className="label">Time left</span>
      <span
        className={`font-mono text-2xl font-semibold tabular-nums ${
          urgent ? "pulse-soft" : ""
        }`}
        style={{ color }}
      >
        {formatClock(remainingMs)}
      </span>
    </div>
  );
}
