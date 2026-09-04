import { prisma } from "@repo/db";
import {
  buildLeagueTable,
  contestedPlaces,
  hasAmbiguousCut,
  nextRoundFor,
  qualifyingTeams,
  seedPairings,
  type FixtureResult,
  type QualificationRule,
  type StandingEntry,
} from "@repo/game";
import {
  type LeagueRound,
  type LeagueStandingRow,
  type LeagueStandingsResponse,
  type RoundPreview,
} from "@repo/protocol";
import { conflict, notFound } from "../../http/errors.js";
import { requireHost } from "./leagues.service.js";
import { settleLeague } from "./fixtures.service.js";
import {
  notify,
  teamMembers,
} from "../notifications/notifications.service.js";

/**
 * Standings, qualification and round progression.
 *
 * WHERE THE THINKING LIVES
 * ------------------------
 * Almost none of it is here. Ranking teams, deciding who qualifies and
 * seeding a bracket are pure functions in @repo/game, tested exhaustively
 * without a database. This module's whole job is to fetch rows, hand them to
 * those functions, and write back what they decide.
 *
 * That split matters because "who is eliminated?" is the question a
 * tournament exists to answer, and a wrong answer tells someone they are out
 * when they are not.
 *
 * WHY A ROUND IS GENERATED, NOT INFERRED
 * --------------------------------------
 * The server never advances a league on its own. It computes who WOULD go
 * through and shows the host, who then confirms. Generating fixtures creates
 * matches that real people arrange their evening around, and a league that
 * silently moved to the semi-finals because a result landed at 3am — possibly
 * on a tie-break the host would have settled differently — is not something
 * anyone can undo.
 */

/* -------------------------------------------------------------------------- */
/* Reading the table                                                          */
/* -------------------------------------------------------------------------- */

/**
 * The league table, plus whatever happens next.
 *
 * Readable by anyone who can read the league. The `preview` is the host's
 * control surface, but seeing who is on course to qualify is exactly what a
 * PLAYER wants from a standings page, so it is not hidden from them.
 */
export async function getStandings(
  leagueId: string,
): Promise<LeagueStandingsResponse> {
  // Fold in any battles that finished since anyone last looked, so the table
  // is never one refresh behind the results.
  await settleLeague(leagueId);

  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    include: {
      teams: { select: { id: true, name: true, logoUrl: true } },
      fixtures: {
        where: { status: "COMPLETED" },
        include: { legs: { select: { winnerTeamId: true } } },
      },
    },
  });
  if (!league) throw notFound("League not found.");

  const nameOf = new Map(league.teams.map((t) => [t.id, t.name]));
  const logoOf = new Map(league.teams.map((t) => [t.id, t.logoUrl]));

  /*
   * The table is built from GROUP matches only.
   *
   * Knockout results must not feed back into the standings that decided the
   * knockout: losing a semi-final would otherwise drag a team down the table
   * that qualified them in the first place, and re-running qualification
   * could then produce a different set of qualifiers than the one already
   * playing. The group stage is the qualifier, and it stays fixed once the
   * bracket begins.
   */
  const groupResults: FixtureResult[] = league.fixtures
    .filter((f) => f.round === "GROUP")
    .map((f) => ({
      homeTeamId: f.homeTeamId,
      awayTeamId: f.awayTeamId,
      winnerTeamId: f.winnerTeamId,
      homeScore: f.legs.filter((l) => l.winnerTeamId === f.homeTeamId).length,
      awayScore: f.legs.filter((l) => l.winnerTeamId === f.awayTeamId).length,
    }));

  const table = buildLeagueTable(
    league.teams.map((t) => t.id),
    groupResults,
  );

  const rule = ruleOf(league);
  const decided = decidedTiebreaks(league.fixtures);
  const qualifiedIds = new Set(
    rule ? resolveQualifiers(table, rule, decided).map((r) => r.teamId) : [],
  );

  const champion = findChampion(league.fixtures);

  const rows: LeagueStandingRow[] = table.map((r) => ({
    teamId: r.teamId,
    teamName: nameOf.get(r.teamId) ?? "—",
    logoUrl: logoOf.get(r.teamId) ?? null,
    rank: r.rank,
    played: r.played,
    won: r.won,
    drawn: r.drawn,
    lost: r.lost,
    legsWon: r.legsWon,
    legsLost: r.legsLost,
    legDiff: r.legDiff,
    points: r.points,
    qualifies: qualifiedIds.has(r.teamId),
    isChampion: champion?.teamId === r.teamId,
  }));

  return {
    rows,
    qualifyMode: league.qualifyMode,
    qualifyValue: league.qualifyValue,
    preview: await buildPreview(leagueId, table, rule, nameOf, decided),
    championTeamId: champion?.teamId ?? null,
    championTeamName: champion ? (nameOf.get(champion.teamId) ?? null) : null,
  };
}

