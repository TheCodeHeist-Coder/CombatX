import { test } from "node:test";
import assert from "node:assert/strict";
import {
  computeAward,
  rankFor,
  nextRank,
  rankProgress,
  streakMultiplier,
} from "./progression.js";

test("a loss earns participation + per-test XP, and no multiplier", () => {
  const a = computeAward({
    won: false,
    passed: 3,
    total: 5,
    previousStreak: 4,
  });
  assert.equal(a.baseXp, 25 + 3 * 10);
  assert.equal(a.multiplier, 1);
  assert.equal(a.xp, 55);
});

test("a loss resets the streak to zero", () => {
  const a = computeAward({ won: false, passed: 5, total: 5, previousStreak: 7 });
  assert.equal(a.newStreak, 0);
});

test("a win adds the win bonus and extends the streak", () => {
  const a = computeAward({ won: true, passed: 2, total: 5, previousStreak: 0 });
  assert.equal(a.newStreak, 1);
  assert.equal(a.baseXp, 25 + 200 + 2 * 10);
  assert.equal(a.multiplier, 1, "first win is not multiplied");
});

test("a perfect run earns the flawless bonus", () => {
  const a = computeAward({ won: true, passed: 5, total: 5, previousStreak: 0 });
  assert.equal(a.perfect, true);
  assert.equal(a.baseXp, 25 + 200 + 50 + 75);
});

test("passing zero tests still awards participation", () => {
  const a = computeAward({ won: false, passed: 0, total: 5, previousStreak: 0 });
  assert.equal(a.xp, 25);
  assert.equal(a.perfect, false, "0/5 is not a perfect run");
});

test("total of zero is never treated as perfect", () => {
  const a = computeAward({ won: true, passed: 0, total: 0, previousStreak: 0 });
  assert.equal(a.perfect, false);
});

test("streak multiplier steps by 0.25 and caps at 2.5", () => {
  assert.equal(streakMultiplier(0), 1);
  assert.equal(streakMultiplier(1), 1);
  assert.equal(streakMultiplier(2), 1.25);
  assert.equal(streakMultiplier(3), 1.5);
  assert.equal(streakMultiplier(50), 2.5, "capped");
});

test("the multiplier applies to a streak win", () => {
  const a = computeAward({ won: true, passed: 0, total: 5, previousStreak: 1 });
  assert.equal(a.newStreak, 2);
  assert.equal(a.multiplier, 1.25);
  assert.equal(a.xp, Math.round((25 + 200) * 1.25));
});

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
