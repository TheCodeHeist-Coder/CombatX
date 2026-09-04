/**
 * Declarative badge rules.
 *
 * WHY THIS EXISTS
 * ---------------
 * The badge table in badges.ts holds arbitrary JavaScript predicates. That is
 * fine for a fixed set defined in source, but it cannot be stored in a database
 * or edited from a form: a predicate is code, and storing code an admin can
 * edit would mean executing admin-authored JavaScript on the server.
 *
 * So a rule is DATA instead: a metric, a comparison and a threshold. Every
 * badge in the shipped set is expressible this way, and a rule is safe to
 * store, safe to validate, and safe to render as a form.
 *
 * The evaluator here is the single place a rule turns into a yes/no, so the
 * admin console, the server and the client all agree by construction.
 */

import { conservativeRating, isProvisional, type RatingState } from "./rating.js";

/**
 * A measurable quantity a rule can test.
 *
 * This list is closed on purpose: a rule may only reference something the
 * server actually stores and can compute cheaply. Adding a metric means adding
 * a column and a case here, which is the correct amount of friction — an
 * open-ended expression language would let an admin write a rule the database
 * cannot answer.
 */
export const BADGE_METRICS = [
  "wins",
  "losses",
  "draws",
  "xp",
  "bestStreak",
  "rankedBattles",
  "upsetWins",
  "perfectWins",
  "easyWins",
  "mediumWins",
  "hardWins",
  "distinctProblemsWon",
  "accountAgeDays",
  "signupOrdinal",
  /** The Glicko-2 rating itself. */
  "rating",
  /** rating - 2*rd: the leaderboard's sort key. */
  "conservativeRating",
  /** The tier index, 0 = lowest. Compare with >= to mean "this tier or above". */
  "tierIndex",
  /** 1 when the rating is settled enough to publish, else 0. */
  "placed",
  /** Wins as a percentage of decided battles, 0-100. */
  "winRate",
  /** Problems this user authored that an admin approved. */
  "approvedProblemsAuthored",
] as const;

export type BadgeMetric = (typeof BADGE_METRICS)[number];

/** Human labels for the metric picker. */
export const METRIC_LABELS: Record<BadgeMetric, string> = {
  wins: "Total wins",
  losses: "Total losses",
  draws: "Total draws",
  xp: "Career XP",
  bestStreak: "Best win streak",
  rankedBattles: "Ranked battles played",
  upsetWins: "Wins over much stronger opponents",
  perfectWins: "Wins passing every test",
  easyWins: "Wins on easy problems",
  mediumWins: "Wins on medium problems",
  hardWins: "Wins on hard problems",
  distinctProblemsWon: "Distinct problems won",
  accountAgeDays: "Account age in days",
  signupOrdinal: "Signup number (1 = first ever)",
  rating: "Rating",
  conservativeRating: "Rating (confidence-adjusted)",
  tierIndex: "Tier reached (0 = lowest)",
  placed: "Has a placed rating (1 = yes)",
  winRate: "Win rate %",
  approvedProblemsAuthored: "Approved problems authored",
};

/**
 * How a metric is compared to its threshold.
 *
 * `gte` covers almost everything — badges are nearly always "reach N". `lte`
 * exists for the Pioneer case, where a LOW signup number is the achievement.
 */
export const BADGE_COMPARATORS = ["gte", "lte"] as const;
export type BadgeComparator = (typeof BADGE_COMPARATORS)[number];

/** One condition. A badge is earned when ALL of its conditions hold. */
export interface BadgeCondition {
  metric: BadgeMetric;
  comparator: BadgeComparator;
  threshold: number;
}

/**
 * A complete, storable badge definition.
 *
 * `conditions` is an AND: every one must hold. That is enough for the whole
 * shipped set (Founding Combatant is "early signup AND 10 wins") and keeps the
 * editor a simple list of rows rather than a boolean expression builder that
 * an admin would have to reason about.
 */
export interface BadgeRule {
  key: string;
  label: string;
  description: string;
  category: string;
  rarity: string;
  /** Which animal crest to draw. */
  artKey: string;
  glyph: string;
  /** Conditions, ANDed together. An empty list is never earned. */
  conditions: BadgeCondition[];
  /**
   * Which condition drives the progress bar, by index. Null means the badge
   * shows no partial progress — right for something like Pioneer, where being
   * "halfway to having signed up early" is meaningless.
   */
  progressFrom: number | null;
  /**
   * For a REPEATABLE badge: how much of the progress metric earns one more
   * copy, rendered as the "x2" bubble on the medal. Null for an ordinary
   * badge, which is held once or not at all.
   *
   * Only meaningful alongside a `gte` condition at `progressFrom` — a rule
   * that cannot ramp cannot repeat.
   */
  repeatEvery: number | null;
  /** Hidden rules stay in the table but are not awarded or shown. */
  enabled: boolean;
  /** Display order on the shelf, ascending. */
  sortOrder: number;
}

