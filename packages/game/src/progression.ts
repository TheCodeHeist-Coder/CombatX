/**
 * Progression rules — XP, streaks, and rank tiers.
 *
 * Pure functions with no database and no clock, exactly like the outcome
 * rules. The server applies these when a battle finishes; the client uses the
 * same functions to render a rank badge, so the two can never disagree.
 *
 * XP IS NOT A SKILL MEASURE, AND IS NOT MEANT TO BE.
 * --------------------------------------------------
 * XP only ever rises, so it answers "how much has this player fought?" — a
 * career-length number, like a service record. Skill is answered separately by
 * the Glicko-2 rating in `rating.ts`, which is zero-sum and can fall.
 *
 * Keeping them apart is the point. A single number cannot be both motivating
 * (never goes down) and honest (must go down when you lose), and trying to
 * make it both is what lets a player top a ladder purely by grinding.
 */

import type { Difficulty, FinishReason } from "@repo/protocol";

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
/**
 * The pool paid out for test progress, scaled by the FRACTION passed.
 *
 * Deliberately a fraction rather than a per-test rate: paying per test made a
 * 30-test problem worth three times a 10-test problem for identical play,
 * which rewarded picking a problem shape rather than solving it well.
 */
const XP_TESTS = 100;
/** Bonus for a flawless run (every test passed). */
const XP_PERFECT = 75;

/** Streak multiplier: +0.25 per consecutive win after the first, capped. */
const STREAK_STEP = 0.25;
const STREAK_MAX = 2.5;

/**
 * Difficulty weights.
 *
 * Without these every player is best off farming EASY, which is both the
 * fastest to cycle and the least interesting. The spread is modest on purpose:
 * enough to make HARD worth attempting, not so much that EASY feels wasted.
 */
export const DIFFICULTY_WEIGHT: Record<Difficulty, number> = {
  EASY: 1,
  MEDIUM: 1.5,
  HARD: 2.2,
};

/**
 * Anti-grind taper.
 *
 * Full XP for the first FULL_RATE_BATTLES of a player's day; after that each
 * award is multiplied by TAPERED_RATE. Playing more always earns more — this
 * is a taper, not a wall — but a marathon session cannot out-earn skill by an
 * unbounded margin.
 *
 * Note this affects XP only. Rating is untouched: throttling a rating would
 * make it a measure of when you played rather than how well.
 */
export const FULL_RATE_BATTLES = 10;
const TAPERED_RATE = 0.35;

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
  /** The problem's difficulty. Scales the whole award. */
  difficulty: Difficulty;
  /**
   * How the battle ended. A FORFEIT win pays participation only — see the
   * note in computeAward.
   */
  reason: FinishReason;
  /** How many battles this player has already finished today. */
  battlesToday: number;
}

export interface Award {
  /** Total XP granted, every multiplier already applied. */
  xp: number;
  /** XP before any multiplier — useful for showing the breakdown. */
  baseXp: number;
  /** The streak multiplier alone. */
  multiplier: number;
  /** The difficulty weight applied. */
  difficultyWeight: number;
  /** The anti-grind taper applied: 1 normally, TAPERED_RATE past the cap. */
  taper: number;
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
  difficulty,
  reason,
  battlesToday,
}: AwardInput): Award {
  const perfect = total > 0 && passed === total && reason !== "FORFEIT";

  /**
   * A forfeit is not a demonstration of skill — the opponent walked away, and
   * two accounts can produce one on demand. So it pays participation only, and
   * it does NOT extend a streak: otherwise the cheapest route to a 2.5x
   * multiplier is a partner who keeps quitting.
   */
  if (reason === "FORFEIT") {
    const taper = taperFor(battlesToday);
    return {
      xp: Math.round(XP_PARTICIPATION * taper),
      baseXp: XP_PARTICIPATION,
      multiplier: 1,
      difficultyWeight: 1,
      taper,
      newStreak: won ? previousStreak : 0,
      perfect: false,
    };
  }

  const newStreak = won ? previousStreak + 1 : 0;

  // Fraction of tests passed, so problem size does not change the payout.
  const share = total > 0 ? Math.min(1, Math.max(0, passed / total)) : 0;

  let baseXp = XP_PARTICIPATION + share * XP_TESTS;
  if (won) baseXp += XP_WIN;
  if (perfect) baseXp += XP_PERFECT;

  const multiplier = won ? streakMultiplier(newStreak) : 1;
  const difficultyWeight = DIFFICULTY_WEIGHT[difficulty] ?? 1;
  const taper = taperFor(battlesToday);

  return {
    xp: Math.round(baseXp * multiplier * difficultyWeight * taper),
    baseXp: Math.round(baseXp),
    multiplier,
    difficultyWeight,
    taper,
    newStreak,
    perfect,
  };
}

/** 1 for the first FULL_RATE_BATTLES of the day, TAPERED_RATE after. */
function taperFor(battlesToday: number): number {
  return battlesToday < FULL_RATE_BATTLES ? 1 : TAPERED_RATE;
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