/* -------------------------------------------------------------------------- */
/* Previewing the next round                                                  */
/* -------------------------------------------------------------------------- */

/**
 * What generating the next round would do.
 *
 * Returns null when there is nothing to preview at all — no rule set, so the
 * league is a plain table and no bracket is intended.
 */
async function buildPreview(
  leagueId: string,
  table: StandingEntry[],
  rule: QualificationRule | null,
  nameOf: Map<string, string>,
  decided: Set<string>,
): Promise<RoundPreview | null> {
  if (!rule) return null;

  const fixtures = await prisma.leagueFixture.findMany({
    where: { leagueId, status: { not: "CANCELLED" } },
    select: { round: true, status: true, winnerTeamId: true },
  });

  /*
   * Which teams are still standing.
   *
   * Once a knockout round exists, the field is its WINNERS — not the group
   * table, which no longer reflects who is left. Before any knockout round
   * exists, the field is whoever qualified out of the group stage.
   */
  const latest = latestKnockoutRound(fixtures.map((f) => f.round));

  let field: { teamId: string; rank: number }[];
  let blockedReason: string | null = null;

  if (latest === null) {
    const groupsLeft = fixtures.filter(
      (f) => f.round === "GROUP" && f.status !== "COMPLETED",
    ).length;
    if (groupsLeft > 0) {
      blockedReason = `${groupsLeft} group match${
        groupsLeft === 1 ? "" : "es"
      } still to be played.`;
    }
    field = resolveQualifiers(table, rule, decided).map((r) => ({
      teamId: r.teamId,
      rank: r.rank,
    }));
  } else {
    const inRound = fixtures.filter((f) => f.round === latest);
    const unfinished = inRound.filter((f) => f.status !== "COMPLETED").length;
    if (unfinished > 0) {
      blockedReason = `${unfinished} ${ROUND_LABEL[latest]} match${
        unfinished === 1 ? "" : "es"
      } still to be played.`;
    }
    // Winners advance. A drawn knockout tie has no winner, which is a real
    // state the host has to resolve — say so rather than dropping the team.
    const drawn = inRound.filter(
      (f) => f.status === "COMPLETED" && f.winnerTeamId === null,
    ).length;
    if (drawn > 0 && !blockedReason) {
      blockedReason = `${drawn} ${ROUND_LABEL[latest]} tie${
        drawn === 1 ? "" : "s"
      } ended level — add a decider before going on.`;
    }
    field = inRound
      .filter((f) => f.winnerTeamId !== null)
      .map((f, i) => ({ teamId: f.winnerTeamId!, rank: i + 1 }));
  }

  // Teams that advanced on a bye are already in the next round's fixtures,
  // so they are not re-added here; a bye writes a fixture-less advance below.
  const round = nextRoundFor(field.length);
  if (!round) {
    // Nothing left to play: either the league is decided, or nobody qualified.
    if (!blockedReason) {
      blockedReason =
        field.length === 1
          ? "The competition is decided."
          : "No teams qualify under the current rule.";
    }
    return {
      round: "FINAL",
      qualified: field.map((f) => ({
        teamId: f.teamId,
        teamName: nameOf.get(f.teamId) ?? "—",
        rank: f.rank,
      })),
      pairings: [],
      byeTeamId: null,
      byeTeamName: null,
      blockedReason,
      ambiguousCut: false,
      tiebreak: null,
    };
  }

  // Already generated? Then there is nothing to preview for this round.
  const existing = await prisma.leagueFixture.count({
    where: { leagueId, round, status: { not: "CANCELLED" } },
  });
  if (existing > 0 && !blockedReason) {
    blockedReason = `The ${ROUND_LABEL[round]} has already been drawn.`;
  }

  const { pairings, bye } = seedPairings(field.map((f) => f.teamId));

  return {
    round,
    qualified: field.map((f) => ({
      teamId: f.teamId,
      teamName: nameOf.get(f.teamId) ?? "—",
      rank: f.rank,
    })),
    pairings: pairings.map((p) => ({
      homeTeamId: p.homeTeamId,
      homeTeamName: nameOf.get(p.homeTeamId) ?? "—",
      awayTeamId: p.awayTeamId,
      awayTeamName: nameOf.get(p.awayTeamId) ?? "—",
    })),
    byeTeamId: bye,
    byeTeamName: bye ? (nameOf.get(bye) ?? null) : null,
    blockedReason,
    // A cut that HAS been settled by a decider is no longer ambiguous.
    ambiguousCut:
      latest === null && unresolvedTie(table, rule, decided) !== null,
    tiebreak:
      latest === null
        ? await tiebreakFor(leagueId, table, rule, nameOf, decided)
        : null,
  };
}

