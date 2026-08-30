/**
 * Badges — the Greek-letter tiers and the achievement set.
 *
 * Pure, like every other rule in this package: one table, one evaluator, no
 * database and no clock. The server stores what a player has earned, but both
 * server and client derive the SAME answer from the same input, so a profile
 * can render a badge shelf without waiting for a round trip.
 *
 * TWO KINDS OF BADGE, DELIBERATELY SEPARATE
 * -----------------------------------------
 * TIER badges (Alpha, Beta, ...) answer "how good is this player?". Exactly
 * one is held at a time, it is derived from the conservative rating, and it
 * can be LOST — that is what makes holding Alpha mean something.
 *
 * ACHIEVEMENT badges answer "what has this player done?". Many can be held,
 * they are permanent once earned, and they cover things a rating cannot say:
 * volume, streaks, being early, beating the odds.
 *
 * Mixing the two would ruin both. A permanent skill badge is a lie the moment
 * a player declines, and a revocable achievement punishes someone for history
 * that genuinely happened.
 */

import {
  conservativeRating,
  isProvisional,
  type RatingState,
} from "./rating.js";

// ---------------------------------------------------------------------------
// Tier badges
// ---------------------------------------------------------------------------

/**
 * Skill tiers, ascending.
 *
 * Named with Greek letters because they read as a rank without implying a
 * material value the way Bronze/Silver/Gold does — there is no reason Gold
 * should beat Silver except convention, whereas Alpha is unmistakably first.
 *
 * `minRating` is measured against the CONSERVATIVE rating (rating - 2*RD), so
 * a tier can only be reached by playing well AND playing enough for us to be
 * sure of it. The thresholds are spaced so the population thins out sharply
 * toward the top: Alpha is meant to be rare.
 */
export const TIERS = [
  {
    key: "IOTA",
    label: "Iota",
    minRating: 0,
    blurb: "Finding their footing.",
    color: "#6b7280",
  },
  {
    key: "EPSILON",
    label: "Epsilon",
    minRating: 1150,
    blurb: "Holds their own.",
    color: "#78909c",
  },
  {
    key: "DELTA",
    label: "Delta",
    minRating: 1300,
    blurb: "A solid, reliable competitor.",
    color: "#4db6ac",
  },
  {
    key: "GAMMA",
    label: "Gamma",
    minRating: 1450,
    blurb: "Good. Consistently beats the field.",
    color: "#42a5f5",
  },
  {
    key: "BETA",
    label: "Beta",
    minRating: 1650,
    blurb: "Great. Among the strongest here.",
    color: "#7e57c2",
  },
  {
    key: "ALPHA",
    label: "Alpha",
    minRating: 1850,
    blurb: "Elite. The top of the ladder.",
    color: "#f2622e",
  },
] as const;

export type TierKey = (typeof TIERS)[number]["key"];

export interface Tier {
  key: TierKey;
  label: string;
  minRating: number;
  blurb: string;
  color: string;
}

/**
 * How many ranked battles always place a player, whatever their record.
 *
 * The RD gate alone is not enough. A player who wins every battle drives their
 * expected score toward 95%, so each further win carries almost no information
 * and their deviation stops falling — measured, it is still 104 after sixty
 * straight wins. Under a pure RD rule an unbeaten player would stay "Unranked"
 * forever, which is exactly backwards.
 *
 * So placement is EITHER a settled deviation OR this many battles fought. The
 * count is deliberately close to where a mixed record converges anyway (13),
 * so it changes nothing for an ordinary player and only rescues the extremes.
 */
export const PLACEMENT_BATTLES = 12;

/**
 * Is this player's rating publishable?
 *
 * `rankedBattles` is optional so existing callers that only have a rating
 * state keep working; without it this is the deviation test alone.
 */
export function isPlaced(state: RatingState, rankedBattles?: number): boolean {
  if (!isProvisional(state.rd)) return true;
  return (rankedBattles ?? 0) >= PLACEMENT_BATTLES;
}

