/**
 * The shipped badge set, as declarative rules.
 *
 * This is the seed for the database table and the fallback whenever the
 * database has no rules — a fresh install, or a failed read. It is the SAME
 * set the hard-coded table in badges.ts describes, expressed as data so an
 * admin can retune a threshold without a deploy.
 *
 * Editing this file changes what a NEW install starts with. It does not change
 * an existing install: once rules are seeded they live in the database, and
 * the admin console is the way to change them. That separation is the point —
 * an operator's tuning must not be silently reverted by the next release.
 */

import type { BadgeRule } from "./badgeRules.js";

/** Tier index of Gamma / Beta / Alpha in the TIERS table, for tier rules. */
const TIER_GAMMA = 3;
const TIER_BETA = 4;
const TIER_ALPHA = 5;

/** How many of the first accounts count as founders. */
export const DEFAULT_PIONEER_CUTOFF = 100;

/** Shorthand for the overwhelmingly common "reach N of something" rule. */
function reach(metric: BadgeRule["conditions"][number]["metric"], threshold: number) {
  return { metric, comparator: "gte" as const, threshold };
}

export const DEFAULT_BADGE_RULES: BadgeRule[] = [
  // --- Milestones: volume. Anyone reaches these by turning up. ---
  {
    key: "FIRST_BLOOD", label: "First Blood",
    description: "Won their first battle.",
    category: "MILESTONE", rarity: "COMMON", artKey: "FIRST_BLOOD", glyph: "I",
    conditions: [reach("wins", 1)], progressFrom: 0, enabled: true, sortOrder: 10,
  },
  {
    key: "TEN_WINS", label: "Contender",
    description: "Won 10 battles.",
    category: "MILESTONE", rarity: "COMMON", artKey: "TEN_WINS", glyph: "X",
    conditions: [reach("wins", 10)], progressFrom: 0, enabled: true, sortOrder: 20,
  },
  {
    key: "THIRTY_WINS", label: "Duellist",
    description: "Won 30 battles.",
    category: "MILESTONE", rarity: "UNCOMMON", artKey: "THIRTY_WINS", glyph: "D",
    conditions: [reach("wins", 30)], progressFrom: 0, enabled: true, sortOrder: 30,
  },
  {
    key: "SIXTY_WINS", label: "Gladiator",
    description: "Won 60 battles.",
    category: "MILESTONE", rarity: "RARE", artKey: "SIXTY_WINS", glyph: "L",
    conditions: [reach("wins", 60)], progressFrom: 0, enabled: true, sortOrder: 40,
  },
  {
    key: "HUNDRED_WINS", label: "Centurion",
    description: "Won 100 battles.",
    category: "MILESTONE", rarity: "RARE", artKey: "HUNDRED_WINS", glyph: "C",
    conditions: [reach("wins", 100)], progressFrom: 0, enabled: true, sortOrder: 50,
  },
  {
    key: "VETERAN", label: "Veteran",
    description: "Fought 250 ranked battles.",
    category: "MILESTONE", rarity: "RARE", artKey: "VETERAN", glyph: "V",
    conditions: [reach("rankedBattles", 250)], progressFrom: 0, enabled: true, sortOrder: 60,
  },
  {
    key: "POLYGLOT", label: "Well Read",
    description: "Won on 25 different problems.",
    category: "MILESTONE", rarity: "UNCOMMON", artKey: "POLYGLOT", glyph: "P",
    conditions: [reach("distinctProblemsWon", 25)], progressFrom: 0, enabled: true, sortOrder: 70,
  },

  // --- Difficulty: what KIND of problem a player can beat. ---
  {
    key: "EASY_RIDER", label: "Easy Rider",
    description: "Won 25 battles on easy problems.",
    category: "DIFFICULTY", rarity: "COMMON", artKey: "EASY_RIDER", glyph: "e",
    conditions: [reach("easyWins", 25)], progressFrom: 0, enabled: true, sortOrder: 110,
  },
  {
    key: "MIDDLEWEIGHT", label: "Middleweight",
    description: "Won 10 battles on medium problems.",
    category: "DIFFICULTY", rarity: "UNCOMMON", artKey: "MIDDLEWEIGHT", glyph: "m",
    conditions: [reach("mediumWins", 10)], progressFrom: 0, enabled: true, sortOrder: 120,
  },
  {
    key: "HEAVYWEIGHT", label: "Heavyweight",
    description: "Won 30 battles on medium problems.",
    category: "DIFFICULTY", rarity: "RARE", artKey: "HEAVYWEIGHT", glyph: "M",
    conditions: [reach("mediumWins", 30)], progressFrom: 0, enabled: true, sortOrder: 130,
  },
  {
    key: "HARD_LINER", label: "Hard Liner",
    description: "Won their first battle on a hard problem.",
    category: "DIFFICULTY", rarity: "UNCOMMON", artKey: "HARD_LINER", glyph: "h",
    conditions: [reach("hardWins", 1)], progressFrom: 0, enabled: true, sortOrder: 140,
  },
  {
    key: "CRUCIBLE", label: "Crucible",
    description: "Won 10 battles on hard problems.",
    category: "DIFFICULTY", rarity: "RARE", artKey: "CRUCIBLE", glyph: "H",
    conditions: [reach("hardWins", 10)], progressFrom: 0, enabled: true, sortOrder: 150,
  },
  {
    key: "APEX", label: "Apex",
    description: "Won 30 battles on hard problems.",
    category: "DIFFICULTY", rarity: "LEGENDARY", artKey: "APEX", glyph: "&",
    conditions: [reach("hardWins", 30)], progressFrom: 0, enabled: true, sortOrder: 160,
  },
  {
    key: "ALL_ROUNDER", label: "All Rounder",
    description: "Won at least 10 battles at every difficulty.",
    category: "DIFFICULTY", rarity: "RARE", artKey: "ALL_ROUNDER", glyph: "O",
    conditions: [reach("easyWins", 10), reach("mediumWins", 10), reach("hardWins", 10)],
    // Points at the HARD leg, which is the one players neglect: progress from
    // the easy leg would read as nearly-done for someone who has never won a
    // hard battle.
    progressFrom: 2, enabled: true, sortOrder: 170,
  },

  // --- Streaks: consistency under pressure. ---
  {
    key: "HAT_TRICK", label: "Hat Trick",
    description: "Won three battles in a row.",
    category: "STREAK", rarity: "COMMON", artKey: "HAT_TRICK", glyph: "3",
    conditions: [reach("bestStreak", 3)], progressFrom: 0, enabled: true, sortOrder: 210,
  },
  {
    key: "UNBROKEN", label: "Unbroken",
    description: "Won ten battles in a row.",
    category: "STREAK", rarity: "RARE", artKey: "UNBROKEN", glyph: "U",
    conditions: [reach("bestStreak", 10)], progressFrom: 0, enabled: true, sortOrder: 220,
  },
  {
    key: "IMMORTAL", label: "Immortal",
    description: "Won twenty-five battles in a row.",
    category: "STREAK", rarity: "LEGENDARY", artKey: "IMMORTAL", glyph: "!",
    conditions: [reach("bestStreak", 25)], progressFrom: 0, enabled: true, sortOrder: 230,
  },

  // --- Skill: these require being good, not just present. ---
  {
    key: "FLAWLESS", label: "Flawless",
    description: "Won 10 battles passing every single test.",
    category: "SKILL", rarity: "UNCOMMON", artKey: "FLAWLESS", glyph: "*",
    conditions: [reach("perfectWins", 10)], progressFrom: 0, enabled: true, sortOrder: 310,
  },
  {
    key: "GIANT_SLAYER", label: "Giant Slayer",
    description: "Beat 10 opponents rated far above them.",
    category: "SKILL", rarity: "RARE", artKey: "GIANT_SLAYER", glyph: "^",
    conditions: [reach("upsetWins", 10)], progressFrom: 0, enabled: true, sortOrder: 320,
  },
  {
    key: "RANKED", label: "Ranked",
    description: "Played enough battles to earn a placed rating.",
    category: "SKILL", rarity: "COMMON", artKey: "RANKED", glyph: "R",
    conditions: [reach("placed", 1)], progressFrom: null, enabled: true, sortOrder: 330,
  },
  {
    key: "GAMMA_CLASS", label: "Gamma Class",
    description: "Reached the Gamma tier.",
    category: "SKILL", rarity: "UNCOMMON", artKey: "GAMMA_CLASS", glyph: "G",
    conditions: [reach("tierIndex", TIER_GAMMA)], progressFrom: null, enabled: true, sortOrder: 340,
  },
  {
    key: "BETA_CLASS", label: "Beta Class",
    description: "Reached the Beta tier.",
    category: "SKILL", rarity: "RARE", artKey: "BETA_CLASS", glyph: "B",
    conditions: [reach("tierIndex", TIER_BETA)], progressFrom: null, enabled: true, sortOrder: 350,
  },
  {
    key: "ALPHA_CLASS", label: "Alpha Class",
    description: "Reached the Alpha tier.",
    category: "SKILL", rarity: "LEGENDARY", artKey: "ALPHA_CLASS", glyph: "A",
    conditions: [reach("tierIndex", TIER_ALPHA)], progressFrom: null, enabled: true, sortOrder: 360,
  },

  // --- Pioneer: being here early. Cannot be earned later, by anyone. ---
  {
    key: "PIONEER", label: "Pioneer",
    description: `One of the first ${DEFAULT_PIONEER_CUTOFF} operatives to enlist.`,
    category: "PIONEER", rarity: "LEGENDARY", artKey: "PIONEER", glyph: "1",
    // `lte` on the signup number: a LOW ordinal is the achievement. The
    // evaluator also requires a real ordinal, so accounts that predate the
    // counter (ordinal 0) do not qualify.
    conditions: [{ metric: "signupOrdinal", comparator: "lte", threshold: DEFAULT_PIONEER_CUTOFF }],
    progressFrom: null, enabled: true, sortOrder: 410,
  },
  {
    key: "FOUNDING_COMBATANT", label: "Founding Combatant",
    description: "Enlisted early and actually fought.",
    category: "PIONEER", rarity: "LEGENDARY", artKey: "FOUNDING_COMBATANT", glyph: "F",
    conditions: [
      { metric: "signupOrdinal", comparator: "lte", threshold: DEFAULT_PIONEER_CUTOFF },
      reach("wins", 10),
    ],
    progressFrom: 1, enabled: true, sortOrder: 420,
  },
  {
    key: "LOYALIST", label: "Loyalist",
    description: "Still fighting a year after enlisting.",
    category: "PIONEER", rarity: "RARE", artKey: "LOYALIST", glyph: "Y",
    conditions: [reach("accountAgeDays", 365), reach("rankedBattles", 20)],
    progressFrom: 0, enabled: true, sortOrder: 430,
  },
];
