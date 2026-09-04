/**
 * League standings and qualification — pure, so it can be reasoned about.
 *
 * WHY THIS IS NOT IN THE API LAYER
 * --------------------------------
 * "Who advances?" is the question a tournament exists to answer, and getting
 * it wrong means telling someone they are out when they are not. It depends
 * on nothing but a list of finished matches, so it lives here as a function
 * of its inputs and is tested exhaustively, rather than being tangled up with
 * Prisma queries where every edge case needs a database to reproduce.
 */

/** One completed tie, reduced to what standings care about. */
export interface FixtureResult {
  homeTeamId: string;
  awayTeamId: string;
  /** Null for a draw. */
  winnerTeamId: string | null;
  /** Legs won by each side, which is the goal-difference equivalent. */
  homeScore: number;
  awayScore: number;
}

/** A team's record in a league. */
export interface StandingEntry {
  teamId: string;
  played: number;
  won: number;
  lost: number;
  drawn: number;
  /** Legs won across every match — the first tie-break. */
  legsWon: number;
  legsLost: number;
  /** legsWon - legsLost. The second tie-break. */
  legDiff: number;
  /**
   * Competition points. Three for a win, one for a draw, matching the
   * football convention almost every player will already have in their head.
   */
  points: number;
  /** 1-based finishing position once sorted. */
  rank: number;
}

/** Three for a win, one for a draw. */
export const POINTS_WIN = 3;
export const POINTS_DRAW = 1;

/**
 * Build the table.
 *
 * `teamIds` is passed separately from the results so a team that has not
 * played yet still appears, on zero. A table that silently omits the teams
 * with no fixtures would look like they were never in the league.
 *
 * Named `buildLeagueTable`, not `buildStandings`: outcome.ts already exports
 * a `buildStandings` that ranks the PLAYERS inside one battle. Two exports of
 * that name from the same package would collide, and the two answer entirely
 * different questions.
 */
export function buildLeagueTable(
  teamIds: string[],
  results: FixtureResult[],
): StandingEntry[] {
  const rows = new Map<string, StandingEntry>();
  for (const teamId of teamIds) {
    rows.set(teamId, {
      teamId,
      played: 0,
      won: 0,
      lost: 0,
      drawn: 0,
      legsWon: 0,
      legsLost: 0,
      legDiff: 0,
      points: 0,
      rank: 0,
    });
  }

  for (const fx of results) {
    const home = rows.get(fx.homeTeamId);
    const away = rows.get(fx.awayTeamId);
    // A result naming a team that is not in the list is ignored rather than
    // throwing: a team can be removed from a league after playing, and losing
    // the whole table over one orphaned row would be a poor trade.
    if (!home || !away) continue;

    home.played += 1;
    away.played += 1;
    home.legsWon += fx.homeScore;
    home.legsLost += fx.awayScore;
    away.legsWon += fx.awayScore;
    away.legsLost += fx.homeScore;

    if (fx.winnerTeamId === fx.homeTeamId) {
      home.won += 1;
      away.lost += 1;
      home.points += POINTS_WIN;
    } else if (fx.winnerTeamId === fx.awayTeamId) {
      away.won += 1;
      home.lost += 1;
      away.points += POINTS_WIN;
    } else {
      home.drawn += 1;
      away.drawn += 1;
      home.points += POINTS_DRAW;
      away.points += POINTS_DRAW;
    }
  }

  const table = [...rows.values()];
  for (const row of table) {
    row.legDiff = row.legsWon - row.legsLost;
  }

  table.sort(compareStandings);
  table.forEach((row, i) => {
    row.rank = i + 1;
  });
  return table;
}

/**
 * The sort: points, then leg difference, then legs won, then team id.
 *
 * The final fallback on team id is what makes this a TOTAL order. Without it
 * two genuinely level teams would sort unpredictably, and the table could
 * reorder itself between two page loads with no match having been played —
 * which reads as a bug even though the standings are identical.
 */
export function compareStandings(a: StandingEntry, b: StandingEntry): number {
  return (
    b.points - a.points ||
    b.legDiff - a.legDiff ||
    b.legsWon - a.legsWon ||
    a.teamId.localeCompare(b.teamId)
  );
}

/**
 * How a league decides who goes through.
 *
 * TOP_N     — the best `value` teams in the table advance. The usual format.
 * WIN_COUNT — every team with at least `value` wins advances, however many
 *             that turns out to be. This is the rule the user asked for
 *             ("if a team wins 2 matches they go to the semifinal"), and it
 *             is genuinely different: it can qualify five teams or none.
 */
export type QualificationMode = "TOP_N" | "WIN_COUNT";

export interface QualificationRule {
  mode: QualificationMode;
  /** Places for TOP_N; required wins for WIN_COUNT. */
  value: number;
}

/**
 * Which teams qualify under a rule.
 *
 * Returns them in table order, so the caller can seed a bracket by strength
 * without re-sorting.
 *
 * TIES ARE NOT BROKEN ARBITRARILY HERE. Under TOP_N, if the cut falls in the
 * middle of a group of teams that are level on every tie-break, this returns
 * them ALL — leaving `qualified.length > value`. That is deliberate: the
 * honest answer to "who came fourth?" when three teams are identical is that
 * the league does not know, and quietly picking one by id would invent a
 * result. `hasAmbiguousCut` reports it so the host can decide.
 */
