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
  conservativeRating,
  isPlaced,
  tierFor,
  tierProgress,
  type BadgeContext,
  type RatingState,
} from "@repo/game";
import {
  describeBadge,
  ruleMet,
  ruleProgress,
  TIERS,
  type BadgeRule,
  type RuleContext,
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
  draws: true,
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
  approvedProblems: true,
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
  const tier = tierFor(state, row.rankedBattles);
  return {
    rating: Math.round(state.rating),
    rd: Math.round(state.rd),
    conservative: Math.round(conservativeRating(state)),
    // "Provisional" is the inverse of placed, not the raw RD test: a player
    // who has fought the placement quota is published even if their deviation
    // is still wide (see isPlaced — an unbeaten record never settles).
    provisional: !isPlaced(state, row.rankedBattles),
    rankedBattles: row.rankedBattles,
    peakRating: Math.round(row.peakRating),
    tier: tier?.key ?? null,
    tierLabel: tier?.label ?? null,
    tierProgress: tierProgress(state, row.rankedBattles),
  };
}

/** The stat columns the badge evaluator reads. */
export interface BadgeStatColumns extends RatingColumns {
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
  createdAt: Date;
  approvedProblems: number;
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
    approvedProblemsAuthored: row.approvedProblems,
  };
}

/**
 * Assemble the RuleContext the admin-editable rules evaluate against.
 *
 * Separate from toBadgeContext, which feeds the legacy hard-coded evaluator.
 * Both read the same columns; this one also carries `draws` and the tier index
 * that declarative rules can test.
 */
export function toRuleContext(
  row: BadgeStatColumns,
  now = new Date(),
): RuleContext {
  const rating = toRatingState(row);
  const tier = tierFor(rating);
  return {
    wins: row.wins,
    losses: row.losses,
    draws: row.draws,
    xp: row.xp,
    bestStreak: row.bestStreak,
    rankedBattles: row.rankedBattles,
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
    approvedProblemsAuthored: row.approvedProblems,
    rating,
    tierIndex: tier ? TIERS.findIndex((t) => t.key === tier.key) : -1,
  };
}

/** A persisted badge row. */
export interface BadgeRow {
  badgeKey: string;
  earnedAt: Date;
  /**
   * Times earned, for a repeatable badge — the "x2" on the medal.
   *
   * REQUIRED, not optional. Making it optional let four call sites select the
   * row without it and silently report every badge as x1; the compiler had
   * nothing to object to. A required field means forgetting the column is a
   * build error instead of a wrong number on a profile.
   */
  count: number;
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
    out.push({
      ...describeBadge(def),
      earnedAt: row.earnedAt.toISOString(),
      count: row.count ?? 1,
    });
  }
  return out;
}

/**
 * The full shelf: every badge, with earned state and progress.
 *
 * Driven by the admin-editable RULES, so a badge renamed or retuned in the
 * console shows up here immediately.
 *
 * Earned state comes from the PERSISTED rows first, not only from re-running
 * the rules: a badge stays earned even if its threshold was later raised. An
 * award is a historical fact, and revoking it because an operator retuned a
 * number would punish a player for someone else's decision. The recalculate
 * action in the console is the deliberate way to re-apply rules.
 */
export function toBadgeShelf(
  rules: readonly BadgeRule[],
  context: RuleContext,
  held: readonly BadgeRow[],
): BadgeProgressView[] {
  const heldAt = new Map(held.map((r) => [r.badgeKey, r.earnedAt]));
  const heldCount = new Map(held.map((r) => [r.badgeKey, r.count ?? 1]));

  return rules
    .filter((r) => r.enabled)
    .map((rule) => {
      const earnedAt = heldAt.get(rule.key);
      return {
        key: rule.key,
        label: rule.label,
        description: rule.description,
        category: rule.category,
        rarity: rule.rarity,
        glyph: rule.glyph,
        earnedAt: earnedAt ? earnedAt.toISOString() : null,
        earned: earnedAt !== undefined || ruleMet(rule, context),
        progress: ruleProgress(rule, context),
        count: heldCount.get(rule.key) ?? 1,
      };
    });
}

/**
 * Stored badge rows -> wire views, using the admin-editable rules for the
 * label and description so a rename in the console is reflected everywhere.
 *
 * A held badge whose rule was deleted falls back to the built-in definition,
 * and is skipped only if neither exists — an award must not render blank.
 */
export function toBadgeViewsFromRules(
  rules: readonly BadgeRule[],
  rows: readonly BadgeRow[],
): BadgeView[] {
  const byKey = new Map(rules.map((r) => [r.key, r]));
  const out: BadgeView[] = [];

  for (const row of rows) {
    const rule = byKey.get(row.badgeKey);
    if (rule) {
      out.push({
        key: rule.key,
        label: rule.label,
        description: rule.description,
        category: rule.category,
        rarity: rule.rarity,
        glyph: rule.glyph,
        earnedAt: row.earnedAt.toISOString(),
        count: row.count ?? 1,
      });
      continue;
    }
    const builtin = badgeByKey(row.badgeKey);
    if (builtin) {
      out.push({
        ...describeBadge(builtin),
        earnedAt: row.earnedAt.toISOString(),
        count: row.count ?? 1,
      });
    }
  }
  return out;
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
