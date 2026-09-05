"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  BattleResultResponse,
  ProgressionAward,
  PublicProblem,
  Side,
  StandingRow,
} from "@repo/protocol";
import { rankFor, nextRank, rankProgress } from "@repo/game";
import { Centered, Spinner } from "../atoms";
import { AppShell } from "../AppShell";
import { getBattleResult, getBattleSolutions } from "../../lib/api";
import { SolutionsPanel } from "./SolutionsPanel";
import { Markdown } from "../battle/Markdown";
import { Samples } from "../battle/Samples";
import { BadgeRow } from "../ranking/Badges";
import { selectMe } from "../../lib/battleState";
import { titleCase } from "../../lib/format";
import { useProfile } from "../../lib/useProfile";
import type { BattleConnection } from "../../lib/useBattleConnection";
import type { Session } from "../../lib/session";

/**
 * Why the battle ended, in words.
 *
 * Written the way a person would say it. The enum names are a wire format,
 * not copy — "ALL_PASSED" on screen reads as a leaked constant, and the
 * underscore-shouting house style made every heading look like a log line
 * rather than a result someone just earned.
 */
const REASON_LABEL: Record<string, string> = {
  ALL_PASSED: "Solved every test",
  TIMEOUT: "Time ran out",
  FORFEIT: "Opponent forfeited",
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
  battleId,
}: {
  conn: BattleConnection;
  session: Session;
  /**
   * The battle being reviewed.
   *
   * Passed in rather than read off the snapshot, because a debrief opened
   * from a shared link or a reload has NO snapshot: the ws-server evicts a
   * finished battle's room and refuses to serve it, so the socket can never
   * attach. Before this the page sat on "Reconnecting…" forever.
   */
  battleId: string;
}) {
  const { state } = conn;
  const snap = state.snapshot;
  const me = selectMe(state);

  /*
   * Which side the viewer fought on.
   *
   * The snapshot is the fast path, but it is absent on a reload or a shared
   * link — and then `selectMe` returns nothing, so a player who had just won
   * was told "you were not seated on a team" with their own winning code
   * directly beside it.
   *
   * The solutions are the durable answer: a submission is proof of having
   * played, and it carries the side. Fetched here rather than lifted out of
   * SolutionsPanel because the verdict, the score order and the rewards copy
   * all depend on it.
   */
  const [restSide, setRestSide] = useState<Side | null>(null);
  /** side -> the people who played it, for naming teams by their players. */
  const [restNames, setRestNames] = useState<Record<string, string[]>>({});

  useEffect(() => {
    let alive = true;
    getBattleSolutions(battleId)
      .then((r) => {
        if (!alive) return;
        const mine = r.entries.find((e) => e.userId === session.userId);
        if (mine) setRestSide(mine.side);
        const bySide: Record<string, string[]> = {};
        for (const e of r.entries) {
          (bySide[e.side] ??= []).push(e.username);
        }
        setRestNames(bySide);
      })
      .catch(() => {
        /* spectator, or not readable — stays empty, which is the truth. */
      });
    return () => {
      alive = false;
    };
  }, [battleId, session.userId]);

  const mySide: Side | null = me?.side ?? restSide;

  /*
   * What to call a side.
   *
   * "Team Bravo" is arena furniture; in a random 1v1 the only meaningful
   * label is the person you played. Prefers the live roster, falls back to
   * the names on the submissions, and only then to the colour-team name —
   * which is all that is left for a battle nobody submitted in.
   */
  const sideLabel = (side: Side): string => {
    const live = (snap?.players ?? [])
      .filter((p) => p.side === side)
      .map((p) => p.username);
    if (live.length > 0) return live.join(", ");

    /*
     * The roster before the submissions.
     *
     * A player who never submitted still played — and reading names off the
     * solutions alone left their side labelled "Team Alpha" while the other
     * side showed a username, which looked like a bug rather than a format.
     */
    const roster = result?.rosters.find((r) => r.side === side)?.usernames ?? [];
    if (roster.length > 0) return roster.join(", ");

    const submitted = restNames[side] ?? [];
    if (submitted.length > 0) return submitted.join(", ");

    // Nothing was ever persisted for this side — a battle abandoned in the
    // lobby. The colour-team name is all that is left.
    return `Team ${side === "A" ? "Alpha" : "Bravo"}`;
  };
  const router = useRouter();

  const [result, setResult] = useState<BattleResultResponse | null>(null);
  // Refetch progression: the battle just changed it.
  const { profile } = useProfile(session);

  useEffect(() => {
    let active = true;
    getBattleResult(battleId)
      .then((r) => active && setResult(r))
      .catch(() => {
        /* fall back to snapshot below */
      });
    return () => {
      active = false;
    };
  }, [battleId]);

  const winnerSide = result?.winnerSide ?? snap?.winnerSide ?? null;
  const reason = result?.reason ?? snap?.finishReason ?? null;
  const standings: StandingRow[] =
    result?.standings ??
    (snap?.progress ?? []).map((p) => ({
      side: p.side,
      bestPassed: p.bestPassed,
      total: p.total,
      decidingSubmissionId: null,
    }));

  const myAward = state.awards.find((a) => a.userId === session.userId) ?? null;

  /*
   * The problem, kept from the live battle.
   *
   * Safe to show now and only now: during the match the statement is on
   * screen anyway, and afterwards there is nothing left to protect. A client
   * that reloaded onto this page has no snapshot problem, so every use is
   * guarded — the debrief degrades to the numbers rather than breaking.
   */
  const problem = state.problem ?? result?.problem ?? null;

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

  /*
   * The headline is about the PLAYER, not the match.
   *
   * "ALL_PASSED — TEAM B WINS" made someone read a constant, work out which
   * side they were, and only then learn whether they won. The one thing they
   * came to find out now leads.
   */
  const headline =
    outcome === "win"
      ? "You won"
      : outcome === "loss"
        ? "You lost"
        : outcome === "draw"
          ? "Drawn"
          : winnerSide != null
            ? `${sideLabel(winnerSide)} won`
            : "Battle drawn";

  const mine = standings.find((s) => s.side === mySide) ?? null;
  const slowest = Math.max(...standings.map((s) => s.bestPassed), 1);

  return (
    <AppShell session={session} profile={profile}>
      {/*
        Full width, like a judge page.

        The old 5xl column left the problem statement nowhere to live, so the
        debrief could only show numbers. Reading the question you just solved
        — with its constraints and sample cases — beside your own code is the
        whole point of a post-match review, and that needs the room.
      */}
      <div className="mx-auto w-full max-w-[110rem] px-4 py-6 sm:px-6">
        {/*
          The verdict.

          One line, in the display face rather than uppercase monospace. The
          previous banner shouted a wire constant in orange caps and buried
          the only thing the player wanted to know.
        */}
        <section
          className="panel flex flex-wrap items-center justify-between gap-x-8 gap-y-4 px-6 py-5"
          style={{
            borderColor:
              outcome === "win"
                ? "var(--color-good)"
                : outcome === "loss"
                  ? "var(--color-line-strong)"
                  : "var(--color-line-strong)",
            background:
              outcome === "win"
                ? "color-mix(in srgb, var(--color-good) 7%, var(--color-surface))"
                : undefined,
          }}
        >
          <div className="flex min-w-0 items-center gap-4">
            <VerdictMark outcome={outcome} />
            <div className="min-w-0">
              <h1 className="text-[1.9rem] font-bold leading-none sm:text-[2.2rem]">
                {headline}
              </h1>
              <p
                className="mt-1.5 font-mono text-[0.76rem]"
                style={{ color: "var(--color-ink-dim)" }}
              >
                {reason ? REASON_LABEL[reason] ?? titleCase(reason) : "Match over"}
                {problem && ` · ${problem.title}`}
              </p>
            </div>
          </div>

          {/* The score, large enough to read from across the room. */}
          <div className="flex items-center gap-5">
            {standings
              .slice()
              .sort((a) => (a.side === mySide ? -1 : 1))
              .map((row, i) => (
                <div key={row.side} className="flex items-center gap-5">
                  {i > 0 && (
                    <span
                      className="font-mono text-[0.7rem]"
                      style={{ color: "var(--color-ink-ghost)" }}
                    >
                      vs
                    </span>
                  )}
                  <div className="text-center">
                    <p
                      className="font-mono text-[0.6rem] uppercase tracking-[0.14em]"
                      style={{
                        color:
                          row.side === mySide
                            ? "var(--color-accent)"
                            : "var(--color-ink-faint)",
                      }}
                    >
                      {row.side === mySide ? "You" : sideLabel(row.side)}
                    </p>
                    <p
                      className="font-mono text-[1.6rem] font-bold leading-tight tabular-nums"
                      style={{
                        color:
                          row.side === winnerSide
                            ? "var(--color-good)"
                            : "var(--color-ink-faint)",
                      }}
                    >
                      {row.bestPassed}
                      <span
                        className="text-[0.9rem] font-normal"
                        style={{ color: "var(--color-ink-ghost)" }}
                      >
                        /{row.total || "—"}
                      </span>
                    </p>
                  </div>
                </div>
              ))}
          </div>
        </section>

        {/*
          Three columns on a wide screen: the question, the review, the
          rewards. The problem is on the LEFT because reading it is what makes
          the code in the middle mean anything — the same order a judge site
          puts them in.
        */}
        <div className="mt-4 grid gap-4 xl:grid-cols-[22rem_minmax(0,1fr)_19rem]">
          {/* --- the problem --- */}
          <div className="flex flex-col gap-4">
            {problem ? (
              <ProblemPanel problem={problem} />
            ) : (
              <section className="panel p-5">
                <h2 className="text-[0.95rem] font-bold">The problem</h2>
                <p
                  className="mt-2 font-mono text-[0.72rem] leading-[1.7]"
                  style={{ color: "var(--color-ink-faint)" }}
                >
                  Reopened from a link, so the question is not in this
                  session&rsquo;s memory. The scores and code below are
                  unaffected.
                </p>
              </section>
            )}
          </div>

          {/* --- the review --- */}
          <div className="flex min-w-0 flex-col gap-4">
            <section className="panel p-5">
              <h2 className="text-[0.95rem] font-bold">How it finished</h2>

              <div className="mt-4 flex flex-col gap-4">
                {standings
                  .slice()
                  .sort((a, b) => b.bestPassed - a.bestPassed)
                  .map((row) => {
                    const isMine = row.side === mySide;
                    const isWinner = row.side === winnerSide;
                    const pct =
                      row.total > 0
                        ? Math.round((row.bestPassed / row.total) * 100)
                        : 0;
                    return (
                      <div key={row.side}>
                        <div className="flex items-baseline justify-between gap-3">
                          <span className="text-[0.82rem] font-semibold">
                            {sideLabel(row.side)}
                            {isMine && (
                              <span
                                className="ml-1.5 font-mono text-[0.68rem]"
                                style={{ color: "var(--color-accent)" }}
                              >
                                you
                              </span>
                            )}
                          </span>
                          <span className="font-mono text-[0.8rem] font-bold tabular-nums">
                            {row.bestPassed}/{row.total || "—"}
                            <span
                              className="ml-2 font-normal"
                              style={{ color: "var(--color-ink-faint)" }}
                            >
                              {pct}%
                            </span>
                          </span>
                        </div>
                        <div
                          className="mt-2 h-2 w-full overflow-hidden rounded-full"
                          style={{ background: "var(--color-surface-3)" }}
                        >
                          <div
                            className="h-full rounded-full transition-all duration-700"
                            style={{
                              width: `${pct}%`,
                              background: isWinner
                                ? "var(--color-good)"
                                : "var(--color-ink-ghost)",
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
              </div>

              {/* Your own test breakdown, inline rather than in its own panel
                  — it is four numbers about the bar directly above it. */}
              {mine && (
                <div
                  className="mt-5 grid grid-cols-2 gap-3 border-t pt-4 sm:grid-cols-4"
                  style={{ borderColor: "var(--color-line)" }}
                >
                  <Metric
                    label="Passed"
                    value={String(mine.bestPassed)}
                    accent="var(--color-good)"
                  />
                  <Metric
                    label="Failed"
                    value={String(Math.max(0, mine.total - mine.bestPassed))}
                    accent={
                      mine.total - mine.bestPassed > 0
                        ? "var(--color-bad)"
                        : undefined
                    }
                  />
                  <Metric label="Total tests" value={String(mine.total)} />
                  <Metric
                    label="Accuracy"
                    value={
                      mine.total > 0
                        ? `${Math.round((mine.bestPassed / mine.total) * 100)}%`
                        : "—"
                    }
                  />
                </div>
              )}
            </section>

            {/* Everyone's code — withheld during the match, revealed here. */}
            <SolutionsPanel
              battleId={battleId}
              myUserId={session.userId}
              mySide={mySide}
            />

            <div className="flex flex-wrap items-center gap-3">
              <button
                className="btn btn-primary"
                onClick={() => router.push("/")}
              >
                Back to lobby
              </button>
            </div>
          </div>

          {/* --- rewards --- */}
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

/**
 * The question, kept beside the answers.
 *
 * Statement, constraints and the sample cases, in a column that scrolls on
 * its own so a long problem cannot push the code review off the screen.
 */
function ProblemPanel({ problem }: { problem: PublicProblem }) {
  return (
    <section className="panel flex flex-col overflow-hidden">
      <div
        className="flex flex-wrap items-center gap-2 border-b px-5 py-3.5"
        style={{ borderColor: "var(--color-line)" }}
      >
        <h2 className="text-[0.95rem] font-bold">{problem.title}</h2>
        <span
          className="chip font-mono"
          style={{
            fontSize: "0.6rem",
            borderColor: DIFFICULTY_TONE[problem.difficulty],
            color: DIFFICULTY_TONE[problem.difficulty],
          }}
        >
          {problem.difficulty.toLowerCase()}
        </span>
      </div>

      <div className="max-h-[38rem] overflow-y-auto px-5 py-4">
        <Markdown source={problem.statementMarkdown} />

        {problem.constraints && (
          <div className="mt-5">
            <h3
              className="font-mono text-[0.62rem] uppercase tracking-[0.16em]"
              style={{ color: "var(--color-ink-faint)" }}
            >
              Constraints
            </h3>
            <div className="mt-1.5">
              <Markdown source={problem.constraints} />
            </div>
          </div>
        )}

        {/* Samples draws its own "Examples" heading, so adding one here
            produced two stacked labels saying the same thing. */}
        {problem.sampleTests.length > 0 && (
          <div className="mt-5">
            <Samples tests={problem.sampleTests} />
          </div>
        )}
      </div>
    </section>
  );
}

const DIFFICULTY_TONE: Record<string, string> = {
  EASY: "var(--color-good)",
  MEDIUM: "var(--color-warn)",
  HARD: "var(--color-bad)",
};

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
      {/*
        A quiet heading, not a filled orange bar.

        The solid block was the loudest thing on a page whose actual subject
        is the match, and it sat directly beside the code — so the eye went to
        a label rather than to the result.
      */}
      <div
        className="border-b px-4 py-3"
        style={{ borderColor: "var(--color-line)" }}
      >
        <h2 className="text-[0.95rem] font-bold">What you earned</h2>
      </div>

      <div className="flex flex-col gap-3 p-4">
        {award ? (
          <>
            <Row
              label="Experience"
              value={`+${award.xp} XP`}
              accent="var(--color-accent)"
            />
            {award.multiplier > 1 && (
              <Row
                label="Streak bonus"
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
                label="Daily taper"
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
            <Row label="Win streak" value={String(award.newStreak)} />

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
          <Row label="Current rank" value={rank.label} bold />
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


/**
 * A tick, a cross, or a dash.
 *
 * One glyph carrying the result, so the outcome survives being glanced at.
 * Colour alone would not: the headline says it in words, and this repeats it
 * in shape for anyone who cannot separate the greens from the greys.
 */
function VerdictMark({
  outcome,
}: {
  outcome: "win" | "loss" | "draw" | "spectator";
}) {
  const tone =
    outcome === "win"
      ? "var(--color-good)"
      : outcome === "loss"
        ? "var(--color-bad)"
        : "var(--color-ink-faint)";

  return (
    <span
      aria-hidden
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
      style={{
        border: `2px solid ${tone}`,
        background: `color-mix(in srgb, ${tone} 12%, transparent)`,
        color: tone,
      }}
    >
      {outcome === "win" ? (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path
            d="m5 10.5 3.5 3.5L15 6.5"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : outcome === "loss" ? (
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <path
            d="M4.5 4.5l9 9M13.5 4.5l-9 9"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <path
            d="M4 9h10"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        </svg>
      )}
    </span>
  );
}
