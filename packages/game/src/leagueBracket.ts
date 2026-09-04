/**
 * Arranging a league's fixtures into a bracket, as pure data.
 *
 * WHY THIS IS NOT JUST A .filter() IN THE COMPONENT
 * -------------------------------------------------
 * A bracket has to answer questions the raw fixture list does not: which
 * rounds actually exist, which are still to come, where a team CAME from, and
 * what the shape is when a round is half-drawn. Doing that inline in JSX
 * means the answers are re-derived on every render and cannot be tested
 * without a browser.
 */

/** The rounds a bracket can contain, in playing order. */
export const BRACKET_ROUNDS = [
  "QUARTER_FINAL",
  "SEMI_FINAL",
  "FINAL",
] as const;
export type BracketRound = (typeof BRACKET_ROUNDS)[number];

/** The minimal shape of a fixture this module needs. */
export interface BracketFixture {
  id: string;
  round: string;
  status: string;
  homeTeamId: string;
  homeTeamName: string;
  awayTeamId: string;
  awayTeamName: string;
  winnerTeamId: string | null;
  homeScore: number;
  awayScore: number;
}

/** One column of the bracket. */
export interface BracketColumn {
  round: BracketRound;
  label: string;
  fixtures: BracketFixture[];
  /**
   * How many ties this round WILL hold once fully drawn.
   *
   * A half-drawn round must still reserve the space for its missing matches,
   * or the bracket visibly reflows as each one is added and the lines stop
   * lining up with the round beside it.
   */
  slots: number;
}

export const ROUND_LABEL: Record<BracketRound, string> = {
  QUARTER_FINAL: "Quarter-finals",
  SEMI_FINAL: "Semi-finals",
  FINAL: "Final",
};

/**
 * Build the bracket columns from a league's fixtures.
 *
 * Only rounds that EXIST are returned. A league whose knockout has not been
 * drawn yet gets an empty array rather than three empty columns, because
 * three empty columns is a promise the league has not made — the host may
 * never draw a knockout at all.
 */
export function buildBracket(fixtures: BracketFixture[]): BracketColumn[] {
  const columns: BracketColumn[] = [];

  for (const round of BRACKET_ROUNDS) {
    const inRound = fixtures.filter(
      (f) => f.round === round && f.status !== "CANCELLED",
    );
    if (inRound.length === 0) continue;
    columns.push({
      round,
      label: ROUND_LABEL[round],
      fixtures: inRound,
      slots: slotsFor(round, inRound.length),
    });
  }

  /*
   * Reserve the shape each round is heading for, working BACKWARDS from the
   * round after it.
   *
   * Two semi-finals imply four quarter-final places even when only one
   * quarter has actually been drawn. Sizing a column by what EXISTS instead
   * left a lone quarter-final centred against a full-height semi column, with
   * its connector running into empty space rather than into a match.
   *
   * So a round is as tall as the round after it demands. The extra rows
   * render as "to be drawn" placeholders, which is the honest description of
   * a knockout the host has only half scheduled.
   */
  for (let i = columns.length - 2; i >= 0; i--) {
    const next = columns[i + 1]!;
    const col = columns[i]!;
    col.slots = Math.max(col.slots, next.slots * 2);
  }

  /*
   * Project the rounds still to come.
   *
   * Two semi-finals imply a final, and without it the semis' connectors ran
   * into empty space — the bracket looked truncated exactly when it was most
   * interesting, with everything played but the last match. Projected rounds
   * carry no fixtures, so they render as "to be drawn" placeholders and can
   * never be mistaken for a scheduled match.
   *
   * Only ever projects FORWARD from a round that exists, so a league with no
   * knockout at all still gets an empty bracket rather than an invented one.
   */
  const last = columns[columns.length - 1];
  if (last && last.slots > 1) {
    let slots = Math.ceil(last.slots / 2);
    let index = BRACKET_ROUNDS.indexOf(last.round) + 1;
    while (slots >= 1 && index < BRACKET_ROUNDS.length) {
      const round = BRACKET_ROUNDS[index]!;
      columns.push({
        round,
        label: ROUND_LABEL[round],
        fixtures: [],
        slots: round === "FINAL" ? 1 : slots,
      });
      if (round === "FINAL") break;
      slots = Math.ceil(slots / 2);
      index += 1;
    }
  }

  return columns;
}

/** How many ties a round holds: at least what exists, and always a whole number. */
function slotsFor(round: BracketRound, count: number): number {
  if (round === "FINAL") return 1;
  return Math.max(1, count);
}

/**
 * Everything about a team's run through the league, for the trail view.
 *
 * Ordered as played, so it reads as a story: won the group, won the semi,
 * lost the final.
 */
export interface TeamPathEntry {
  fixture: BracketFixture;
  /** Did this team win it? Null while unplayed or drawn. */
  won: boolean | null;
  opponentName: string;
}

/** One team's fixtures in playing order, across every round. */
export function teamPath(
  fixtures: BracketFixture[],
  teamId: string,
): TeamPathEntry[] {
  const order = ["GROUP", "TIEBREAK", ...BRACKET_ROUNDS];
  return fixtures
    .filter(
      (f) =>
        (f.homeTeamId === teamId || f.awayTeamId === teamId) &&
        f.status !== "CANCELLED",
    )
    .sort((a, b) => order.indexOf(a.round) - order.indexOf(b.round))
    .map((f) => ({
      fixture: f,
      won: f.winnerTeamId === null ? null : f.winnerTeamId === teamId,
      opponentName:
        f.homeTeamId === teamId ? f.awayTeamName : f.homeTeamName,
    }));
}

/**
 * The champion, if the final has been decided.
 *
 * Reads the FINAL rather than trusting a stored flag, so it cannot disagree
 * with the fixtures the bracket is drawing beside it.
 */
export function championOf(fixtures: BracketFixture[]): string | null {
  const final = fixtures.find(
    (f) =>
      f.round === "FINAL" && f.status === "COMPLETED" && f.winnerTeamId !== null,
  );
  return final?.winnerTeamId ?? null;
}

/**
 * How far a league has actually got, as a fraction.
 *
 * Counts every non-cancelled fixture, so the progress bar reflects the whole
 * competition — group stage included — rather than only the knockout.
 */
export function leagueProgress(fixtures: BracketFixture[]): {
  played: number;
  total: number;
} {
  const live = fixtures.filter((f) => f.status !== "CANCELLED");
  return {
    played: live.filter((f) => f.status === "COMPLETED").length,
    total: live.length,
  };
}
