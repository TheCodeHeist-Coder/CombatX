/**
 * What a finished battle does to the players' records.
 *
 * Split out of battleRoom because it is the one place three separate systems
 * meet — XP, Glicko-2 rating, and badges — and each has different rules about
 * when it may move:
 *
 *   XP      every battle, room-code or ranked. Volume, so it always pays.
 *   Rating  RANKED battles only. Zero-sum, so it must never be farmable.
 *   Badges  evaluated every battle, but awarded once and never revoked.
 *
 * All the arithmetic is imported from @repo/game. This module decides only
 * what to read, what to write, and in what order.
 */

import {
  computeAward,
  describeBadge,
  rateOneOnOne,
  ruleMet,
  TIERS,
  tierFor,
  UPSET_GAP,
  type BadgeRule,
  type RatingState,
} from "@repo/game";
import { activeRules } from "./badgeRules.js";
import { activeSeasonId } from "./season.js";
import { prisma, type Prisma } from "@repo/db";
import type {
  Difficulty,
  FinishReason,
  ProgressionAward,
  Side,
  StandingRow,
} from "@repo/protocol";

type PrismaPromise<T> = Prisma.PrismaPromise<T>;

/** A seated player, as the room knows them. */
export interface SeatedPlayer {
  userId: string;
  side: Side | null;
}

export interface ProgressionInput {
  battleId: string;
  isRanked: boolean;
  difficulty: Difficulty;
  reason: FinishReason;
  winnerSide: Side | null;
  standings: StandingRow[];
  seats: SeatedPlayer[];
  problemId: string | null;
}

/** The columns this module reads for each player. */
const PLAYER_SELECT = {
  id: true,
  xp: true,
  winStreak: true,
  bestStreak: true,
  rating: true,
  ratingRd: true,
  ratingVolatility: true,
  rankedBattles: true,
  peakRating: true,
  wins: true,
  losses: true,
  draws: true,
  upsetWins: true,
  perfectWins: true,
  easyWins: true,
  mediumWins: true,
  hardWins: true,
  distinctProblemsWon: true,
  signupOrdinal: true,
  battlesToday: true,
  xpDay: true,
  createdAt: true,
  approvedProblems: true,
} as const;

/** UTC day key for the anti-grind counter. */
function dayKey(now: Date): string {
  return now.toISOString().slice(0, 10);
}

const MS_PER_DAY = 86_400_000;

/**
 * Grant everything a finished battle is worth, and return the per-player
 * breakdown for the results screen.
 *
 * Best-effort by contract: the caller broadcasts the finish regardless, so a
 * failure here must never leave players staring at a battle that never ended.
 */