export function qualifyingTeams(
  table: StandingEntry[],
  rule: QualificationRule,
): StandingEntry[] {
  if (rule.mode === "WIN_COUNT") {
    return table.filter((row) => row.won >= rule.value);
  }

  const places = Math.max(0, Math.min(rule.value, table.length));
  if (places === 0) return [];
  if (places >= table.length) return [...table];

  const last = table[places - 1]!;
  // Everyone level with the last qualifying team is also through, which is
  // what makes the ambiguity visible rather than hidden.
  return table.filter(
    (row, i) => i < places || compareOnMerit(row, last) === 0,
  );
}

/**
 * True when a TOP_N cut lands inside a group of teams that cannot be
 * separated on merit — so more teams qualify than there are places.
 */
export function hasAmbiguousCut(
  table: StandingEntry[],
  rule: QualificationRule,
): boolean {
  return contestedPlaces(table, rule) !== null;
}

/**
 * The teams left level at the qualification line, and how many places they
 * are actually competing for.
 *
 * This is what a decider needs to know. Given a top-2 rule and three teams
 * where second and third are identical, the answer is "these two teams are
 * playing for one place" — the team in first is already through and must not
 * be dragged into a play-off it has no stake in.
 *
 * Returns null when the cut is clean, or when the rule cannot produce one:
 * WIN_COUNT is an absolute threshold, so a team either reached it or did not
 * and there is nothing to play off.
 */
export function contestedPlaces(
  table: StandingEntry[],
  rule: QualificationRule,
): { teamIds: string[]; places: number } | null {
  if (rule.mode !== "TOP_N") return null;

  const places = Math.max(0, Math.min(rule.value, table.length));
  if (places === 0 || places >= table.length) return null;

  const last = table[places - 1]!;
  const tied = table.filter((row) => compareOnMerit(row, last) === 0);
  if (tied.length <= 1) return null;

  // How many of the contested places are already spoken for by teams ABOVE
  // the tied group. The rest is what the play-off is for.
  const clearlyThrough = table.findIndex(
    (row) => compareOnMerit(row, last) === 0,
  );
  const contested = places - clearlyThrough;

  // A tie that spans the whole qualifying set AND the whole field is not
  // contested — everyone is level, so everyone goes through or nobody does.
  if (contested <= 0 || contested >= tied.length) return null;

  return { teamIds: tied.map((r) => r.teamId), places: contested };
}

/**
 * Comparison on MERIT only — no team-id fallback.
 *
 * `compareStandings` deliberately ends with a team-id comparison so the table
 * has a stable order. That makes it useless for asking "are these two level?",
 * because it never returns 0 for different teams. This is the question that
 * actually matters at a qualification cut.
 */
function compareOnMerit(a: StandingEntry, b: StandingEntry): number {
  return b.points - a.points || b.legDiff - a.legDiff || b.legsWon - a.legsWon;
}

/** A pairing the bracket generator produced. */
export interface Pairing {
  homeTeamId: string;
  awayTeamId: string;
}

/**
 * Pair qualified teams into the next round: first plays last, second plays
 * second-last, and so on.
 *
 * This is standard bracket seeding, and it is not arbitrary — it rewards
 * finishing high by giving the strongest team the weakest surviving opponent.
 * Pairing 1v2 and 3v4 instead would knock the two best teams out of
 * contention against each other in the first round.
 *
 * An ODD number of teams gives the top seed a bye: they are simply not
 * paired, and the caller advances them. Refusing to generate anything would
 * be worse — three teams qualifying is a normal outcome of a WIN_COUNT rule.
 */
export function seedPairings(teamIds: string[]): {
  pairings: Pairing[];
  bye: string | null;
} {
  if (teamIds.length < 2) {
    return { pairings: [], bye: teamIds[0] ?? null };
  }

  const seeds = [...teamIds];
  const bye = seeds.length % 2 === 1 ? seeds.shift()! : null;

  const pairings: Pairing[] = [];
  for (let i = 0; i < seeds.length / 2; i++) {
    pairings.push({
      homeTeamId: seeds[i]!,
      awayTeamId: seeds[seeds.length - 1 - i]!,
    });
  }
  return { pairings, bye };
}

/** The rounds a league can run, in the order they are played. */
export const ROUND_ORDER = [
  "GROUP",
  "QUARTER_FINAL",
  "SEMI_FINAL",
  "FINAL",
] as const;
export type RoundKey = (typeof ROUND_ORDER)[number];

/**
 * Which round should follow, given how many teams came through.
 *
 * Driven by the SIZE of the qualifying field rather than by counting rounds,
 * so eight qualifiers go to the quarter-finals and two go straight to the
 * final, whatever round they came from. A bracket that always went
 * group → quarter → semi → final would force a four-team league to play two
 * pointless rounds.
 *
 * Returns null when the competition is over — one team left, or none.
 */
export function nextRoundFor(qualifierCount: number): RoundKey | null {
  if (qualifierCount >= 8) return "QUARTER_FINAL";
  if (qualifierCount >= 4) return "SEMI_FINAL";
  if (qualifierCount >= 2) return "FINAL";
  return null;
}
