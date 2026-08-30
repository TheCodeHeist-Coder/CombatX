import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BADGE_METRICS,
  describeRule,
  METRIC_LABELS,
  readMetric,
  ruleMet,
  ruleProgress,
  type RuleContext,
} from "./badgeRules.js";
import { DEFAULT_BADGE_RULES } from "./badgeDefaults.js";
import { BADGES, evaluateBadges, TIERS, tierFor, type BadgeContext } from "./badges.js";
import { INITIAL_RATING, type RatingState } from "./rating.js";

const settled = (rating: number): RatingState => ({ rating, rd: 45, volatility: 0.06 });

function ctx(over: Partial<RuleContext> = {}): RuleContext {
  const rating = over.rating ?? settled(1500);
  const held = tierFor(rating);
  return {
    wins: 0, losses: 0, draws: 0, xp: 0, bestStreak: 0, rankedBattles: 0,
    upsetWins: 0, perfectWins: 0, easyWins: 0, mediumWins: 0, hardWins: 0,
    distinctProblemsWon: 0, accountAgeDays: 0, signupOrdinal: 5000,
    rating,
    tierIndex: held ? TIERS.findIndex((t) => t.key === held.key) : -1,
    ...over,
  };
}

/** The same facts, shaped for the hard-coded evaluator. */
function asBadgeContext(c: RuleContext): BadgeContext {
  return {
    wins: c.wins, losses: c.losses, xp: c.xp, bestStreak: c.bestStreak,
    rankedBattles: c.rankedBattles, rating: c.rating, upsetWins: c.upsetWins,
    perfectWins: c.perfectWins, easyWins: c.easyWins, mediumWins: c.mediumWins,
    hardWins: c.hardWins, distinctProblemsWon: c.distinctProblemsWon,
    signupOrdinal: c.signupOrdinal, accountAgeDays: c.accountAgeDays,
  };
}

/**
 * THE test for this module.
 *
 * The declarative defaults must award exactly what the hard-coded predicates
 * award, for every profile shape. If these ever disagree, moving badges into
 * the database silently changed who holds what — a data bug nobody notices
 * until a player complains their badge vanished.
 */
test("the default rules match the hard-coded badge table exactly", () => {
  const profiles: Partial<RuleContext>[] = [
    {},
    { wins: 1 },
    { wins: 10 }, { wins: 29 }, { wins: 30 }, { wins: 59 }, { wins: 60 },
    { wins: 99 }, { wins: 100 }, { wins: 500 },
    { bestStreak: 2 }, { bestStreak: 3 }, { bestStreak: 10 }, { bestStreak: 25 },
    { easyWins: 24 }, { easyWins: 25 },
    { mediumWins: 9 }, { mediumWins: 10 }, { mediumWins: 30 },
    { hardWins: 0 }, { hardWins: 1 }, { hardWins: 10 }, { hardWins: 30 },
    { easyWins: 10, mediumWins: 10, hardWins: 9 },
    { easyWins: 10, mediumWins: 10, hardWins: 10 },
    { perfectWins: 9 }, { perfectWins: 10 },
    { upsetWins: 9 }, { upsetWins: 10 },
    { distinctProblemsWon: 24 }, { distinctProblemsWon: 25 },
    { rankedBattles: 249 }, { rankedBattles: 250 },
    { accountAgeDays: 364, rankedBattles: 20 },
    { accountAgeDays: 365, rankedBattles: 19 },
    { accountAgeDays: 365, rankedBattles: 20 },
    { signupOrdinal: 1 }, { signupOrdinal: 100 }, { signupOrdinal: 101 },
    { signupOrdinal: 0 },
    { signupOrdinal: 3, wins: 9 }, { signupOrdinal: 3, wins: 10 },
    { rating: INITIAL_RATING },
    { rating: settled(1200) }, { rating: settled(1550) },
    { rating: settled(1760) }, { rating: settled(2000) },
    { rating: { rating: 2200, rd: 200, volatility: 0.06 } },
    { wins: 300, hardWins: 40, bestStreak: 30, perfectWins: 20, upsetWins: 20,
      easyWins: 50, mediumWins: 50, distinctProblemsWon: 40, rankedBattles: 400,
      accountAgeDays: 500, signupOrdinal: 2, rating: settled(2000) },
  ];

  for (const over of profiles) {
    const c = ctx(over);
    const fromRules = DEFAULT_BADGE_RULES.filter((r) => ruleMet(r, c))
      .map((r) => r.key).sort();
    const fromCode = evaluateBadges(asBadgeContext(c)).map((b) => b.key).sort();

    assert.deepEqual(
      fromRules, fromCode,
      `mismatch for ${JSON.stringify(over)}\n  rules: ${fromRules}\n  code:  ${fromCode}`,
    );
  }
});

test("every hard-coded badge has a default rule, and vice versa", () => {
  const code = BADGES.map((b) => b.key).sort();
  const rules = DEFAULT_BADGE_RULES.map((r) => r.key).sort();
  assert.deepEqual(rules, code);
});