/**
 * The decider the host could schedule, when the cut is unresolvable.
 *
 * Returns null when the cut is clean — the overwhelmingly common case, and
 * the one where offering a play-off would be nonsense.
 */
async function tiebreakFor(
  leagueId: string,
  table: StandingEntry[],
  rule: QualificationRule,
  nameOf: Map<string, string>,
  decided: Set<string>,
): Promise<RoundPreview["tiebreak"]> {
  const contested = unresolvedTie(table, rule, decided);
  if (!contested) return null;

  const existing = await prisma.leagueFixture.count({
    where: { leagueId, round: "TIEBREAK", status: { not: "CANCELLED" } },
  });

  return {
    teams: contested.teamIds.map((teamId) => ({
      teamId,
      teamName: nameOf.get(teamId) ?? "—",
    })),
    places: contested.places,
    scheduled: existing > 0,
  };
}

/* -------------------------------------------------------------------------- */
/* Generating the next round                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Create the next round's fixtures from the preview.
 *
 * Host only, and it refuses whenever the preview is blocked — so a round
 * cannot be drawn while matches that would change who qualifies are still
 * being played.
 *
 * The generated fixtures inherit the league's defaults for clock and
 * difficulty and carry a single random problem per tie. The host can then
 * edit any of them exactly as they would a fixture they created by hand;
 * making the draw does not lock anything in.
 */
