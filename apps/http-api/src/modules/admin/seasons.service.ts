/**
 * Seasons — closing one ladder and opening the next.
 *
 * WHY SEASONS EXIST
 * -----------------
 * A rating that never resets stops being a competition and becomes a record of
 * who arrived first. Someone who peaked in month one keeps their standing
 * whether or not they still play, and a newcomer cannot catch them without
 * beating people who have stopped showing up. Seasons put a floor under that:
 * the ladder reopens, and the old result is preserved rather than overwritten.
 *
 * WHAT A ROLLOVER DOES AND DOES NOT TOUCH
 * ---------------------------------------
 * It SOFTENS ratings (see softReset in @repo/game): pulls each one 35% toward
 * the 1500 origin and widens the deviation, so order is preserved but the gaps
 * close and everyone must re-prove themselves a little.
 *
 * It does NOT touch career XP, badges, win/loss totals or streaks. Those are
 * HISTORY — statements about what happened, which a new season does not
 * un-happen. Only the rating is a claim about the present, and only the present
 * needs resetting.
 *
 * The standings snapshot is taken BEFORE the softening, because it is the
 * record of how the season actually ended.
 */

import { prisma } from "@repo/db";
import {
  conservativeRating,
  isPlaced,
  softReset,
  tierFor,
  type RatingState,
} from "@repo/game";
import { conflict, notFound } from "../../http/errors.js";

/**
 * How hard a rollover pulls ratings toward the origin.
 *
 * 0 would carry ratings over untouched (no reset at all); 1 would flatten
 * everyone to 1500 and throw away every distinction earned. 0.35 is the
 * default in @repo/game and keeps the ORDER of the ladder while closing the
 * gaps enough that a strong newcomer can climb within a season.
 */
const SEASON_PULL = 0.35;

export interface SeasonRow {
  id: string;
  name: string;
  startedAt: string;
  endedAt: string | null;
  isActive: boolean;
  /** How many players were ranked when it closed; 0 while it is running. */
  standings: number;
}

function toRow(s: {
  id: string;
  name: string;
  startedAt: Date;
  endedAt: Date | null;
  isActive: boolean;
  _count: { standings: number };
}): SeasonRow {
  return {
    id: s.id,
    name: s.name,
    startedAt: s.startedAt.toISOString(),
    endedAt: s.endedAt?.toISOString() ?? null,
    isActive: s.isActive,
    standings: s._count.standings,
  };
}

/** Every season, newest first. */
export async function listSeasons(): Promise<SeasonRow[]> {
  const rows = await prisma.season.findMany({
    orderBy: { startedAt: "desc" },
    include: { _count: { select: { standings: true } } },
  });
  return rows.map(toRow);
}

/** The season currently running, or null when none has been started. */
export async function activeSeason(): Promise<SeasonRow | null> {
  const s = await prisma.season.findFirst({
    where: { isActive: true },
    include: { _count: { select: { standings: true } } },
  });
  return s ? toRow(s) : null;
}

/**
 * Open a new season.
 *
 * Refuses while one is already running: two active seasons would make
 * "which season is this battle in?" unanswerable, and the rating history's
 * seasonId would start pointing at whichever row happened to be found first.
 */
export async function startSeason(name: string): Promise<SeasonRow> {
  const trimmed = name.trim();
  if (trimmed.length < 2) {
    throw conflict("NAME_REQUIRED", "Give the season a name.");
  }

  const running = await prisma.season.findFirst({ where: { isActive: true } });
  if (running) {
    throw conflict(
      "SEASON_RUNNING",
      `"${running.name}" is still running. End it before starting another.`,
    );
  }

  const season = await prisma.season.create({
    data: { name: trimmed, isActive: true },
    include: { _count: { select: { standings: true } } },
  });
  return toRow(season);
}

export interface RolloverResult {
  closed: SeasonRow;
  /** The season opened in its place, when one was requested. */
  opened: SeasonRow | null;
  /** How many players were recorded in the final standings. */
  ranked: number;
  /** How many players had their rating softened. */
  softened: number;
  /** The top three, for the admin's confirmation message. */
  podium: { rank: number; username: string; rating: number; tier: string }[];
}

/**
 * Close the running season: snapshot the standings, then soften every rating.
 *
 * ORDER MATTERS. The snapshot has to happen before the reset, or the archive
 * would record everyone's post-reset rating and the season would appear to have
 * ended with the whole ladder compressed toward 1500.
 *
 * Only PLACED players get a standing. An unplaced rating is one we have said
 * publicly we do not trust, and writing it into a permanent archive would
 * publish exactly the number the placement gate exists to withhold. They are
 * still softened — the reset applies to everyone.
 */