export async function applyProgression(
  input: ProgressionInput,
): Promise<ProgressionAward[]> {
  const competitors = input.seats.filter(
    (s): s is SeatedPlayer & { side: Side } => s.side !== null,
  );
  if (competitors.length === 0) return [];

  const now = new Date();
  const today = dayKey(now);
  const bySide = new Map(input.standings.map((s) => [s.side, s]));

  const users = await prisma.user.findMany({
    where: { id: { in: competitors.map((s) => s.userId) } },
    select: PLAYER_SELECT,
  });
  const byId = new Map(users.map((u) => [u.id, u]));

  // Badges already held, so an award is never written twice.
  const heldRows = await prisma.userBadge.findMany({
    where: { userId: { in: competitors.map((s) => s.userId) } },
    select: { userId: true, badgeKey: true },
  });
  const heldByUser = new Map<string, string[]>();
  for (const row of heldRows) {
    const list = heldByUser.get(row.userId) ?? [];
    list.push(row.badgeKey);
    heldByUser.set(row.userId, list);
  }

  /**
   * Rating is only computed for a ranked 1v1 with two distinct competitors.
   *
   * Glicko-2 is defined over pairs. A team battle would need each player rated
   * against every opponent, which is a real design question (does a carried
   * player gain as much as the carrier?) rather than an implementation detail,
   * so team modes stay unrated until that is answered rather than being given
   * an arbitrary formula.
   */
  const ratable =
    input.isRanked &&
    input.reason !== "FORFEIT" &&
    competitors.length === 2 &&
    competitors[0]!.side !== competitors[1]!.side;

  // Which problems each player had already won, for distinctProblemsWon.
  const firstWinOn = new Map<string, boolean>();
  if (input.problemId) {
    const winners = competitors.filter(
      (s) => input.winnerSide != null && s.side === input.winnerSide,
    );
    for (const w of winners) {
      // Only a FIRST win on this problem advances the counter, so replaying
      // the same problem cannot inflate "distinct problems won".
      const priorWins = await countWinsOnProblem(
        w.userId,
        input.problemId,
        input.battleId,
      );
      firstWinOn.set(w.userId, priorWins === 0);
    }
  }

  // Admin-editable rules, cached in badgeRules.ts. Read once per battle
  // rather than per player.
  const rules = await activeRules();
  // Resolved once per battle, not per player: every seat in a battle is in
  // the same season by definition.
  const seasonId = await activeSeasonId();

  const awards: ProgressionAward[] = [];
  // Prisma's $transaction is overloaded; the array form needs an explicit
  // element type or TypeScript resolves to the interactive callback overload.
  const writes: PrismaPromise<unknown>[] = [];

  for (const seat of competitors) {
    const before = byId.get(seat.userId);
    if (!before) continue;

    const row = bySide.get(seat.side);
    const won = input.winnerSide != null && seat.side === input.winnerSide;
    const drew = input.winnerSide === null;

    // Reset the daily counter lazily on the first battle of a new day, so no
    // scheduled job is needed to keep the taper honest.
    const battlesToday = before.xpDay === today ? before.battlesToday : 0;

    const award = computeAward({
      won,
      passed: row?.bestPassed ?? 0,
      total: row?.total ?? 0,
      previousStreak: before.winStreak,
      difficulty: input.difficulty,
      reason: input.reason,
      battlesToday,
    });

    // --- Rating -------------------------------------------------------------
    let ratingUpdate: Record<string, unknown> = {};
    let ratingDelta: ProgressionAward["rating"] = null;

    if (ratable) {
      const opponentSeat = competitors.find((s) => s.userId !== seat.userId)!;
      const opponentRow = byId.get(opponentSeat.userId);

      if (opponentRow) {
        const self = stateOf(before);
        const opponent = stateOf(opponentRow);
        const score = drew ? 0.5 : won ? 1 : 0;

        const change = rateOneOnOne(self, opponent, score);
        const tierBefore = tierFor(self);
        const tierAfter = tierFor(change.after);

        ratingUpdate = {
          rating: change.after.rating,
          ratingRd: change.after.rd,
          ratingVolatility: change.after.volatility,
          rankedBattles: { increment: 1 },
          peakRating: Math.max(before.peakRating, change.after.rating),
        };

        ratingDelta = {
          before: Math.round(change.before.rating),
          after: Math.round(change.after.rating),
          delta: change.delta,
          rdBefore: Math.round(change.before.rd),
          rdAfter: Math.round(change.after.rd),
          tierBefore: tierBefore?.key ?? null,
          tierAfter: tierAfter?.key ?? null,
        };

        // An upset is a win over someone meaningfully stronger. Measured on
        // the ratings BEFORE the battle, which is the only honest comparison.
        const isUpset = won && opponent.rating - self.rating >= UPSET_GAP;
        if (isUpset) {
          ratingUpdate.upsetWins = { increment: 1 };
        }

        writes.push(
          prisma.ratingHistory.create({
            data: {
              userId: seat.userId,
              battleId: input.battleId,
              ratingBefore: change.before.rating,
              ratingAfter: change.after.rating,
              rdBefore: change.before.rd,
              rdAfter: change.after.rd,
              delta: change.after.rating - change.before.rating,
              opponentRating: opponent.rating,
              score,
              seasonId,
            },
          }),
        );
      }
    }

    // --- Counters -----------------------------------------------------------
    const counters: Record<string, unknown> = {};
    if (won) {
      counters.wins = { increment: 1 };
      if (award.perfect) counters.perfectWins = { increment: 1 };
      if (input.difficulty === "EASY") counters.easyWins = { increment: 1 };
      if (input.difficulty === "MEDIUM") counters.mediumWins = { increment: 1 };
      if (input.difficulty === "HARD") counters.hardWins = { increment: 1 };
      if (firstWinOn.get(seat.userId)) {
        counters.distinctProblemsWon = { increment: 1 };
      }
    } else if (drew) {
      counters.draws = { increment: 1 };
    } else {
      counters.losses = { increment: 1 };
    }

    const newBestStreak = Math.max(before.bestStreak, award.newStreak);

    writes.push(
      prisma.user.update({
        where: { id: seat.userId },
        data: {
          xp: { increment: award.xp },
          winStreak: award.newStreak,
          bestStreak: newBestStreak,
          lastBattleAt: now,
          battlesToday: battlesToday + 1,
          xpDay: today,
          ...counters,
          ...ratingUpdate,
        },
      }),
    );

    // --- Badges -------------------------------------------------------------
    // Evaluated against the state AFTER this battle, projected locally: the
    // writes above have not committed yet, and re-reading inside the same
    // transaction would not see them either.
    const projected = project(before, {
      award,
      won,
      drew,
      perfect: award.perfect,
      difficulty: input.difficulty,
      newBestStreak,
      ratingAfter: ratingDelta
        ? { rating: ratingDelta.after, rd: ratingDelta.rdAfter }
        : null,
      rankedBattlesAfter: ratable ? before.rankedBattles + 1 : before.rankedBattles,
      firstWinOnProblem: firstWinOn.get(seat.userId) === true,
      upset: ratingUpdate.upsetWins !== undefined,
      now,
    });

    const alreadyHeld = new Set(heldByUser.get(seat.userId) ?? []);
    const fresh = rules
      .filter((r) => !alreadyHeld.has(r.key) && ruleMet(r, projected))
      .map(toBadgeView);
    for (const badge of fresh) {
      writes.push(
        prisma.userBadge.create({
          data: {
            userId: seat.userId,
            badgeKey: badge.key,
            battleId: input.battleId,
          },
        }),
      );
    }

    awards.push({
      userId: seat.userId,
      xp: award.xp,
      baseXp: award.baseXp,
      multiplier: award.multiplier,
      difficultyWeight: award.difficultyWeight,
      taper: award.taper,
      newStreak: award.newStreak,
      perfect: award.perfect,
      totalXp: before.xp + award.xp,
      rating: ratingDelta,
      // count 1: the battle path only ever awards a badge for the first time.
      // Repeatable badges are authoring ones, granted by http-api at approval.
      newBadges: fresh.map((b) => ({
        ...b,
        earnedAt: now.toISOString(),
        count: 1,
      })),
    });
  }

  await prisma.$transaction(writes);
  return awards;
}