test("default rules carry the same labels and rarities as the code table", () => {
  for (const rule of DEFAULT_BADGE_RULES) {
    const def = BADGES.find((b) => b.key === rule.key)!;
    assert.equal(rule.label, def.label, rule.key);
    assert.equal(rule.rarity, def.rarity, rule.key);
    assert.equal(rule.category, def.category, rule.key);
    assert.equal(rule.description, def.description, rule.key);
  }
});

// --- The rule engine itself -----------------------------------------------

test("a rule with no conditions is never earned", () => {
  const empty = { ...DEFAULT_BADGE_RULES[0]!, conditions: [] };
  assert.equal(ruleMet(empty, ctx({ wins: 9999 })), false);
});

test("a disabled rule is never earned", () => {
  const off = { ...DEFAULT_BADGE_RULES[0]!, enabled: false };
  assert.equal(ruleMet(off, ctx({ wins: 9999 })), false);
});

test("all conditions must hold, not just one", () => {
  const rule = DEFAULT_BADGE_RULES.find((r) => r.key === "ALL_ROUNDER")!;
  assert.equal(ruleMet(rule, ctx({ easyWins: 99, mediumWins: 99, hardWins: 9 })), false);
  assert.equal(ruleMet(rule, ctx({ easyWins: 10, mediumWins: 10, hardWins: 10 })), true);
});

test("an unassigned signup ordinal never satisfies a Pioneer rule", () => {
  // 0 means "predates the counter". Without the guard it would satisfy every
  // `lte` and hand Pioneer to the entire pre-existing user base.
  const rule = DEFAULT_BADGE_RULES.find((r) => r.key === "PIONEER")!;
  assert.equal(ruleMet(rule, ctx({ signupOrdinal: 0 })), false);
  assert.equal(ruleMet(rule, ctx({ signupOrdinal: 1 })), true);
});

test("changing a threshold changes who qualifies", () => {
  // The whole point of the feature: an admin lowers Centurion to 50 wins.
  const base = DEFAULT_BADGE_RULES.find((r) => r.key === "HUNDRED_WINS")!;
  const c = ctx({ wins: 60 });
  assert.equal(ruleMet(base, c), false);

  const retuned = { ...base, conditions: [{ ...base.conditions[0]!, threshold: 50 }] };
  assert.equal(ruleMet(retuned, c), true);
});

test("progress tracks the nominated condition", () => {
  const rule = DEFAULT_BADGE_RULES.find((r) => r.key === "TEN_WINS")!;
  assert.equal(ruleProgress(rule, ctx({ wins: 5 })), 0.5);
  assert.equal(ruleProgress(rule, ctx({ wins: 10 })), 1);
  assert.equal(ruleProgress(rule, ctx({ wins: 99 })), 1, "clamped");
});

test("All Rounder progress reports the hard leg, not the average", () => {
  const rule = DEFAULT_BADGE_RULES.find((r) => r.key === "ALL_ROUNDER")!;
  assert.equal(ruleProgress(rule, ctx({ easyWins: 10, mediumWins: 10, hardWins: 0 })), 0);
  assert.equal(ruleProgress(rule, ctx({ easyWins: 0, mediumWins: 0, hardWins: 5 })), 0.5);
});

test("a rule with progressFrom null reports no progress", () => {
  const rule = DEFAULT_BADGE_RULES.find((r) => r.key === "PIONEER")!;
  assert.equal(ruleProgress(rule, ctx({ signupOrdinal: 5000 })), null);
});

test("every metric is readable and labelled", () => {
  const c = ctx({ wins: 7, losses: 3 });
  for (const m of BADGE_METRICS) {
    assert.equal(typeof readMetric(m, c), "number", m);
    assert.ok(METRIC_LABELS[m], `${m} needs a label`);
  }
});

test("winRate is a percentage and safe at zero battles", () => {
  assert.equal(readMetric("winRate", ctx({ wins: 0, losses: 0 })), 0);
  assert.equal(readMetric("winRate", ctx({ wins: 3, losses: 1 })), 75);
});

test("tierIndex is -1 while provisional, so tier rules cannot fire", () => {
  const c = ctx({ rating: INITIAL_RATING });
  assert.equal(c.tierIndex, -1);
  const rule = DEFAULT_BADGE_RULES.find((r) => r.key === "ALPHA_CLASS")!;
  assert.equal(ruleMet(rule, c), false);
});

test("describeRule reads as a sentence", () => {
  const rule = DEFAULT_BADGE_RULES.find((r) => r.key === "ALL_ROUNDER")!;
  const text = describeRule(rule);
  assert.ok(text.includes("and"), text);
  assert.ok(text.includes("10"), text);
  assert.equal(describeRule({ ...rule, conditions: [] }), "No conditions — never awarded");
});

test("default rule keys are unique and sort orders ascend", () => {
  const keys = new Set(DEFAULT_BADGE_RULES.map((r) => r.key));
  assert.equal(keys.size, DEFAULT_BADGE_RULES.length);
  const orders = DEFAULT_BADGE_RULES.map((r) => r.sortOrder);
  assert.deepEqual(orders, [...orders].sort((a, b) => a - b), "keep the file ordered");
});