/**
 * The tier held at a given rating state.
 *
 * Returns null while the rating is still provisional: we have not seen enough
 * battles to make a claim about someone's skill, and a tier badge IS a claim.
 * The UI shows "Unranked" for this, which is honest rather than flattering.
 */
export function tierFor(
  state: RatingState,
  rankedBattles?: number,
): Tier | null {
  if (!isPlaced(state, rankedBattles)) return null;
  const effective = conservativeRating(state);
  let held: Tier = TIERS[0];
  for (const t of TIERS) if (effective >= t.minRating) held = t;
  return held;
}

/** The next tier up, or null at the ceiling (or while provisional). */
export function nextTier(
  state: RatingState,
  rankedBattles?: number,
): Tier | null {
  if (!isPlaced(state, rankedBattles)) return null;
  const effective = conservativeRating(state);
  return TIERS.find((t) => t.minRating > effective) ?? null;
}

/**
 * Progress from the held tier to the next, 0..1.
 * Returns 1 at the top tier so a progress bar reads as complete, and 0 while
 * provisional since there is no tier to progress from yet.
 */
export function tierProgress(
  state: RatingState,
  rankedBattles?: number,
): number {
  const current = tierFor(state, rankedBattles);
  if (!current) return 0;
  const next = nextTier(state, rankedBattles);
  if (!next) return 1;
  const span = next.minRating - current.minRating;
  if (span <= 0) return 1;
  const into = conservativeRating(state) - current.minRating;
  return Math.min(1, Math.max(0, into / span));
}

// ---------------------------------------------------------------------------
// Achievement badges
// ---------------------------------------------------------------------------

/**
 * How a badge is grouped on the profile shelf, and how loudly it is drawn.
 * `rarity` drives nothing but presentation — it is the honest answer to
 * "should this one stand out?".
 */
export type BadgeRarity = "COMMON" | "UNCOMMON" | "RARE" | "LEGENDARY";

export type BadgeCategory =
  | "MILESTONE"
  | "DIFFICULTY"
  | "SKILL"
  | "STREAK"
  | "PIONEER";

/** Everything the evaluator is allowed to look at. */
export interface BadgeContext {
  wins: number;
  losses: number;
  xp: number;
  bestStreak: number;
  /** Battles that counted toward rating. */
  rankedBattles: number;
  /** Current rating state, for skill-gated badges. */
  rating: RatingState;
  /** Wins where the opponent was rated at least 200 above the player. */
  upsetWins: number;
  /** Battles won by passing every test. */
  perfectWins: number;
  /** Distinct problems this player has won on. */
  distinctProblemsWon: number;
  /**
   * Wins broken down by the problem's difficulty.
   *
   * Separate counters rather than a weighted total: a badge that says "won 25
   * hard problems" has to mean exactly that, and a total would let 200 easy
   * wins stand in for it.
   */
  easyWins: number;
  mediumWins: number;
  hardWins: number;
  /** 1-based signup order across the whole platform. */
  signupOrdinal: number;
  /** Whole days between signup and now. */
  accountAgeDays: number;
}

export interface BadgeDef {
  key: string;
  label: string;
  /** What the holder did. Written in the past tense, shown on hover. */
  description: string;
  category: BadgeCategory;
  rarity: BadgeRarity;
  /** A short glyph. Kept to one or two characters so it fits a small chip. */
  glyph: string;
  /** True when the context satisfies this badge. */
  earned: (c: BadgeContext) => boolean;
  /**
   * Progress toward earning it, 0..1. Optional — some badges are binary and
   * a half-finished "Pioneer" is meaningless.
   */
  progress?: (c: BadgeContext) => number;
}

/** How many of the first accounts count as founders. */
export const PIONEER_CUTOFF = 100;

/** Rating gap that makes a win an upset, for GIANT_SLAYER. */
export const UPSET_GAP = 200;

const ratio = (have: number, need: number): number =>
  Math.min(1, Math.max(0, have / need));

