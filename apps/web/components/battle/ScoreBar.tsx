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
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-2">
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ background: color }}
          />
          <span className="font-medium">{label}</span>
          {isMine && (
            <span className="text-xs" style={{ color: "var(--color-ink-faint)" }}>
              you
            </span>
          )}
        </span>
        <span
          className="font-mono text-sm tabular-nums"
          style={{ color: complete ? "var(--color-good)" : "var(--color-ink-dim)" }}
        >
          {bestPassed}/{total || "—"}
        </span>
      </div>
      <div
        className="h-2 w-full overflow-hidden rounded-full"
        style={{ background: "var(--color-surface-3)" }}
      >
        <div
          className="h-full rounded-full transition-[width] duration-500 ease-out"
          style={{
            width: `${pct}%`,
            background: complete ? "var(--color-good)" : color,
          }}
        />
      </div>
    </div>
  );
}