export async function generateNextRound(
  userId: string,
  leagueId: string,
  opts: { timeLimitSec?: number; difficulty?: "EASY" | "MEDIUM" | "HARD"; legs?: number } = {},
): Promise<{ round: LeagueRound; created: number; byeTeamId: string | null }> {
  const league = await requireHost(userId, leagueId);
  if (league.status === "FINISHED" || league.status === "CANCELLED") {
    throw conflict("LEAGUE_OVER", "This league is no longer running.");
  }

  const standings = await getStandings(leagueId);
  const preview = standings.preview;
  if (!preview) {
    throw conflict(
      "NO_RULE",
      "Set a qualification rule before drawing a knockout round.",
    );
  }
  if (preview.blockedReason) {
    throw conflict("NOT_READY", preview.blockedReason);
  }
  /*
   * An unresolvable tie at the qualification line BLOCKS the draw.
   *
   * When teams are level on every tie-break at the cut, more teams qualify
   * than there are places — and seeding that field produces a bracket that
   * looks authoritative but is not. In a 4-team league with a top-2 rule and
   * two teams level for second, drawing anyway pairs those two and hands the
   * GROUP WINNER a bye out of the final: the team that actually earned first
   * place is the one left out.
   *
   * The server cannot resolve this without inventing a result, so it refuses
   * and says what the host can do about it. Warning while still allowing the
   * draw was worse than useless: it produced exactly that unfair bracket
   * while implying someone had approved it.
   */
  if (preview.ambiguousCut) {
    throw conflict(
      "AMBIGUOUS_CUT",
      preview.tiebreak?.scheduled
        ? "The decider has not been played yet."
        : "Teams are level at the qualification line. Schedule a decider between them first.",
    );
  }
  if (preview.pairings.length === 0) {
    throw conflict("NOTHING_TO_DRAW", "There are no matches to draw.");
  }

  const legCount = Math.max(1, Math.min(5, opts.legs ?? 1));

  await prisma.$transaction(async (tx) => {
    for (const p of preview.pairings) {
      await tx.leagueFixture.create({
        data: {
          leagueId,
          round: preview.round,
          homeTeamId: p.homeTeamId,
          awayTeamId: p.awayTeamId,
          timeLimitSec: opts.timeLimitSec ?? 1800,
          difficulty: opts.difficulty ?? "MEDIUM",
          legs: {
            create: Array.from({ length: legCount }, (_, i) => ({
              ordinal: i + 1,
              problemId: null,
            })),
          },
        },
      });
    }
  });

  // Everyone drawn into the round, plus anyone advancing on a bye — a bye is
  // easy to miss precisely because there is no match to look at.
  const drawnIds: string[] = [];
  for (const p of preview.pairings) {
    drawnIds.push(...(await teamMembers(p.homeTeamId)));
    drawnIds.push(...(await teamMembers(p.awayTeamId)));
  }
  await notify({
    userIds: drawnIds,
    kind: "LEAGUE_ROUND_DRAWN",
    title: `The ${ROUND_LABEL[preview.round]} has been drawn`,
    body: `Your team is through in ${league.name}.`,
    link: `/leagues/${leagueId}`,
  });
  if (preview.byeTeamId) {
    await notify({
      userIds: await teamMembers(preview.byeTeamId),
      kind: "LEAGUE_ROUND_DRAWN",
      title: `You advance to the ${ROUND_LABEL[preview.round]}`,
      body: "The field is an odd number, so your team has a bye this round.",
      link: `/leagues/${leagueId}`,
    });
  }

  return {
    round: preview.round,
    created: preview.pairings.length,
    byeTeamId: preview.byeTeamId,
  };
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Teams that WON a decider.
 *
 * A play-off is the league saying "these two are level, so play for it". Its
 * winner takes the contested place; its loser does not. That is the whole
 * mechanism, and it is why the decider is its own round — counting it in the
 * group table would move the very points that made them level.
 */
function decidedTiebreaks(
  fixtures: { round: LeagueRound; status: string; winnerTeamId: string | null }[],
): Set<string> {
  return new Set(
    fixtures
      .filter(
        (f) =>
          f.round === "TIEBREAK" &&
          f.status === "COMPLETED" &&
          f.winnerTeamId !== null,
      )
      .map((f) => f.winnerTeamId!),
  );
}

/**
 * A tie at the cut that has NOT yet been settled by a decider.
 *
 * Once a play-off has produced a winner from the tied group, the cut is
 * resolved and this returns null — which is what lets the draw proceed.
 */
function unresolvedTie(
  table: StandingEntry[],
  rule: QualificationRule,
  decided: Set<string>,
): { teamIds: string[]; places: number } | null {
  const contested = contestedPlaces(table, rule);
  if (!contested) return null;

  // Enough of the tied teams have won deciders to fill the contested places.
  const settled = contested.teamIds.filter((id) => decided.has(id)).length;
  return settled >= contested.places ? null : contested;
}

/**
 * Who actually qualifies, once deciders are taken into account.
 *
 * The pure `qualifyingTeams` deliberately returns EVERY team level at the cut
 * rather than guessing between them. This is the layer that applies the
 * answer the teams produced on the field: among a tied group, the ones who
 * won their decider go through and the rest do not.
 *
 * With no decider played, this is exactly `qualifyingTeams` — so a league
 * that never has a tie never touches any of this.
 */
function resolveQualifiers(
  table: StandingEntry[],
  rule: QualificationRule,
  decided: Set<string>,
): StandingEntry[] {
  const qualified = qualifyingTeams(table, rule);
  const contested = contestedPlaces(table, rule);
  if (!contested) return qualified;

  const winners = contested.teamIds.filter((id) => decided.has(id));
  // The play-off has not produced enough winners yet: report the honest,
  // over-full field rather than silently dropping someone.
  if (winners.length < contested.places) return qualified;

  const tied = new Set(contested.teamIds);
  const through = new Set(winners.slice(0, contested.places));
  return qualified.filter((r) => !tied.has(r.teamId) || through.has(r.teamId));
}

/** The league's qualification rule, or null when it has none. */
function ruleOf(league: {
  qualifyMode: "TOP_N" | "WIN_COUNT" | null;
  qualifyValue: number | null;
}): QualificationRule | null {
  if (!league.qualifyMode || league.qualifyValue === null) return null;
  return { mode: league.qualifyMode, value: league.qualifyValue };
}

/**
 * The furthest knockout round that has any fixtures, or null when only the
 * group stage exists.
 */
function latestKnockoutRound(
  rounds: LeagueRound[],
): Exclude<LeagueRound, "GROUP"> | null {
  const order: Exclude<LeagueRound, "GROUP">[] = [
    "QUARTER_FINAL",
    "SEMI_FINAL",
    "FINAL",
  ];
  let latest: Exclude<LeagueRound, "GROUP"> | null = null;
  for (const r of order) {
    if (rounds.includes(r)) latest = r;
  }
  return latest;
}

/** Who won the final, if a final has been decided. */
function findChampion(
  fixtures: { round: LeagueRound; status: string; winnerTeamId: string | null }[],
): { teamId: string } | null {
  const final = fixtures.find(
    (f) =>
      f.round === "FINAL" &&
      f.status === "COMPLETED" &&
      f.winnerTeamId !== null,
  );
  return final ? { teamId: final.winnerTeamId! } : null;
}

const ROUND_LABEL: Record<LeagueRound, string> = {
  GROUP: "group",
  TIEBREAK: "decider",
  QUARTER_FINAL: "quarter-final",
  SEMI_FINAL: "semi-final",
  FINAL: "final",
};


/* -------------------------------------------------------------------------- */
/* Deciders                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Schedule a play-off between the teams left level at the qualification line.
 *
 * This is the answer to a tie the table cannot break. Rather than the server
 * picking a team — which would be inventing a result — or the host picking one
 * — which would be overruling teams that were never beaten — the teams settle
 * it by playing, which is how every real tournament does it.
 *
 * Created as its own TIEBREAK round so it cannot contaminate the group table
 * it exists to resolve.
 */
export async function scheduleTiebreak(
  userId: string,
  leagueId: string,
  opts: { timeLimitSec?: number; difficulty?: "EASY" | "MEDIUM" | "HARD" } = {},
): Promise<{ created: number }> {
  const league = await requireHost(userId, leagueId);
  if (league.status === "FINISHED" || league.status === "CANCELLED") {
    throw conflict("LEAGUE_OVER", "This league is no longer running.");
  }

  const standings = await getStandings(leagueId);
  const tiebreak = standings.preview?.tiebreak;
  if (!tiebreak) {
    throw conflict(
      "NO_TIEBREAK",
      "Nothing is tied at the qualification line.",
    );
  }
  if (tiebreak.scheduled) {
    throw conflict("ALREADY_SCHEDULED", "The decider is already scheduled.");
  }

  /*
   * Pair the tied teams round-robin.
   *
   * Two teams is the common case and gives exactly one match. Three or more
   * level teams need a mini-league between them — pairing only two would
   * leave the third with no way to earn the place it is equally entitled to.
   */
  const ids = tiebreak.teams.map((t) => t.teamId);
  const pairs: [string, string][] = [];
  for (let i = 0; i < ids.length; i++) {
    for (let k = i + 1; k < ids.length; k++) {
      pairs.push([ids[i]!, ids[k]!]);
    }
  }

  await prisma.$transaction(async (tx) => {
    for (const [home, away] of pairs) {
      await tx.leagueFixture.create({
        data: {
          leagueId,
          round: "TIEBREAK",
          homeTeamId: home,
          awayTeamId: away,
          timeLimitSec: opts.timeLimitSec ?? 1800,
          difficulty: opts.difficulty ?? "MEDIUM",
          legs: { create: [{ ordinal: 1, problemId: null }] },
        },
      });
    }
  });

  await notify({
    userIds: (
      await Promise.all(ids.map((id) => teamMembers(id)))
    ).flat(),
    kind: "LEAGUE_TIEBREAK_SCHEDULED",
    title: "You are in a decider",
    body: `Your team finished level at the qualification line in ${league.name}. Win the decider to go through.`,
    link: `/leagues/${leagueId}`,
  });

  return { created: pairs.length };
}
