/**
 * Progression rules — XP, streaks, and rank tiers.
 *
 * Pure functions with no database and no clock, exactly like the outcome
 * rules. The server applies these when a battle finishes; the client uses the
 * same functions to render a rank badge, so the two can never disagree.
 */

/** Rank tiers, ascending. `minXp` is inclusive. */
export const RANKS = [
  { key: "RECRUIT", label: "Recruit", minXp: 0 },
  { key: "OPERATIVE", label: "Operative", minXp: 500 },
  { key: "SPECIALIST", label: "Specialist", minXp: 1500 },
  { key: "VETERAN", label: "Veteran", minXp: 3500 },
  { key: "ELITE", label: "Elite", minXp: 7000 },
  { key: "ELITE_II", label: "Elite II", minXp: 12000 },
  { key: "COMMANDER", label: "Commander", minXp: 20000 },
] as const;

export type RankKey = (typeof RANKS)[number]["key"];

export interface Rank {
  key: RankKey;
  label: string;
  minXp: number;
}

/** Base award for taking part — losing still earns something. */
const XP_PARTICIPATION = 25;
/** Base award for winning, before the streak multiplier. */
const XP_WIN = 200;
/** Per test passed, so a strong loss beats a weak one. */
const XP_PER_TEST = 10;
/** Bonus for a flawless run (every test passed). */
const XP_PERFECT = 75;

/** Streak multiplier: +0.25 per consecutive win after the first, capped. */
const STREAK_STEP = 0.25;
const STREAK_MAX = 2.5;

/**
 * The multiplier applied to a win, given the streak *including* this battle.
 * A first win is 1.0x, the second consecutive 1.25x, and so on to 2.5x.
 */
export function streakMultiplier(winStreak: number): number {
  if (winStreak <= 1) return 1;
  return Math.min(STREAK_MAX, 1 + (winStreak - 1) * STREAK_STEP);
}

export interface AwardInput {
  won: boolean;
  passed: number;
  total: number;
  /** The player's streak BEFORE this battle. */
  previousStreak: number;
}

export interface Award {
  /** Total XP granted, streak multiplier already applied. */
  xp: number;
  /** XP before the multiplier — useful for showing the breakdown. */
  baseXp: number;
  multiplier: number;
  /** The player's streak AFTER this battle. */
  newStreak: number;
  perfect: boolean;
}

/**
 * Compute what a player earned from one finished battle.
 *
 * Only wins extend a streak and only wins are multiplied — otherwise a player
 * could farm the multiplier by losing repeatedly with high passed-counts.
 */
export function computeAward({
  won,
  passed,
  total,
  previousStreak,
}: AwardInput): Award {
  const perfect = total > 0 && passed === total;
  const newStreak = won ? previousStreak + 1 : 0;

  let baseXp = XP_PARTICIPATION + Math.max(0, passed) * XP_PER_TEST;
  if (won) baseXp += XP_WIN;
  if (perfect) baseXp += XP_PERFECT;

  const multiplier = won ? streakMultiplier(newStreak) : 1;

  return {
    xp: Math.round(baseXp * multiplier),
    baseXp,
    multiplier,
    newStreak,
    perfect,
  };
}

/** The rank held at a given XP total. Never returns undefined — 0 XP is Recruit. */
export function rankFor(xp: number): Rank {
  let held: Rank = RANKS[0];
  for (const r of RANKS) if (xp >= r.minXp) held = r;
  return held;
}

/** The next rank up, or null at the ceiling. */
export function nextRank(xp: number): Rank | null {
  return RANKS.find((r) => r.minXp > xp) ?? null;
}

/**
 * Progress toward the next rank, 0..1. Returns 1 at the maximum rank so a
 * progress bar reads as "complete" rather than empty.
 */
export function rankProgress(xp: number): number {
  const current = rankFor(xp);
  const next = nextRank(xp);
  if (!next) return 1;
  const span = next.minXp - current.minXp;
  if (span <= 0) return 1;
  return Math.min(1, Math.max(0, (xp - current.minXp) / span));
}
