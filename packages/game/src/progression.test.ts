import { test } from "node:test";
import assert from "node:assert/strict";
import {
  computeAward,
  DIFFICULTY_WEIGHT,
  FULL_RATE_BATTLES,
  nextRank,
  rankFor,
  rankProgress,
  streakMultiplier,
  type AwardInput,
} from "./progression.js";

/** A default battle: EASY, ran to time, first of the day. */
function award(over: Partial<AwardInput> = {}) {
  return computeAward({
    won: false,
    passed: 0,
    total: 5,
    previousStreak: 0,
    difficulty: "EASY",
    reason: "TIMEOUT",
    battlesToday: 0,
    ...over,
  });
}

test("a loss earns participation plus a share of the test pool", () => {
  const a = award({ passed: 3, total: 5, previousStreak: 4 });
  // 25 participation + 3/5 of the 100-point test pool.
  assert.equal(a.baseXp, 85);
  assert.equal(a.multiplier, 1);
  assert.equal(a.xp, 85);
});

test("a loss resets the streak to zero", () => {
  assert.equal(award({ passed: 5, total: 5, previousStreak: 7 }).newStreak, 0);
});

test("a win adds the win bonus and extends the streak", () => {
  const a = award({ won: true, passed: 2, total: 5 });
  assert.equal(a.newStreak, 1);
  assert.equal(a.baseXp, 25 + 200 + 40);
  assert.equal(a.multiplier, 1, "first win is not multiplied");
});

test("a perfect run earns the flawless bonus", () => {
  const a = award({ won: true, passed: 5, total: 5 });
  assert.equal(a.perfect, true);
  assert.equal(a.baseXp, 25 + 200 + 100 + 75);
});

test("passing zero tests still awards participation", () => {
  const a = award({ passed: 0, total: 5 });
  assert.equal(a.xp, 25);
  assert.equal(a.perfect, false, "0/5 is not a perfect run");
});

test("total of zero is never treated as perfect", () => {
  assert.equal(award({ won: true, passed: 0, total: 0 }).perfect, false);
});

/**
 * The regression this replaced: XP used to be 10 per test passed, so a
 * 30-test problem paid three times a 10-test problem for the same play.
 */
test("problem size does not change the payout for equivalent play", () => {
  const small = award({ won: true, passed: 5, total: 10 });
  const large = award({ won: true, passed: 15, total: 30 });
  assert.equal(small.xp, large.xp, "half the tests is half the tests");
});

test("streak multiplier steps by 0.25 and caps at 2.5", () => {
  assert.equal(streakMultiplier(0), 1);
  assert.equal(streakMultiplier(1), 1);
  assert.equal(streakMultiplier(2), 1.25);
  assert.equal(streakMultiplier(3), 1.5);
  assert.equal(streakMultiplier(50), 2.5, "capped");
});

test("the multiplier applies to a streak win", () => {
  const a = award({ won: true, passed: 0, total: 5, previousStreak: 1 });
  assert.equal(a.newStreak, 2);
  assert.equal(a.multiplier, 1.25);
  assert.equal(a.xp, Math.round((25 + 200) * 1.25));
});

// --- Difficulty ------------------------------------------------------------

test("harder problems pay more for identical play", () => {
  const easy = award({ won: true, passed: 5, total: 5, difficulty: "EASY" });
  const medium = award({ won: true, passed: 5, total: 5, difficulty: "MEDIUM" });
  const hard = award({ won: true, passed: 5, total: 5, difficulty: "HARD" });

  assert.ok(medium.xp > easy.xp);
  assert.ok(hard.xp > medium.xp);
  assert.equal(hard.xp, Math.round(easy.baseXp * DIFFICULTY_WEIGHT.HARD));
});

test("the difficulty weight is reported for the breakdown", () => {
  assert.equal(award({ difficulty: "HARD" }).difficultyWeight, 2.2);
});

// --- Forfeits --------------------------------------------------------------

test("a forfeit win pays participation only", () => {
  const a = award({
    won: true,
    passed: 5,
    total: 5,
    difficulty: "HARD",
    reason: "FORFEIT",
  });
  assert.equal(a.xp, 25, "no win bonus, no test pool, no difficulty weight");
  assert.equal(a.multiplier, 1);
  assert.equal(a.perfect, false);
});

test("a forfeit does not extend a win streak", () => {
  const a = award({ won: true, previousStreak: 4, reason: "FORFEIT" });
  assert.equal(a.newStreak, 4, "held, not advanced");

  // And winning normally afterwards resumes from where it was.
  const next = award({ won: true, previousStreak: a.newStreak });
  assert.equal(next.newStreak, 5);
});

test("a forfeit loss still clears the streak", () => {
  assert.equal(award({ won: false, previousStreak: 6, reason: "FORFEIT" }).newStreak, 0);
});

// --- Anti-grind taper ------------------------------------------------------

test("XP is paid in full up to the daily threshold", () => {
  const first = award({ won: true, battlesToday: 0 });
  const last = award({ won: true, battlesToday: FULL_RATE_BATTLES - 1 });
  assert.equal(first.xp, last.xp);
  assert.equal(last.taper, 1);
});

test("XP tapers past the daily threshold but never reaches zero", () => {
  const before = award({ won: true, battlesToday: FULL_RATE_BATTLES - 1 });
  const after = award({ won: true, battlesToday: FULL_RATE_BATTLES });

  assert.ok(after.xp < before.xp, "the taper must bite");
  assert.ok(after.xp > 0, "grinding still pays something");
  assert.ok(after.taper < 1);
});

test("the taper never touches the reported base XP", () => {
  const fresh = award({ won: true, battlesToday: 0 });
  const tired = award({ won: true, battlesToday: 40 });
  assert.equal(fresh.baseXp, tired.baseXp, "the breakdown stays honest");
});

// --- Ranks -----------------------------------------------------------------

test("rankFor returns the highest tier at or below the xp", () => {
  assert.equal(rankFor(0).key, "RECRUIT");
  assert.equal(rankFor(499).key, "RECRUIT");
  assert.equal(rankFor(500).key, "OPERATIVE", "boundary is inclusive");
  assert.equal(rankFor(999999).key, "COMMANDER");
});

test("nextRank is null only at the ceiling", () => {
  assert.equal(nextRank(0)?.key, "OPERATIVE");
  assert.equal(nextRank(999999), null);
});

test("rankProgress is 0 at a boundary, and 1 at the ceiling", () => {
  assert.equal(rankProgress(0), 0);
  assert.equal(rankProgress(500), 0, "start of Operative");
  assert.equal(rankProgress(1000), 0.5, "halfway to Specialist");
  assert.equal(rankProgress(999999), 1, "maxed");
});