export async function endSeason(
  seasonId: string,
  nextName?: string,
): Promise<RolloverResult> {
  const season = await prisma.season.findUnique({ where: { id: seasonId } });
  if (!season) throw notFound("No such season.");
  if (!season.isActive) {
    throw conflict("SEASON_CLOSED", "That season has already ended.");
  }

  const players = await prisma.user.findMany({
    where: { isGuest: false },
    select: {
      id: true,
      username: true,
      rating: true,
      ratingRd: true,
      ratingVolatility: true,
      rankedBattles: true,
      wins: true,
      losses: true,
      xp: true,
    },
  });

  // --- 1. Rank the placed players, exactly as the leaderboard does ---------
  const ranked = players
    .map((p) => {
      const state: RatingState = {
        rating: p.rating,
        rd: p.ratingRd,
        volatility: p.ratingVolatility,
      };
      return { p, state, sort: conservativeRating(state) };
    })
    .filter((r) => isPlaced(r.state, r.p.rankedBattles))
    // Conservative rating, so a lucky unproven run cannot take the crown.
    .sort((a, b) => b.sort - a.sort);

  const standings = ranked.map((r, i) => {
    const tier = tierFor(r.state, r.p.rankedBattles);
    return {
      seasonId,
      userId: r.p.id,
      rank: i + 1,
      rating: r.state.rating,
      rd: r.state.rd,
      // Denormalised: the archive must still read correctly if the tier
      // thresholds are retuned later.
      tier: tier?.key ?? "IOTA",
      wins: r.p.wins,
      losses: r.p.losses,
      rankedBattles: r.p.rankedBattles,
      xpEarned: r.p.xp,
    };
  });

  // --- 2. Soften every rating, placed or not ------------------------------
  const resets = players.map((p) => {
    const after = softReset(
      { rating: p.rating, rd: p.ratingRd, volatility: p.ratingVolatility },
      SEASON_PULL,
    );
    return prisma.user.update({
      where: { id: p.id },
      data: {
        rating: after.rating,
        ratingRd: after.rd,
        ratingVolatility: after.volatility,
        // Ranked battles reset so the placement gate applies again: a widened
        // deviation alone would let a heavy veteran stay "placed" on day one
        // of a season they have not played.
        rankedBattles: 0,
        // peakRating is career-best and deliberately survives, as do xp, wins,
        // losses, streaks and every badge. Those are history, not standing.
      },
    });
  });

  // One transaction: a crash between the snapshot and the reset would leave
  // the season closed with the ladder un-reset, or reset with no archive.
  await prisma.$transaction([
    ...(standings.length > 0
      ? [prisma.seasonStanding.createMany({ data: standings })]
      : []),
    ...resets,
    prisma.season.update({
      where: { id: seasonId },
      data: { isActive: false, endedAt: new Date() },
    }),
  ]);

  const closed = await prisma.season.findUniqueOrThrow({
    where: { id: seasonId },
    include: { _count: { select: { standings: true } } },
  });

  const opened = nextName?.trim() ? await startSeason(nextName) : null;

  return {
    closed: toRow(closed),
    opened,
    ranked: standings.length,
    softened: players.length,
    podium: standings.slice(0, 3).map((s, i) => ({
      rank: s.rank,
      username: ranked[i]!.p.username,
      rating: Math.round(s.rating),
      tier: s.tier,
    })),
  };
}

export interface StandingRow {
  rank: number;
  userId: string;
  username: string;
  rating: number;
  tier: string;
  wins: number;
  losses: number;
  rankedBattles: number;
}

/** The final table for one closed season. */
export async function seasonStandings(
  seasonId: string,
  limit = 100,
): Promise<StandingRow[]> {
  const rows = await prisma.seasonStanding.findMany({
    where: { seasonId },
    orderBy: { rank: "asc" },
    take: Math.min(limit, 500),
    include: { user: { select: { username: true } } },
  });

  return rows.map((r) => ({
    rank: r.rank,
    userId: r.userId,
    username: r.user.username,
    rating: Math.round(r.rating),
    tier: r.tier,
    wins: r.wins,
    losses: r.losses,
    rankedBattles: r.rankedBattles,
  }));
}
