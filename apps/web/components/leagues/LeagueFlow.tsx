"use client";

import { useMemo } from "react";
import Link from "next/link";
import { leagueProgress, teamPath, type BracketFixture } from "@repo/game";
import type {
  LeagueDetailResponse,
  LeagueStandingsResponse,
} from "@repo/protocol";
import { Bracket } from "./Bracket";
import { LeagueLogo } from "./LeagueBits";

/**
 * The whole league at a glance: how it started, where it is, how it ends.
 *
 * WHY THIS IS ITS OWN PAGE
 * ------------------------
 * The league dashboard is a working surface — schedule this, start that, join
 * a team. This is the opposite: nothing here is a control. It answers "what
 * is the shape of this competition and where am I in it?", which is the
 * question a participant has most of the time and the dashboard answers only
 * by making them assemble it from three separate panels.
 *
 * It reads top to bottom in the order the competition happens: the group
 * stage that qualifies teams, the bracket that eliminates them, and the
 * trophy at the end.
 */
export function LeagueFlow({
  detail,
  standings,
}: {
  detail: LeagueDetailResponse;
  standings: LeagueStandingsResponse | null;
}) {
  const fixtures = detail.fixtures as unknown as BracketFixture[];
  const progress = leagueProgress(fixtures);
  const myTeamId = detail.myTeamId;

  const groupFixtures = detail.fixtures.filter((f) => f.round === "GROUP");
  const tiebreaks = detail.fixtures.filter((f) => f.round === "TIEBREAK");

  const myRun = useMemo(
    () => (myTeamId ? teamPath(fixtures, myTeamId) : []),
    [fixtures, myTeamId],
  );

  return (
    <div className="flex flex-col gap-10">
      {/* --- progress --- */}
      <ProgressStrip
        played={progress.played}
        total={progress.total}
        teams={detail.teams.length}
        teamSize={detail.league.teamSize}
      />

      {/* --- your run, when you are in it --- */}
      {myRun.length > 0 && (
        <Section
          title="Your run"
          hint="every match your team has played, in order"
        >
          <div className="flex flex-wrap gap-2">
            {myRun.map((step) => (
              <div
                key={step.fixture.id}
                className="flex items-center gap-2.5 rounded-[8px] border px-3 py-2"
                style={{
                  borderColor:
                    step.won === true
                      ? "var(--color-good)"
                      : step.won === false
                        ? "var(--color-bad)"
                        : "var(--color-line)",
                  background:
                    step.won === true
                      ? "color-mix(in srgb, var(--color-good) 8%, transparent)"
                      : step.won === false
                        ? "color-mix(in srgb, var(--color-bad) 8%, transparent)"
                        : undefined,
                }}
              >
                <span
                  className="font-mono text-[0.58rem] uppercase tracking-wider"
                  style={{ color: "var(--color-ink-ghost)" }}
                >
                  {SHORT_ROUND[step.fixture.round] ?? step.fixture.round}
                </span>
                <span className="text-[0.76rem] font-semibold">
                  vs {step.opponentName}
                </span>
                <span
                  className="font-mono text-[0.7rem] font-bold"
                  style={{
                    color:
                      step.won === true
                        ? "var(--color-good)"
                        : step.won === false
                          ? "var(--color-bad)"
                          : "var(--color-ink-faint)",
                  }}
                >
                  {step.won === null
                    ? "to play"
                    : step.won
                      ? "won"
                      : "lost"}
                </span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* --- the group stage --- */}
      <Section
        title="Group stage"
        hint={
          standings?.qualifyMode === "TOP_N"
            ? `top ${standings.qualifyValue} advance`
            : standings?.qualifyMode === "WIN_COUNT"
              ? `${standings.qualifyValue}+ wins advance`
              : "every match played before the knockout"
        }
      >
        {standings && standings.rows.length > 0 ? (
          <QualifyingLadder standings={standings} myTeamId={myTeamId} />
        ) : (
          <Empty>No teams have registered yet.</Empty>
        )}

        {groupFixtures.length > 0 && (
          <p
            className="mt-3 font-mono text-[0.68rem]"
            style={{ color: "var(--color-ink-faint)" }}
          >
            {groupFixtures.filter((f) => f.status === "COMPLETED").length} of{" "}
            {groupFixtures.length} group matches played
          </p>
        )}
      </Section>

      {/* --- deciders, only when they exist --- */}
      {tiebreaks.length > 0 && (
        <Section
          title="Deciders"
          hint="played because teams finished level at the qualification line"
        >
          <div className="flex flex-wrap gap-2.5">
            {tiebreaks.map((f) => (
              <div
                key={f.id}
                className="panel flex items-center gap-3 px-3.5 py-2.5"
              >
                <span className="text-[0.78rem] font-semibold">
                  {f.homeTeamName}
                </span>
                <span
                  className="font-mono text-[0.8rem] font-bold"
                  style={{ color: "var(--color-ink-faint)" }}
                >
                  {f.homeScore}&ndash;{f.awayScore}
                </span>
                <span className="text-[0.78rem] font-semibold">
                  {f.awayTeamName}
                </span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* --- the bracket --- */}
      <Section title="Knockout" hint="win and advance, lose and you are out">
        <Bracket detail={detail} myTeamId={myTeamId} />
      </Section>
    </div>
  );
}

/** How far through the competition is, in one line. */
function ProgressStrip({
  played,
  total,
  teams,
  teamSize,
}: {
  played: number;
  total: number;
  teams: number;
  teamSize: number;
}) {
  const pct = total === 0 ? 0 : Math.round((played / total) * 100);
  return (
    <div className="panel p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <Stat label="Teams" value={String(teams)} />
          <Stat label="Format" value={`${teamSize}v${teamSize}`} />
          <Stat label="Matches played" value={`${played} / ${total}`} />
        </div>
        <span
          className="font-mono text-[1.4rem] font-bold"
          style={{ color: "var(--color-accent)" }}
        >
          {pct}%
        </span>
      </div>

      <div
        className="mt-3 h-1.5 overflow-hidden rounded-full"
        style={{ background: "var(--color-surface-3)" }}
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="League progress"
      >
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${pct}%`,
            background:
              "linear-gradient(90deg, var(--color-primary), var(--color-accent))",
          }}
        />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <span className="flex flex-col">
      <span
        className="font-mono text-[0.6rem] uppercase tracking-[0.16em]"
        style={{ color: "var(--color-ink-faint)" }}
      >
        {label}
      </span>
      <span className="mt-0.5 text-[0.95rem] font-bold">{value}</span>
    </span>
  );
}

/**
 * The qualifying ladder: the table, with the cut drawn.
 *
 * A compact form of the standings rather than the full table — this page is
 * about the SHAPE of the competition, and the detailed table already lives on
 * the dashboard. What matters here is who is above the line.
 */
function QualifyingLadder({
  standings,
  myTeamId,
}: {
  standings: LeagueStandingsResponse;
  myTeamId: string | null;
}) {
  const lastQualifying = standings.rows.reduce(
    (acc, r, i) => (r.qualifies ? i : acc),
    -1,
  );

  return (
    <div className="flex flex-col gap-1.5">
      {standings.rows.map((r, i) => (
        <div key={r.teamId}>
          <div
            className="flex items-center gap-3 rounded-[8px] border px-3 py-2"
            style={{
              borderColor:
                r.teamId === myTeamId
                  ? "var(--color-primary)"
                  : r.qualifies
                    ? "color-mix(in srgb, var(--color-good) 40%, transparent)"
                    : "var(--color-line)",
              background: r.isChampion
                ? "color-mix(in srgb, var(--color-amber) 10%, transparent)"
                : r.qualifies
                  ? "color-mix(in srgb, var(--color-good) 5%, transparent)"
                  : undefined,
            }}
          >
            <span
              className="w-5 shrink-0 text-center font-mono text-[0.7rem]"
              style={{ color: "var(--color-ink-faint)" }}
            >
              {r.rank}
            </span>
            <LeagueLogo name={r.teamName} logoUrl={r.logoUrl} size={24} />
            <span className="min-w-0 flex-1 truncate text-[0.82rem] font-semibold">
              {r.teamName}
            </span>
            <span
              className="shrink-0 font-mono text-[0.66rem]"
              style={{ color: "var(--color-ink-faint)" }}
            >
              {r.won}W · {r.lost}L
            </span>
            <span className="shrink-0 font-mono text-[0.82rem] font-bold tabular-nums">
              {r.points}
            </span>
          </div>

          {/* The qualification line, drawn where the cut actually falls. */}
          {i === lastQualifying && i < standings.rows.length - 1 && (
            <div className="flex items-center gap-2 py-1.5">
              <span
                className="h-px flex-1"
                style={{ background: "var(--color-good)" }}
              />
              <span
                className="font-mono text-[0.56rem] uppercase tracking-[0.18em]"
                style={{ color: "var(--color-good)" }}
              >
                qualification line
              </span>
              <span
                className="h-px flex-1"
                style={{ background: "var(--color-good)" }}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="text-[1.05rem] font-bold">{title}</h2>
        {hint && (
          <span
            className="font-mono text-[0.68rem]"
            style={{ color: "var(--color-ink-faint)" }}
          >
            {hint}
          </span>
        )}
      </div>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="panel p-8 text-center">
      <p
        className="font-mono text-[0.78rem]"
        style={{ color: "var(--color-ink-dim)" }}
      >
        {children}
      </p>
    </div>
  );
}

const SHORT_ROUND: Record<string, string> = {
  GROUP: "group",
  TIEBREAK: "decider",
  QUARTER_FINAL: "QF",
  SEMI_FINAL: "SF",
  FINAL: "final",
};
