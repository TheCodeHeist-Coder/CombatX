/**
 * Shaping raw rating and badge rows into their wire views.
 *
 * The arithmetic lives in @repo/game (pure, tested); this module only
 * translates. Both the profile, the public profile and the leaderboard go
 * through here so a rating is described identically everywhere — a tier shown
 * on a profile and the same tier shown on the ladder cannot drift apart.
 */

import {
  badgeByKey,
  badgeProgress,
  conservativeRating,
  describeBadge,
  isProvisional,
  tierFor,
  tierProgress,
  type BadgeContext,
  type RatingState,
} from "@repo/game";
import type {
  BadgeProgressView,
  BadgeView,
  RatingView,
} from "@repo/protocol";

/** The rating columns as they come back from Prisma. */
export interface RatingColumns {
  rating: number;
  ratingRd: number;
  rankedBattles: number;
  peakRating: number;
  ratingVolatility?: number;
}

/** Columns every rating projection needs. Spread into a Prisma `select`. */
export const RATING_SELECT = {
  rating: true,
  ratingRd: true,
  ratingVolatility: true,
  rankedBattles: true,
  peakRating: true,
} as const;

/** Columns the badge evaluator needs, beyond the rating ones. */
export const BADGE_STAT_SELECT = {
  wins: true,
  losses: true,
  xp: true,
  bestStreak: true,
  upsetWins: true,
  perfectWins: true,
  easyWins: true,
  mediumWins: true,
  hardWins: true,
  distinctProblemsWon: true,
  signupOrdinal: true,
  createdAt: true,
} as const;

/** Prisma columns -> the pure RatingState the game package works in. */
export function toRatingState(row: RatingColumns): RatingState {
  return {
    rating: row.rating,
    rd: row.ratingRd,
    volatility: row.ratingVolatility ?? 0.06,
  };
}

/**
 * Build the client's view of a rating.
 *
 * Ratings are rounded here and only here. Storing a float and displaying an
 * integer is deliberate: rounding on write would compound drift across
 * hundreds of battles, while showing "1523.4471" to a player is noise.
 */
export function toRatingView(row: RatingColumns): RatingView {
  const state = toRatingState(row);
  const tier = tierFor(state);
  return {
    rating: Math.round(state.rating),
    rd: Math.round(state.rd),
    conservative: Math.round(conservativeRating(state)),
    provisional: isProvisional(state.rd),
    rankedBattles: row.rankedBattles,
    peakRating: Math.round(row.peakRating),
    tier: tier?.key ?? null,
    tierLabel: tier?.label ?? null,
    tierProgress: tierProgress(state),
  };
}

/** The stat columns the badge evaluator reads. */
export interface BadgeStatColumns extends RatingColumns {
  wins: number;
  losses: number;
  xp: number;
  bestStreak: number;
  upsetWins: number;
  perfectWins: number;
  easyWins: number;
  mediumWins: number;
  hardWins: number;
  distinctProblemsWon: number;
  signupOrdinal: number;
  createdAt: Date;
}

const MS_PER_DAY = 86_400_000;

/** Assemble the pure BadgeContext from a user row. */
export function toBadgeContext(
  row: BadgeStatColumns,
  now = new Date(),
): BadgeContext {
  return {
    wins: row.wins,
    losses: row.losses,
    xp: row.xp,
    bestStreak: row.bestStreak,
    rankedBattles: row.rankedBattles,
    rating: toRatingState(row),
    upsetWins: row.upsetWins,
    perfectWins: row.perfectWins,
    easyWins: row.easyWins,
    mediumWins: row.mediumWins,
    hardWins: row.hardWins,
    distinctProblemsWon: row.distinctProblemsWon,
    signupOrdinal: row.signupOrdinal,
    accountAgeDays: Math.max(
      0,
      Math.floor((now.getTime() - row.createdAt.getTime()) / MS_PER_DAY),
    ),
  };
}

/** A persisted badge row. */
export interface BadgeRow {
  badgeKey: string;
  earnedAt: Date;
}

/**
 * Turn stored badge rows into wire views.
 *
 * A row whose key is no longer in the table is skipped rather than rendered
 * blank: badges are permanent for the holder, but a badge that was removed
 * from the definitions has no label or glyph left to draw with. Keeping the
 * row means it comes back if the definition is ever restored.
 */
export function toBadgeViews(rows: readonly BadgeRow[]): BadgeView[] {
  const out: BadgeView[] = [];
  for (const row of rows) {
    const def = badgeByKey(row.badgeKey);
    if (!def) continue;
    out.push({ ...describeBadge(def), earnedAt: row.earnedAt.toISOString() });
  }
  return out;
}

/**
 * The full shelf: every badge, with earned state and progress.
 *
 * Earned state comes from the PERSISTED rows, not from re-evaluating the
 * definitions, so a badge stays earned even if its threshold is later raised.
 * Progress still comes from the live context, because a locked badge's bar
 * should track the player's current standing.
 */
export function toBadgeShelf(
  context: BadgeContext,
  held: readonly BadgeRow[],
): BadgeProgressView[] {
  const heldAt = new Map(held.map((r) => [r.badgeKey, r.earnedAt]));
  return badgeProgress(context).map((b) => {
    const earnedAt = heldAt.get(b.key);
    return {
      key: b.key,
      label: b.label,
      description: b.description,
      category: b.category,
      rarity: b.rarity,
      glyph: b.glyph,
      earnedAt: earnedAt ? earnedAt.toISOString() : null,
      earned: earnedAt !== undefined || b.earned,
      progress: b.progress,
    };
  });
}

/** Rarity order, strongest first — for trimming a leaderboard row's badges. */
const RARITY_RANK: Record<string, number> = {
  LEGENDARY: 0,
  RARE: 1,
  UNCOMMON: 2,
  COMMON: 3,
};

/**
 * The few badges worth showing on a compact row.
 *
 * Rarest first, so a leaderboard shows what distinguishes a player rather than
 * the First Blood that everyone has.
 */
export function topBadges(badges: BadgeView[], limit = 3): BadgeView[] {
  return [...badges]
    .sort(
      (a, b) =>
        (RARITY_RANK[a.rarity] ?? 9) - (RARITY_RANK[b.rarity] ?? 9),
    )
    .slice(0, limit);
}