/**
 * True when a rating state has reached at least the named tier.
 * Provisional ratings hold no tier, so they never satisfy this.
 */
function reachedTier(state: RatingState, key: TierKey): boolean {
  const held = tierFor(state);
  if (!held) return false;
  const heldAt = TIERS.findIndex((t) => t.key === held.key);
  const wantAt = TIERS.findIndex((t) => t.key === key);
  return heldAt >= wantAt;
}

/**
 * The badge table.
 *
 * Ordered roughly by how hard they are to get, because that is also the order
 * a shelf reads best in. Adding a badge means adding one row here and nothing
 * else — the evaluator, the API and the profile shelf all iterate this table.
 */
export const BADGES: readonly BadgeDef[] = [
  // --- Milestones: volume. Anyone can get these by turning up. ---
  {
    key: "FIRST_BLOOD",
    label: "First Blood",
    description: "Won their first battle.",
    category: "MILESTONE",
    rarity: "COMMON",
    glyph: "I",
    earned: (c) => c.wins >= 1,
    progress: (c) => ratio(c.wins, 1),
  },
  {
    key: "TEN_WINS",
    label: "Contender",
    description: "Won 10 battles.",
    category: "MILESTONE",
    rarity: "COMMON",
    glyph: "X",
    earned: (c) => c.wins >= 10,
    progress: (c) => ratio(c.wins, 10),
  },
  {
    key: "THIRTY_WINS",
    label: "Duellist",
    description: "Won 30 battles.",
    category: "MILESTONE",
    rarity: "UNCOMMON",
    glyph: "D",
    earned: (c) => c.wins >= 30,
    progress: (c) => ratio(c.wins, 30),
  },
  {
    key: "SIXTY_WINS",
    label: "Gladiator",
    description: "Won 60 battles.",
    category: "MILESTONE",
    rarity: "RARE",
    glyph: "L",
    earned: (c) => c.wins >= 60,
    progress: (c) => ratio(c.wins, 60),
  },
  {
    key: "HUNDRED_WINS",
    label: "Centurion",
    description: "Won 100 battles.",
    category: "MILESTONE",
    rarity: "RARE",
    glyph: "C",
    earned: (c) => c.wins >= 100,
    progress: (c) => ratio(c.wins, 100),
  },
  {
    key: "VETERAN",
    label: "Veteran",
    description: "Fought 250 ranked battles.",
    category: "MILESTONE",
    rarity: "RARE",
    glyph: "V",
    earned: (c) => c.rankedBattles >= 250,
    progress: (c) => ratio(c.rankedBattles, 250),
  },
  {
    key: "POLYGLOT",
    label: "Well Read",
    description: "Won on 25 different problems.",
    category: "MILESTONE",
    rarity: "UNCOMMON",
    glyph: "P",
    earned: (c) => c.distinctProblemsWon >= 25,
    progress: (c) => ratio(c.distinctProblemsWon, 25),
  },

  // --- Difficulty: what KIND of problem a player can beat. ---
  //
  // These are the answer to "is this player good, or just busy?" that raw win
  // counts cannot give. Easy wins are capped low on purpose: the ladder here
  // is meant to pull players upward into harder problems, so the prestige sits
  // at the hard end and grinding easy problems tops out early.
  {
    key: "EASY_RIDER",
    label: "Easy Rider",
    description: "Won 25 battles on easy problems.",
    category: "DIFFICULTY",
    rarity: "COMMON",
    glyph: "e",
    earned: (c) => c.easyWins >= 25,
    progress: (c) => ratio(c.easyWins, 25),
  },
  {
    key: "MIDDLEWEIGHT",
    label: "Middleweight",
    description: "Won 10 battles on medium problems.",
    category: "DIFFICULTY",
    rarity: "UNCOMMON",
    glyph: "m",
    earned: (c) => c.mediumWins >= 10,
    progress: (c) => ratio(c.mediumWins, 10),
  },
  {
    key: "HEAVYWEIGHT",
    label: "Heavyweight",
    description: "Won 30 battles on medium problems.",
    category: "DIFFICULTY",
    rarity: "RARE",
    glyph: "M",
    earned: (c) => c.mediumWins >= 30,
    progress: (c) => ratio(c.mediumWins, 30),
  },
  {
    key: "HARD_LINER",
    label: "Hard Liner",
    description: "Won their first battle on a hard problem.",
    category: "DIFFICULTY",
    rarity: "UNCOMMON",
    glyph: "h",
    earned: (c) => c.hardWins >= 1,
    progress: (c) => ratio(c.hardWins, 1),
  },
  {
    key: "CRUCIBLE",
    label: "Crucible",
    description: "Won 10 battles on hard problems.",
    category: "DIFFICULTY",
    rarity: "RARE",
    glyph: "H",
    earned: (c) => c.hardWins >= 10,
    progress: (c) => ratio(c.hardWins, 10),
  },
  {
    key: "APEX",
    label: "Apex",
    description: "Won 30 battles on hard problems.",
    category: "DIFFICULTY",
    rarity: "LEGENDARY",
    glyph: "&",
    earned: (c) => c.hardWins >= 30,
    progress: (c) => ratio(c.hardWins, 30),
  },
  {
    key: "ALL_ROUNDER",
    label: "All Rounder",
    description: "Won at least 10 battles at every difficulty.",
    category: "DIFFICULTY",
    rarity: "RARE",
    glyph: "O",
    earned: (c) => c.easyWins >= 10 && c.mediumWins >= 10 && c.hardWins >= 10,
    // Progress is the WEAKEST leg, not the average: this badge is gated by
    // whichever difficulty the player has neglected, and an average would
    // read as nearly-done for someone who has never won a hard battle.
    progress: (c) =>
      Math.min(ratio(c.easyWins, 10), ratio(c.mediumWins, 10), ratio(c.hardWins, 10)),
  },

  // --- Streaks: consistency under pressure. ---
  {
    key: "HAT_TRICK",
    label: "Hat Trick",
    description: "Won three battles in a row.",
    category: "STREAK",
    rarity: "COMMON",
    glyph: "3",
    earned: (c) => c.bestStreak >= 3,
    progress: (c) => ratio(c.bestStreak, 3),
  },
  {
    key: "UNBROKEN",
    label: "Unbroken",
    description: "Won ten battles in a row.",
    category: "STREAK",
    rarity: "RARE",
    glyph: "U",
    earned: (c) => c.bestStreak >= 10,
    progress: (c) => ratio(c.bestStreak, 10),
  },
  {
    key: "IMMORTAL",
    label: "Immortal",
    description: "Won twenty-five battles in a row.",
    category: "STREAK",
    rarity: "LEGENDARY",
    glyph: "!",
    earned: (c) => c.bestStreak >= 25,
    progress: (c) => ratio(c.bestStreak, 25),
  },

  // --- Skill: these require being good, not just present. ---
  {
    key: "FLAWLESS",
    label: "Flawless",
    description: "Won 10 battles passing every single test.",
    category: "SKILL",
    rarity: "UNCOMMON",
    glyph: "*",
    earned: (c) => c.perfectWins >= 10,
    progress: (c) => ratio(c.perfectWins, 10),
  },
  {
    key: "GIANT_SLAYER",
    label: "Giant Slayer",
    description: "Beat 10 opponents rated far above them.",
    category: "SKILL",
    rarity: "RARE",
    glyph: "^",
    earned: (c) => c.upsetWins >= 10,
    progress: (c) => ratio(c.upsetWins, 10),
  },
  {
    key: "RANKED",
    label: "Ranked",
    description: "Played enough battles to earn a placed rating.",
    category: "SKILL",
    rarity: "COMMON",
    glyph: "R",
    earned: (c) => !isProvisional(c.rating.rd),
  },
  {
    key: "GAMMA_CLASS",
    label: "Gamma Class",
    description: "Reached the Gamma tier.",
    category: "SKILL",
    rarity: "UNCOMMON",
    glyph: "G",
    earned: (c) => reachedTier(c.rating, "GAMMA"),
  },
  {
    key: "BETA_CLASS",
    label: "Beta Class",
    description: "Reached the Beta tier.",
    category: "SKILL",
    rarity: "RARE",
    glyph: "B",
    earned: (c) => reachedTier(c.rating, "BETA"),
  },
  {
    key: "ALPHA_CLASS",
    label: "Alpha Class",
    description: "Reached the Alpha tier.",
    category: "SKILL",
    rarity: "LEGENDARY",
    glyph: "A",
    earned: (c) => reachedTier(c.rating, "ALPHA"),
  },

  // --- Pioneer: being here early. Cannot be earned later, by anyone. ---
  {
    key: "PIONEER",
    label: "Pioneer",
    description: `One of the first ${PIONEER_CUTOFF} operatives to enlist.`,
    category: "PIONEER",
    rarity: "LEGENDARY",
    glyph: "1",
    earned: (c) => c.signupOrdinal > 0 && c.signupOrdinal <= PIONEER_CUTOFF,
  },
  {
    key: "FOUNDING_COMBATANT",
    label: "Founding Combatant",
    description: "Enlisted early and actually fought.",
    category: "PIONEER",
    rarity: "LEGENDARY",
    glyph: "F",
    earned: (c) =>
      c.signupOrdinal > 0 && c.signupOrdinal <= PIONEER_CUTOFF && c.wins >= 10,
  },
  {
    key: "LOYALIST",
    label: "Loyalist",
    description: "Still fighting a year after enlisting.",
    category: "PIONEER",
    rarity: "RARE",
    glyph: "Y",
    earned: (c) => c.accountAgeDays >= 365 && c.rankedBattles >= 20,
  },
] as const;

