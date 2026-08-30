"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  BattleResultResponse,
  ProgressionAward,
  Side,
  StandingRow,
} from "@repo/protocol";
import { rankFor, nextRank, rankProgress } from "@repo/game";
import { Centered, Spinner } from "../atoms";
import { AppShell } from "../AppShell";
import { getBattleResult } from "../../lib/api";
import { SolutionsPanel } from "./SolutionsPanel";
import { BadgeRow } from "../ranking/Badges";
import { selectMe } from "../../lib/battleState";
import { titleCase } from "../../lib/format";
import { useProfile } from "../../lib/useProfile";
import type { BattleConnection } from "../../lib/useBattleConnection";
import type { Session } from "../../lib/session";

const REASON_LABEL: Record<string, string> = {
  ALL_PASSED: "All_passed",
  TIMEOUT: "Timeout",
  FORFEIT: "Forfeit",
};

/**
 * The post-battle debrief. Reads the finished snapshot immediately, then
 * fetches the durable REST result so the page is refresh-safe and shareable.
 *
 * Every figure shown is real: standings come from the server, and the rewards
 * panel renders the `awards` the server computed when the battle finished.
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
  // Refetch progression: the battle just changed it.
  const { profile } = useProfile(session);

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

  const myAward = state.awards.find((a) => a.userId === session.userId) ?? null;

  const outcome: "win" | "loss" | "draw" | "spectator" =
    winnerSide == null
      ? "draw"
      : mySide == null
        ? "spectator"
        : winnerSide === mySide
          ? "win"
          : "loss";

  if (!result && standings.length === 0) {
    return (
      <AppShell session={session}>
        <Centered>
          <Spinner />
        </Centered>
      </AppShell>
    );
  }

  const headline =
    winnerSide != null
      ? `${reason === "ALL_PASSED" ? "ALL_PASSED" : "TIMEOUT"} — Team ${winnerSide} wins`
      : "Battle drawn";

  const mine = standings.find((s) => s.side === mySide) ?? null;
  const slowest = Math.max(...standings.map((s) => s.bestPassed), 1);

  return (
    <AppShell session={session} profile={profile}>
      <div className="mx-auto w-full max-w-5xl px-5 py-6 sm:px-7">
        {/* Verdict banner */}
        <section
          className="panel panel-strong rise flex flex-wrap items-center gap-4 p-5"
          style={{
            borderColor:
              outcome === "win" ? "var(--color-primary)" : "var(--color-line-strong)",
          }}
        >
          <div className="min-w-0 flex-1">
            <p
              className="label flex items-center gap-2"
              style={{ color: "var(--color-accent)" }}
            >
              ⊘ Match_terminated // session_{snap.battleId.slice(-4)}
            </p>
            <h1
              className="mt-2 font-mono text-2xl font-bold uppercase leading-tight tracking-tight sm:text-3xl"
              style={{ color: "var(--color-primary)" }}
            >
              {headline}
            </h1>
            <div className="mt-3 flex flex-wrap gap-2">
              <span
                className="chip"
                style={{
                  background: "var(--color-primary)",
                  borderColor: "var(--color-primary)",
                  color: "#ffffff",
                }}
              >
                Outcome: {outcome === "win" ? "Victory" : outcome === "loss" ? "Defeat" : titleCase(outcome)}
              </span>
              <span className="chip">
                Reason: {reason ? REASON_LABEL[reason] ?? titleCase(reason) : "—"}
              </span>
            </div>
          </div>
        </section>

        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="flex flex-col gap-4">
            {/* Score analysis */}
            <section className="panel rise rise-1 p-5">
              <h2 className="flex items-center gap-2 font-mono text-sm font-bold uppercase tracking-wide">
                ◷ Score_analysis
              </h2>

              <div className="mt-5 flex flex-col gap-4">
                {standings
                  .slice()
                  .sort((a, b) => b.bestPassed - a.bestPassed)
                  .map((row) => {
                    const isMine = row.side === mySide;
                    const isWinner = row.side === winnerSide;
                    const color =
                      row.side === "A"
                        ? "var(--color-side-a)"
                        : "var(--color-side-b)";
                    const pct = Math.round((row.bestPassed / slowest) * 100);
                    return (
                      <div key={row.side}>
                        <div className="flex items-baseline justify-between">
                          <span className="font-mono text-[0.72rem] font-bold uppercase tracking-wider">
                            Team {row.side === "A" ? "Alpha" : "Bravo"}
                            {isMine && (
                              <span
                                className="ml-1.5"
                                style={{ color: "var(--color-ink-faint)" }}
                              >
                                (you)
                              </span>
                            )}
                          </span>
                          <span className="font-mono text-sm font-bold tabular-nums">
                            {row.bestPassed}/{row.total || "—"}
                          </span>
                        </div>
                        <div
                          className="mt-1.5 h-3 w-full"
                          style={{ background: "var(--color-surface-2)" }}
                        >
                          <div
                            className="h-full transition-all"
                            style={{
                              width: `${pct}%`,
                              background: isWinner
                                ? "var(--color-primary)"
                                : color,
                              opacity: isWinner ? 1 : 0.45,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
              </div>
            </section>

            {/* Test fidelity */}
            <section className="panel rise rise-2 p-5">
              <h2 className="flex items-center gap-2 font-mono text-sm font-bold uppercase tracking-wide">
                ▤ Test_case_fidelity
              </h2>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Metric
                  label="Passed"
                  value={mine ? String(mine.bestPassed) : "—"}
                  accent="var(--color-good)"
                />
                <Metric
                  label="Failed"
                  value={
                    mine ? String(Math.max(0, mine.total - mine.bestPassed)) : "—"
                  }
                  accent="var(--color-bad)"
                />
                <Metric
                  label="Total"
                  value={mine ? String(mine.total) : "—"}
                />
                <Metric
                  label="Fidelity"
                  value={
                    mine && mine.total > 0
                      ? `${Math.round((mine.bestPassed / mine.total) * 100)}%`
                      : "—"
                  }
                />
              </div>
            </section>

            {/* Everyone's code — withheld during the match, revealed here. */}
            <div className="rise rise-3">
              <SolutionsPanel
                battleId={snap.battleId}
                myUserId={session.userId}
                mySide={mySide}
              />
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                className="btn btn-primary"
                onClick={() => router.push("/")}
              >
                ⇤ Return_to_lobby
              </button>
            </div>
          </div>

          {/* Rewards */}
          <aside className="flex flex-col gap-4">
            <RewardsPanel
              award={myAward}
              seated={mySide != null}
              totalXp={profile?.xp ?? myAward?.totalXp ?? 0}
              wins={profile?.wins}
              losses={profile?.losses}
            />
          </aside>
        </div>
      </div>
    </AppShell>
  );
}

function Metric({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div
      className="border-l-2 px-3 py-2"
      style={{
        borderColor: accent ?? "var(--color-line-strong)",
        background: "var(--color-surface-3)",
      }}
    >
      <p className="label">{label}</p>
      <p
        className="mt-1 font-mono text-lg font-bold tabular-nums"
        style={{ color: accent ?? "var(--color-ink)" }}
      >
        {value}
      </p>
    </div>
  );
}

/**
 * Real progression, or an honest empty state.
 *
 * Awards arrive on the `battle:end` socket event, so a client that connects
 * AFTER the battle finished (a reload, or opening the shared result link) has
 * no award to show even though one was granted. That is why the empty state
 * branches on `seated`: a seated player is told their career totals below are
 * already up to date, and only a genuine spectator is told they earned
 * nothing. Showing "not seated on a team" to someone who just played — while
 * their own W/L sits right underneath — reads as a bug.
 */
function RewardsPanel({
  award,
  seated,
  totalXp,
  wins,
  losses,
}: {
  award: ProgressionAward | null;
  /** Did this player hold a seat? Distinguishes "no award" from "spectated". */
  seated: boolean;
  totalXp: number;
  wins?: number;
  losses?: number;
}) {
  const rank = rankFor(totalXp);
  const next = nextRank(totalXp);
  const progress = rankProgress(totalXp);

  return (
    <section className="panel rise rise-3 overflow-hidden">
      <div
        className="px-4 py-2.5"
        style={{
          background: "var(--color-primary)",
          color: "#ffffff",
        }}
      >
        <span className="label" style={{ color: "#ffffff" }}>
          Rewards_disbursed
        </span>
      </div>

      <div className="flex flex-col gap-3 p-4">
        {award ? (
          <>
            <Row
              label="Rank_points"
              value={`+${award.xp} XP`}
              accent="var(--color-accent)"
            />
            {award.multiplier > 1 && (
              <Row
                label="Streak_bonus"
                value={`×${award.multiplier}`}
                accent="var(--color-amber-deep)"
              />
            )}
            {award.difficultyWeight > 1 && (
              <Row
                label="Difficulty"
                value={`×${award.difficultyWeight}`}
                accent="var(--color-side-b)"
              />
            )}
            {/* Only shown when it actually bit, so a normal session never sees
                a confusing "×1" line. */}
            {award.taper < 1 && (
              <Row
                label="Daily_taper"
                value={`×${award.taper}`}
                accent="var(--color-ink-faint)"
              />
            )}
            {award.perfect && (
              <Row
                label="Flawless"
                value="+75 XP"
                accent="var(--color-good)"
              />
            )}
            <Row label="Win_streak" value={String(award.newStreak)} />

            {/* The rating line is omitted entirely when the battle was
                unranked, rather than shown as a misleading zero. */}
            {award.rating && (
              <div
                className="mt-1 border-t pt-3"
                style={{ borderColor: "var(--color-line)" }}
              >
                <Row
                  label="Rating"
                  value={`${award.rating.after} (${
                    award.rating.delta >= 0 ? "+" : ""
                  }${award.rating.delta})`}
                  accent={
                    award.rating.delta >= 0
                      ? "var(--color-good)"
                      : "var(--color-bad)"
                  }
                  bold
                />
                {award.rating.tierAfter &&
                  award.rating.tierAfter !== award.rating.tierBefore && (
                    <div className="mt-2">
                      <Row
                        label={
                          award.rating.delta >= 0 ? "Promoted" : "Demoted"
                        }
                        value={award.rating.tierAfter}
                        accent="var(--color-accent)"
                        bold
                      />
                    </div>
                  )}
              </div>
            )}

            {award.newBadges.length > 0 && (
              <div
                className="mt-1 border-t pt-3"
                style={{ borderColor: "var(--color-line)" }}
              >
                <p className="label">
                  {award.newBadges.length === 1
                    ? "Badge unlocked"
                    : "Badges unlocked"}
                </p>
                <div className="mt-2">
                  <BadgeRow badges={award.newBadges} size="sm" />
                </div>
              </div>
            )}
          </>
        ) : (
          <p
            className="font-mono text-[0.75rem] leading-relaxed"
            style={{ color: "var(--color-ink-faint)" }}
          >
            {seated
              ? "The live award breakdown is only sent as the battle ends. Your career totals below already include this battle."
              : "No progression recorded for this battle — you were not seated on a team."}
          </p>
        )}

        <div
          className="mt-1 border-t pt-3"
          style={{ borderColor: "var(--color-line)" }}
        >
          <Row label="Current_rank" value={rank.label} bold />
          {wins != null && losses != null && (
            <div className="mt-2">
              <Row label="Record" value={`${wins}W / ${losses}L`} />
            </div>
          )}

          <p className="label mt-3">
            {next ? `Next: ${next.label}` : "Max rank reached"}
          </p>
          <div
            className="mt-1.5 h-2 w-full"
            style={{ background: "var(--color-surface-2)" }}
          >
            <div
              className="h-full transition-all"
              style={{
                width: `${Math.round(progress * 100)}%`,
                background: "var(--color-accent)",
              }}
            />
          </div>
          <p className="label mt-1.5">{totalXp} XP total</p>
        </div>
      </div>
    </section>
  );
}

function Row({
  label,
  value,
  accent,
  bold,
}: {
  label: string;
  value: string;
  accent?: string;
  bold?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="label">{label}</span>
      <span
        className="font-mono text-[0.85rem] tabular-nums"
        style={{
          color: accent ?? "var(--color-ink)",
          fontWeight: bold ? 700 : 600,
        }}
      >
        {value}
      </span>
    </div>
  );
}
