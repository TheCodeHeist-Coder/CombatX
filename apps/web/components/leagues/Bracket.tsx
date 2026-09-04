"use client";

import Link from "next/link";
import {
  buildBracket,
  championOf,
  type BracketColumn,
  type BracketFixture,
} from "@repo/game";
import type { LeagueDetailResponse } from "@repo/protocol";
import { LeagueLogo } from "./LeagueBits";

/**
 * The knockout bracket.
 *
 * HOW THE CONNECTORS ARE DRAWN
 * ----------------------------
 * With CSS borders on the gaps between ties, not SVG. A bracket is a grid
 * whose lines are always the same three shapes — out of a tie, down to the
 * midpoint, into the next round — and expressing those as borders means they
 * reflow correctly when a card grows to fit a long team name. An SVG overlay
 * would have to be re-measured on every resize and every font load, and would
 * be wrong for the moment in between.
 *
 * WHY A TIE IS A LINK
 * -------------------
 * Every box on a bracket is a question — "what happened there?" — and the
 * answer is the match itself. So each one navigates to its battle when there
 * is a battle to see.
 */
export function Bracket({
  detail,
  myTeamId,
}: {
  detail: LeagueDetailResponse;
  myTeamId: string | null;
}) {
  const fixtures = detail.fixtures as unknown as BracketFixture[];
  const columns = buildBracket(fixtures);
  const champion = championOf(fixtures);

  if (columns.length === 0) {
    return (
      <div className="panel p-12 text-center">
        <p
          className="font-mono text-[0.82rem]"
          style={{ color: "var(--color-ink-dim)" }}
        >
          The knockout has not been drawn yet.
        </p>
        <p
          className="mx-auto mt-2 max-w-md font-mono text-[0.7rem] leading-[1.8]"
          style={{ color: "var(--color-ink-ghost)" }}
        >
          Once the group stage is played and the host draws a round, the
          bracket appears here and fills in as matches are decided.
        </p>
      </div>
    );
  }

  const championName =
    detail.teams.find((t) => t.id === champion)?.name ?? null;

  return (
    /*
     * A well, not a bare div.
     *
     * A two-column bracket occupies a fraction of a wide page, and left
     * -aligned in open space it read as an unfinished fragment rather than a
     * diagram. The panel gives it an edge to sit inside, and `justify-center`
     * keeps it in the middle of that space at any size — while `min-w-max`
     * plus the scroll container still lets a deep bracket run wider than the
     * screen and scroll.
     */
    <div className="panel overflow-x-auto px-4 py-8 sm:px-8">
      <div className="flex min-w-max items-stretch justify-center gap-0">
        {columns.map((col, i) => (
          <Column
            key={col.round}
            column={col}
            isLast={i === columns.length - 1}
            myTeamId={myTeamId}
            teams={detail.teams}
          />
        ))}

        {/* The trophy sits beyond the final, so the eye ends somewhere. */}
        <TrophyColumn name={championName} />
      </div>
    </div>
  );
}

