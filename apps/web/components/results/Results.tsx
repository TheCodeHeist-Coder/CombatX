"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { BattleResultResponse, Side, StandingRow } from "@repo/protocol";
import { Shell, Centered, Spinner, SideBadge } from "../atoms";
import { TopBar } from "../TopBar";
import { getBattleResult } from "../../lib/api";
import { selectMe } from "../../lib/battleState";
import { titleCase } from "../../lib/format";
import type { BattleConnection } from "../../lib/useBattleConnection";
import type { Session } from "../../lib/session";

const REASON_LABEL: Record<string, string> = {
  ALL_PASSED: "All tests passed",
  TIMEOUT: "Time expired",
  FORFEIT: "Opponent forfeited",
};

/**
 * The post-battle screen. Reads the finished snapshot immediately, then
 * fetches the durable REST result for authoritative standings so the page is
 * refresh-safe and shareable.
 */
export function Results({
  conn,
  session,
}: {
  conn: BattleConnection;
  session: Session;
}) {
  const { state } = conn;
  const snap = state.snapshot!;
  const me = selectMe(state);
  const mySide: Side | null = me?.side ?? null;
  const router = useRouter();

  const [result, setResult] = useState<BattleResultResponse | null>(null);

  useEffect(() => {
    let active = true;
    getBattleResult(snap.battleId)
      .then((r) => active && setResult(r))
      .catch(() => {
        /* fall back to snapshot below */
      });
    return () => {
      active = false;
    };
  }, [snap.battleId]);

  const winnerSide = result?.winnerSide ?? snap.winnerSide;
  const reason = result?.reason ?? snap.finishReason;
  const standings: StandingRow[] =
    result?.standings ??
    snap.progress.map((p) => ({
      side: p.side,
      bestPassed: p.bestPassed,
      total: p.total,
      decidingSubmissionId: null,
    }));

  const outcome: "win" | "loss" | "draw" | "spectator" =
    winnerSide == null
      ? "draw"
      : mySide == null
        ? "spectator"
        : winnerSide === mySide
          ? "win"
          : "loss";

  const headline =
    outcome === "win"
      ? "Victory"
      : outcome === "loss"
        ? "Defeated"
        : outcome === "draw"
          ? "Draw"
          : "Battle over";

  const headlineColor =
    outcome === "win"
      ? "var(--color-good)"
      : outcome === "loss"
        ? "var(--color-bad)"
        : "var(--color-ink)";

  if (!result && standings.length === 0) {
    return (
      <Shell>
        <TopBar session={session} />
        <Centered>
          <Spinner />
        </Centered>
      </Shell>
    );
  }

  return (
    <Shell>
      <TopBar session={session} />

      <div className="flex flex-1 flex-col items-center justify-center gap-8">
        <div className="rise flex flex-col items-center gap-2 text-center">
          <span className="label">
            {reason ? REASON_LABEL[reason] ?? titleCase(reason) : "Finished"}
          </span>
          <h1
            className="text-5xl font-semibold tracking-tight"
            style={{ letterSpacing: "-0.03em", color: headlineColor }}
          >
            {headline}
          </h1>
          {winnerSide && (
            <p
              className="flex items-center gap-2 text-sm"
              style={{ color: "var(--color-ink-dim)" }}
            >
              Team <SideBadge side={winnerSide} /> took the win.
            </p>
          )}
        </div>

        {/* Standings */}
        <div
          className="panel rise w-full max-w-xl overflow-hidden"
          style={{ animationDelay: "0.08s" }}
        >
          {standings
            .slice()
            .sort((a, b) => b.bestPassed - a.bestPassed)
            .map((row, idx) => {
              const isWinner = row.side === winnerSide;
              const isMine = row.side === mySide;
              const color =
                row.side === "A"
                  ? "var(--color-side-a)"
                  : "var(--color-side-b)";
              return (
                <div
                  key={row.side}
                  className="flex items-center justify-between px-5 py-4"
                  style={{
                    borderTop:
                      idx === 0 ? "none" : "1px solid var(--color-line)",
                    background: isWinner
                      ? "color-mix(in srgb, var(--color-good) 6%, transparent)"
                      : "transparent",
                  }}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold"
                      style={{
                        color,
                        background: `color-mix(in srgb, ${color} 15%, transparent)`,
                      }}
                    >
                      {row.side}
                    </span>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">
                        Team {row.side}
                        {isMine && (
                          <span
                            className="ml-1.5 text-xs"
                            style={{ color: "var(--color-ink-faint)" }}
                          >
                            (you)
                          </span>
                        )}
                      </span>
                      {isWinner && (
                        <span
                          className="text-xs"
                          style={{ color: "var(--color-good)" }}
                        >
                          Winner
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="font-mono text-lg tabular-nums">
                    {row.bestPassed}
                    <span style={{ color: "var(--color-ink-faint)" }}>
                      /{row.total}
                    </span>
                  </span>
                </div>
              );
            })}
        </div>

        <div className="flex gap-3">
          <button className="btn btn-primary" onClick={() => router.push("/")}>
            Play again
          </button>
        </div>
      </div>
    </Shell>
  );
}
