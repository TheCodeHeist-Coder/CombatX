"use client";

import type { Side } from "@repo/protocol";

/**
 * A side's best passed-count as a progress bar. This is the ONLY signal you get
 * about the opponent — never their code, just how many tests they've cleared.
 */
export function ScoreBar({
  side,
  label,
  bestPassed,
  total,
  isMine,
}: {
  side: Side;
  label: string;
  bestPassed: number;
  total: number;
  isMine: boolean;
}) {
  const color = side === "A" ? "var(--color-side-a)" : "var(--color-side-b)";
  const pct = total > 0 ? Math.round((bestPassed / total) * 100) : 0;
  const complete = total > 0 && bestPassed === total;

  return (
    <div
      className="border p-3"
      style={{
        borderColor: isMine ? color : "var(--color-line)",
        background: isMine ? "var(--color-blush)" : "var(--color-surface)",
      }}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span
          className="truncate font-mono text-[0.72rem] font-bold uppercase tracking-wider"
          style={{ color: isMine ? color : "var(--color-ink-dim)" }}
        >
          {label}
        </span>
        <span
          className="shrink-0 font-mono text-[0.9rem] font-bold tabular-nums"
          style={{
            color: complete ? "var(--color-good)" : "var(--color-ink)",
          }}
        >
          {bestPassed}/{total || "—"}
        </span>
      </div>

      <div
        className="mt-2.5 h-2 w-full overflow-hidden"
        style={{ background: "var(--color-surface-2)" }}
      >
        <div
          className="h-full transition-[width] duration-500 ease-out"
          style={{
            width: `${pct}%`,
            background: complete ? "var(--color-good)" : color,
          }}
        />
      </div>

      {isMine && <p className="label mt-1.5">Your squad</p>}
    </div>
  );
}