/** Everything a rule can be evaluated against. */
export interface RuleContext {
  wins: number;
  losses: number;
  draws: number;
  xp: number;
  bestStreak: number;
  rankedBattles: number;
  upsetWins: number;
  perfectWins: number;
  easyWins: number;
  mediumWins: number;
  hardWins: number;
  distinctProblemsWon: number;
  accountAgeDays: number;
  signupOrdinal: number;
  rating: RatingState;
  /** Index of the held tier, or -1 when provisional. */
  tierIndex: number;
  /** Problems authored by this user that an admin approved. */
  approvedProblemsAuthored: number;
}

/** Read one metric out of a context. */
export function readMetric(metric: BadgeMetric, c: RuleContext): number {
  switch (metric) {
    case "wins": return c.wins;
    case "losses": return c.losses;
    case "draws": return c.draws;
    case "xp": return c.xp;
    case "bestStreak": return c.bestStreak;
    case "rankedBattles": return c.rankedBattles;
    case "upsetWins": return c.upsetWins;
    case "perfectWins": return c.perfectWins;
    case "easyWins": return c.easyWins;
    case "mediumWins": return c.mediumWins;
    case "hardWins": return c.hardWins;
    case "distinctProblemsWon": return c.distinctProblemsWon;
    case "accountAgeDays": return c.accountAgeDays;
    case "signupOrdinal": return c.signupOrdinal;
    case "rating": return c.rating.rating;
    case "conservativeRating": return conservativeRating(c.rating);
    case "tierIndex": return c.tierIndex;
    case "placed": return isProvisional(c.rating.rd) ? 0 : 1;
    case "approvedProblemsAuthored":
      return c.approvedProblemsAuthored;
    case "winRate": {
      const decided = c.wins + c.losses;
      return decided === 0 ? 0 : (c.wins / decided) * 100;
    }
  }
}

/** Does one condition hold? */
export function conditionMet(cond: BadgeCondition, c: RuleContext): boolean {
  const value = readMetric(cond.metric, c);
  return cond.comparator === "gte"
    ? value >= cond.threshold
    : value <= cond.threshold;
}

/**
 * Is this rule satisfied?
 *
 * A rule with no conditions is never earned. That is deliberate: a half-built
 * badge saved from the editor must not be handed to every player on the site.
 *
 * `signupOrdinal <= N` also requires a real ordinal, because 0 means "never
 * assigned" and would otherwise satisfy every `lte` comparison — awarding
 * Pioneer to accounts that predate the counter.
 */
export function ruleMet(rule: BadgeRule, c: RuleContext): boolean {
  if (!rule.enabled) return false;
  if (rule.conditions.length === 0) return false;
  return rule.conditions.every((cond) => {
    if (cond.metric === "signupOrdinal" && cond.comparator === "lte") {
      return c.signupOrdinal > 0 && conditionMet(cond, c);
    }
    return conditionMet(cond, c);
  });
}

/**
 * Progress toward a rule, 0..1, or null when it reports none.
 *
 * Measured on the nominated condition only. For a multi-condition badge that
 * is the honest choice: averaging would read as "nearly there" for someone who
 * has not started the hardest leg.
 */
export function ruleProgress(rule: BadgeRule, c: RuleContext): number | null {
  if (rule.progressFrom === null) return null;
  const cond = rule.conditions[rule.progressFrom];
  if (!cond) return null;
  // A `lte` rule has no meaningful ramp — you either signed up early or you
  // did not — so it reports completion, not partial progress.
  if (cond.comparator === "lte") return conditionMet(cond, c) ? 1 : 0;
  if (cond.threshold <= 0) return 1;
  return Math.min(1, Math.max(0, readMetric(cond.metric, c) / cond.threshold));
}

/**
 * How many times a rule has been earned.
 *
 * 0 means not yet; 1 is an ordinary held badge; 2+ only ever comes from a
 * repeatable rule and is what the medal renders as "x2".
 *
 * Deliberately separate from `ruleMet` rather than replacing it: every
 * existing badge is boolean, and a caller that only asks "do they hold this?"
 * should not have to reason about levels.
 */
export function ruleLevel(rule: BadgeRule, c: RuleContext): number {
  if (!ruleMet(rule, c)) return 0;
  if (rule.repeatEvery === null || rule.repeatEvery <= 0) return 1;
  const cond = rule.progressFrom === null ? undefined : rule.conditions[rule.progressFrom];
  // Without a ramping condition to count against, a repeatable rule still
  // awards once rather than silently multiplying.
  if (!cond || cond.comparator !== "gte") return 1;
  return Math.max(1, Math.floor(readMetric(cond.metric, c) / rule.repeatEvery));
}

/** A one-line, human-readable summary of a rule, for the admin table. */
export function describeRule(rule: BadgeRule): string {
  if (rule.conditions.length === 0) return "No conditions — never awarded";
  return rule.conditions
    .map((c) => {
      const label = METRIC_LABELS[c.metric] ?? c.metric;
      return `${label} ${c.comparator === "gte" ? "≥" : "≤"} ${c.threshold}`;
    })
    .join(" and ");
}