/** Index for O(1) lookup by key when rendering a stored badge row. */
const BY_KEY = new Map(BADGES.map((b) => [b.key, b]));

export function badgeByKey(key: string): BadgeDef | null {
  return BY_KEY.get(key) ?? null;
}

export interface EarnedBadge {
  key: string;
  label: string;
  description: string;
  category: BadgeCategory;
  rarity: BadgeRarity;
  glyph: string;
}

/** Strip a definition down to what the wire and the UI actually need. */
export function describeBadge(def: BadgeDef): EarnedBadge {
  return {
    key: def.key,
    label: def.label,
    description: def.description,
    category: def.category,
    rarity: def.rarity,
    glyph: def.glyph,
  };
}

/**
 * Every badge the context currently satisfies.
 *
 * Note this is a pure function of the CURRENT stats, which is why achievement
 * badges are all monotonic in their inputs (wins, bestStreak, upsetWins only
 * ever rise). A badge whose condition could stop being true would appear to be
 * revoked, and the persisted UserBadge row is what makes an award permanent
 * even if the table later changes.
 */
export function evaluateBadges(context: BadgeContext): EarnedBadge[] {
  return BADGES.filter((b) => b.earned(context)).map(describeBadge);
}

/**
 * Badges the context newly satisfies, given what is already held.
 * This is what the finish handler persists and the results screen celebrates.
 */
export function newlyEarned(
  context: BadgeContext,
  alreadyHeld: readonly string[],
): EarnedBadge[] {
  const held = new Set(alreadyHeld);
  return BADGES.filter((b) => !held.has(b.key) && b.earned(context)).map(
    describeBadge,
  );
}

export interface BadgeProgress extends EarnedBadge {
  earned: boolean;
  /** 0..1, or null for a badge with no meaningful partial state. */
  progress: number | null;
}

/**
 * The whole table with each badge's state, for the "not yet earned" half of a
 * profile shelf. Showing what is still out there is most of what makes a
 * badge system motivating rather than decorative.
 */
export function badgeProgress(context: BadgeContext): BadgeProgress[] {
  return BADGES.map((b) => ({
    ...describeBadge(b),
    earned: b.earned(context),
    progress: b.progress ? b.progress(context) : null,
  }));
}