/** How many finished battles this user WON on a given problem, excluding one. */
async function countWinsOnProblem(
  userId: string,
  problemId: string,
  excludeBattleId: string,
): Promise<number> {
  const battles = await prisma.battle.findMany({
    where: {
      id: { not: excludeBattleId },
      assignedProblemId: problemId,
      status: "FINISHED",
      winnerSide: { not: null },
      teams: { some: { members: { some: { userId } } } },
    },
    select: {
      winnerSide: true,
      teams: {
        select: { side: true, members: { select: { userId: true } } },
      },
    },
  });

  return battles.filter((b) =>
    b.teams.some(
      (t) =>
        t.side === b.winnerSide && t.members.some((m) => m.userId === userId),
    ),
  ).length;
}

type PlayerRow = {
  rating: number;
  ratingRd: number;
  ratingVolatility: number;
};

function stateOf(row: PlayerRow): RatingState {
  return {
    rating: row.rating,
    rd: row.ratingRd,
    volatility: row.ratingVolatility,
  };
}

/**
 * Project a player's badge context to what it will be once the writes land.
 *
 * Necessary because badges are evaluated in the same pass that produces the
 * updates, so the database still holds the pre-battle values. Getting this
 * wrong would delay every badge by exactly one battle.
 */
/** A stored rule, flattened for the wire. */
function toBadgeView(rule: BadgeRule) {
  return describeBadge({
    key: rule.key,
    label: rule.label,
    description: rule.description,
    category: rule.category as never,
    rarity: rule.rarity as never,
    glyph: rule.glyph,
    earned: () => true,
  });
}

function project(
  before: {
    wins: number;
    losses: number;
    draws: number;
    xp: number;
    bestStreak: number;
    upsetWins: number;
    perfectWins: number;
    easyWins: number;
    mediumWins: number;
    hardWins: number;
    distinctProblemsWon: number;
    signupOrdinal: number;
    rating: number;
    ratingRd: number;
    ratingVolatility: number;
    rankedBattles: number;
    createdAt: Date;
    approvedProblems: number;
  },
  d: {
    award: { xp: number };
    won: boolean;
    drew: boolean;
    perfect: boolean;
    difficulty: Difficulty;
    newBestStreak: number;
    ratingAfter: { rating: number; rd: number } | null;
    rankedBattlesAfter: number;
    firstWinOnProblem: boolean;
    upset: boolean;
    now: Date;
  },
) {
  const win = d.won ? 1 : 0;
  const rating = d.ratingAfter
    ? {
        rating: d.ratingAfter.rating,
        rd: d.ratingAfter.rd,
        volatility: before.ratingVolatility,
      }
    : stateOf(before);
  const tier = tierFor(rating);
  return {
    wins: before.wins + win,
    losses: before.losses + (!d.won && !d.drew ? 1 : 0),
    draws: before.draws + (d.drew ? 1 : 0),
    xp: before.xp + d.award.xp,
    bestStreak: d.newBestStreak,
    rankedBattles: d.rankedBattlesAfter,
    rating,
    tierIndex: tier ? TIERS.findIndex((t) => t.key === tier.key) : -1,
    upsetWins: before.upsetWins + (d.upset ? 1 : 0),
    perfectWins: before.perfectWins + (d.won && d.perfect ? 1 : 0),
    easyWins: before.easyWins + (d.won && d.difficulty === "EASY" ? 1 : 0),
    mediumWins: before.mediumWins + (d.won && d.difficulty === "MEDIUM" ? 1 : 0),
    hardWins: before.hardWins + (d.won && d.difficulty === "HARD" ? 1 : 0),
    distinctProblemsWon:
      before.distinctProblemsWon + (d.won && d.firstWinOnProblem ? 1 : 0),
    signupOrdinal: before.signupOrdinal,
    accountAgeDays: Math.max(
      0,
      Math.floor((d.now.getTime() - before.createdAt.getTime()) / MS_PER_DAY),
    ),
    // A battle cannot change how many problems someone has authored, so this
    // carries through untouched. Authoring badges are awarded at approval
    // time by http-api, not here.
    approvedProblemsAuthored: before.approvedProblems,
  };
}