function Column({
  column,
  isLast,
  myTeamId,
  teams,
}: {
  column: BracketColumn;
  isLast: boolean;
  myTeamId: string | null;
  teams: LeagueDetailResponse["teams"];
}) {
  /*
   * Empty slots keep the column the height it is heading for, so the bracket
   * does not visibly reflow as each match of a round gets drawn.
   *
   * They also keep PARTIAL rounds aligned with what they feed. A round with
   * one match drawn out of four is still four rows tall, with three of them
   * placeholders — without that, `justify-around` centred the single card
   * while the round beside it spread across the full height, and the
   * connector ran into open space instead of into a match.
   */
  const slots: (BracketFixture | null)[] = Array.from(
    { length: Math.max(column.slots, column.fixtures.length) },
    (_, i) => column.fixtures[i] ?? null,
  );

  return (
    <div className="flex flex-col">
      <p
        className="mb-3 px-3 font-mono text-[0.64rem] uppercase tracking-[0.18em]"
        style={{ color: "var(--color-ink-faint)" }}
      >
        {column.label}
      </p>

      <div className="flex flex-1 flex-col justify-around gap-6">
        {slots.map((fixture, i) => (
          <div key={fixture?.id ?? `empty-${i}`} className="flex items-center">
            <div className="w-[16rem] shrink-0 px-3">
              {fixture ? (
                <TieCard
                  fixture={fixture}
                  myTeamId={myTeamId}
                  teams={teams}
                />
              ) : (
                <EmptyTie />
              )}
            </div>

            {/*
              The connector out of this tie.

              Absent on the last column, where there is nothing to the right —
              a stub into blank space reads as a missing match.
            */}
            {!isLast && (
              <Connector
                // Pairs of ties feed one match in the next round, so the first
                // of each pair bends DOWN and the second bends UP to meet at
                // the midpoint between them.
                bend={i % 2 === 0 ? "down" : "up"}
                paired={i + 1 < slots.length || i % 2 === 1}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * The elbow leading from a tie toward the next round.
 *
 * Two halves: a short stub out of the card, then a vertical run toward the
 * midpoint it shares with its partner tie. Drawn with borders rather than
 * SVG so it reflows with the cards — see the note at the top of this file.
 *
 * `paired` is false for a tie with no partner (an odd round, or a round with
 * only one match drawn so far). It then gets a flat line, because there is
 * nothing to converge WITH and a hanging vertical would imply a match that
 * does not exist.
 */
function Connector({
  bend,
  paired,
}: {
  bend: "up" | "down";
  paired: boolean;
}) {
  const line = "var(--color-line-strong)";

  if (!paired) {
    return (
      <span
        aria-hidden
        className="h-px w-8 shrink-0"
        style={{ background: line }}
      />
    );
  }

  /*
   * The vertical run is sized in `rem`, not as a percentage.
   *
   * A percentage height resolves against the parent's height, and the parent
   * here is a flex item with no definite height of its own — so `50%`
   * collapsed to 1px and the elbows rendered as flat stubs. Measured, not
   * guessed: the vertical segments came back 1px tall.
   *
   * HALF_GAP is half the vertical distance between two tie cards, which is
   * exactly how far each must travel to meet its partner at the midpoint.
   */
  const HALF_GAP = "2.55rem";

  return (
    <span aria-hidden className="flex shrink-0 items-center">
      {/* Out of the card. */}
      <span className="w-4" style={{ height: 1, background: line }} />
      {/* Down (or up) toward the shared midpoint. */}
      <span
        className="w-4"
        style={{
          borderColor: line,
          borderStyle: "solid",
          borderRightWidth: 1,
          borderTopWidth: bend === "up" ? 1 : 0,
          borderBottomWidth: bend === "down" ? 1 : 0,
          height: HALF_GAP,
          // The segment hangs below the card it leaves (bending down) or
          // above it (bending up), so the two meet exactly halfway.
          transform:
            bend === "down"
              ? `translateY(calc(${HALF_GAP} / 2))`
              : `translateY(calc(-1 * ${HALF_GAP} / 2))`,
        }}
      />
      {/*
        Into the next round.

        Without this the elbow stopped in open space short of the card it
        feeds, which reads as a line going nowhere. Offset by the same half
        -gap so it continues from where the vertical actually ended.
      */}
      <span
        className="w-4"
        style={{
          height: 1,
          background: line,
          transform:
            bend === "down"
              ? `translateY(${HALF_GAP})`
              : `translateY(calc(-1 * ${HALF_GAP}))`,
        }}
      />
    </span>
  );
}

function TieCard({
  fixture,
  myTeamId,
  teams,
}: {
  fixture: BracketFixture;
  myTeamId: string | null;
  teams: LeagueDetailResponse["teams"];
}) {
  const decided = fixture.status === "COMPLETED";
  const live = fixture.status === "LIVE";
  const mine =
    myTeamId !== null &&
    (fixture.homeTeamId === myTeamId || fixture.awayTeamId === myTeamId);

  const logoOf = (id: string) =>
    teams.find((t) => t.id === id)?.logoUrl ?? null;

  const card = (
    <div
      className="overflow-hidden rounded-[10px] border transition-colors"
      style={{
        borderColor: live
          ? "var(--color-warn)"
          : mine
            ? "var(--color-primary)"
            : "var(--color-line-strong)",
        background: "var(--color-surface)",
        boxShadow: live
          ? "0 0 22px -8px color-mix(in srgb, var(--color-warn) 70%, transparent)"
          : "var(--shadow-lift)",
      }}
    >
      <Side
        name={fixture.homeTeamName}
        logoUrl={logoOf(fixture.homeTeamId)}
        score={fixture.homeScore}
        won={decided && fixture.winnerTeamId === fixture.homeTeamId}
        lost={decided && fixture.winnerTeamId !== fixture.homeTeamId}
        isMine={fixture.homeTeamId === myTeamId}
        showScore={fixture.status !== "SCHEDULED"}
      />
      <div
        aria-hidden
        style={{ height: 1, background: "var(--color-line)" }}
      />
      <Side
        name={fixture.awayTeamName}
        logoUrl={logoOf(fixture.awayTeamId)}
        score={fixture.awayScore}
        won={decided && fixture.winnerTeamId === fixture.awayTeamId}
        lost={decided && fixture.winnerTeamId !== fixture.awayTeamId}
        isMine={fixture.awayTeamId === myTeamId}
        showScore={fixture.status !== "SCHEDULED"}
      />

      {live && (
        <p
          className="px-2.5 py-1 text-center font-mono text-[0.58rem] uppercase tracking-[0.16em]"
          style={{
            background: "color-mix(in srgb, var(--color-warn) 16%, transparent)",
            color: "var(--color-warn)",
          }}
        >
          playing now
        </p>
      )}
    </div>
  );

  // A tie with a battle behind it answers "what happened there?"; one without
  // is not a link, so nothing looks clickable that would go nowhere.
  const target = liveOrFinishedBattle(fixture);
  return target ? (
    <Link href={target} className="block">
      {card}
    </Link>
  ) : (
    card
  );
}

/**
 * Where a tie card should navigate.
 *
 * Deliberately null for a scheduled tie: there is no battle yet, and a link
 * to the league page it is already on would be a click that does nothing.
 */
function liveOrFinishedBattle(fixture: BracketFixture): string | null {
  const legs = (fixture as unknown as { legs?: { battleId: string | null }[] })
    .legs;
  const withBattle = legs?.find((l) => l.battleId);
  return withBattle?.battleId ? `/battle/${withBattle.battleId}` : null;
}

function Side({
  name,
  logoUrl,
  score,
  won,
  lost,
  isMine,
  showScore,
}: {
  name: string;
  logoUrl: string | null;
  score: number;
  won: boolean;
  lost: boolean;
  isMine: boolean;
  showScore: boolean;
}) {
  return (
    <div
      className="flex items-center gap-2 px-2.5 py-2"
      style={{
        // A won side is tinted and a lost one dimmed, so the outcome of a
        // whole round is readable without stopping to compare numbers.
        background: won
          ? "color-mix(in srgb, var(--color-good) 12%, transparent)"
          : undefined,
        opacity: lost ? 0.55 : 1,
      }}
    >
      <LeagueLogo name={name} logoUrl={logoUrl} size={22} />
      <span
        className="min-w-0 flex-1 truncate text-[0.76rem]"
        style={{
          fontWeight: won ? 700 : 500,
          color: isMine ? "var(--color-accent)" : "var(--color-ink)",
        }}
        title={name}
      >
        {name}
      </span>
      {showScore && (
        <span
          className="shrink-0 font-mono text-[0.8rem] font-bold tabular-nums"
          style={{
            color: won ? "var(--color-good)" : "var(--color-ink-faint)",
          }}
        >
          {score}
        </span>
      )}
    </div>
  );
}

/** A place a match will go, drawn so the column keeps its shape. */
function EmptyTie() {
  return (
    <div
      className="flex h-[4.6rem] items-center justify-center rounded-[10px] border border-dashed"
      style={{
        borderColor: "var(--color-line)",
        color: "var(--color-ink-ghost)",
      }}
    >
      <span className="font-mono text-[0.62rem]">to be drawn</span>
    </div>
  );
}

function TrophyColumn({ name }: { name: string | null }) {
  return (
    <div className="flex items-center">
      {/* A lead-in from the final, so the trophy is the END of the bracket
          rather than a card parked beside it. */}
      <span
        aria-hidden
        className="h-px w-6 shrink-0"
        style={{ background: "var(--color-line-strong)" }}
      />
      <div className="flex flex-col justify-center pl-3 pr-3">
      <div
        className="flex w-[13rem] flex-col items-center rounded-[12px] border px-4 py-6 text-center"
        style={{
          borderColor: name ? "var(--color-amber)" : "var(--color-line)",
          background: name
            ? "color-mix(in srgb, var(--color-amber) 10%, transparent)"
            : "transparent",
        }}
      >
        <Trophy lit={name !== null} />
        {name ? (
          <>
            <p
              className="mt-3 font-mono text-[0.58rem] uppercase tracking-[0.2em]"
              style={{ color: "var(--color-amber)" }}
            >
              Champion
            </p>
            <p className="mt-1 text-[1rem] font-bold leading-tight">{name}</p>
          </>
        ) : (
          <p
            className="mt-3 font-mono text-[0.64rem]"
            style={{ color: "var(--color-ink-ghost)" }}
          >
            Still to be won
          </p>
        )}
        </div>
      </div>
    </div>
  );
}

/** A trophy, hand-drawn — the codebase carries no icon package. */
function Trophy({ lit }: { lit: boolean }) {
  const tone = lit ? "var(--color-amber)" : "var(--color-ink-ghost)";
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden>
      <path
        d="M12 6h16v9a8 8 0 0 1-16 0V6Z"
        stroke={tone}
        strokeWidth="1.8"
        strokeLinejoin="round"
        fill={lit ? "color-mix(in srgb, var(--color-amber) 22%, transparent)" : "none"}
      />
      {/* Handles. */}
      <path
        d="M12 8H8v3a5 5 0 0 0 4 4.9M28 8h4v3a5 5 0 0 1-4 4.9"
        stroke={tone}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      {/* Stem and base. */}
      <path
        d="M20 23v6M14 33h12M16 29h8l2 4H14l2-4Z"
        stroke={tone}
        strokeWidth="1.8"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
