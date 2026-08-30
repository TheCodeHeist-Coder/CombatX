import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isPlaced,
  PLACEMENT_BATTLES,
  BADGES,
  badgeByKey,
  badgeProgress,
  evaluateBadges,
  newlyEarned,
  nextTier,
  PIONEER_CUTOFF,
  TIERS,
  tierFor,
  tierProgress,
  type BadgeContext,
} from "./badges.js";
import {
  INITIAL_RATING,
  isProvisional,
  rateOneOnOne,
  type RatingState,
} from "./rating.js";

/** A settled rating at a given number, past the provisional gate. */
const at = (rating: number): RatingState => ({ rating, rd: 45, volatility: 0.06 });

function ctx(over: Partial<BadgeContext> = {}): BadgeContext {
  return {
    wins: 0,
    losses: 0,
    xp: 0,
    bestStreak: 0,
    rankedBattles: 0,
    rating: at(1500),
    upsetWins: 0,
    perfectWins: 0,
    distinctProblemsWon: 0,
    easyWins: 0,
    mediumWins: 0,
    hardWins: 0,
    signupOrdinal: 5000,
    accountAgeDays: 1,
    ...over,
  };
}

// --- Tiers -----------------------------------------------------------------

test("a provisional rating holds no tier at all", () => {
  assert.equal(tierFor(INITIAL_RATING), null, "unranked, not Iota");
  assert.equal(nextTier(INITIAL_RATING), null);
  assert.equal(tierProgress(INITIAL_RATING), 0);
});

test("tiers are awarded on the conservative rating, not the raw one", () => {
  // 1600 raw, but wide enough that the confidence floor is far lower.
  const shaky: RatingState = { rating: 1600, rd: 95, volatility: 0.06 };
  const solid: RatingState = { rating: 1600, rd: 30, volatility: 0.06 };

  const shakyTier = tierFor(shaky);
  const solidTier = tierFor(solid);

  assert.ok(shakyTier && solidTier);
  assert.notEqual(
    shakyTier.key,
    solidTier.key,
    "certainty must be part of the claim",
  );
});

test("tier boundaries are inclusive and ascend", () => {
  // conservativeRating = rating - 2*rd, so rd 45 means +90 to clear a bound.
  assert.equal(tierFor(at(1450 + 90))?.key, "GAMMA");
  assert.equal(tierFor(at(1650 + 90))?.key, "BETA");
  assert.equal(tierFor(at(1850 + 90))?.key, "ALPHA");
  assert.equal(tierFor(at(100))?.key, "IOTA");
});

test("the top tier reports complete progress and no next tier", () => {
  const top = at(2400);
  assert.equal(nextTier(top), null);
  assert.equal(tierProgress(top), 1);
});

test("tier progress stays within 0..1", () => {
  for (const rating of [200, 1200, 1500, 1700, 1900, 2500]) {
    const p = tierProgress(at(rating));
    assert.ok(p >= 0 && p <= 1, `progress ${p} out of range at ${rating}`);
  }
});

test("TIERS is ordered by ascending threshold", () => {
  for (let i = 1; i < TIERS.length; i += 1) {
    assert.ok(
      TIERS[i]!.minRating > TIERS[i - 1]!.minRating,
      `${TIERS[i]!.key} must sit above ${TIERS[i - 1]!.key}`,
    );
  }
});

// --- Badge table integrity -------------------------------------------------

test("every badge key is unique", () => {
  const keys = new Set(BADGES.map((b) => b.key));
  assert.equal(keys.size, BADGES.length);
});

test("every badge is retrievable by key", () => {
  for (const b of BADGES) assert.equal(badgeByKey(b.key)?.label, b.label);
  assert.equal(badgeByKey("NO_SUCH_BADGE"), null);
});

test("a blank slate earns nothing", () => {
  // rating at 1500/rd 45 clears provisional, so RANKED and the Iota-level
  // tier badges are the only things a zero-record player can hold.
  const earned = evaluateBadges(ctx({ rating: INITIAL_RATING }));
  assert.equal(earned.length, 0, `unexpectedly earned ${earned.map((b) => b.key)}`);
});

// --- Individual badges -----------------------------------------------------

test("First Blood needs exactly one win", () => {
  assert.ok(!has(ctx(), "FIRST_BLOOD"));
  assert.ok(has(ctx({ wins: 1 }), "FIRST_BLOOD"));
});

test("win milestones unlock in order", () => {
  assert.ok(has(ctx({ wins: 10 }), "TEN_WINS"));
  assert.ok(!has(ctx({ wins: 29 }), "THIRTY_WINS"));
  assert.ok(has(ctx({ wins: 30 }), "THIRTY_WINS"));
  assert.ok(!has(ctx({ wins: 59 }), "SIXTY_WINS"));
  assert.ok(has(ctx({ wins: 60 }), "SIXTY_WINS"));
  assert.ok(!has(ctx({ wins: 99 }), "HUNDRED_WINS"));
  assert.ok(has(ctx({ wins: 100 }), "HUNDRED_WINS"));
});

test("reaching a higher milestone implies the lower ones", () => {
  const veteran = ctx({ wins: 100 });
  for (const key of ["FIRST_BLOOD", "TEN_WINS", "THIRTY_WINS", "SIXTY_WINS"]) {
    assert.ok(has(veteran, key), `${key} should still be held at 100 wins`);
  }
});

// --- Difficulty badges -----------------------------------------------------

test("difficulty badges count only their own difficulty", () => {
  // 500 easy wins must never unlock a hard-problem badge. This is the whole
  // reason the counters are kept separate.
  const grinder = ctx({ wins: 500, easyWins: 500 });
  assert.ok(has(grinder, "EASY_RIDER"));
  assert.ok(!has(grinder, "MIDDLEWEIGHT"));
  assert.ok(!has(grinder, "HARD_LINER"));
  assert.ok(!has(grinder, "CRUCIBLE"));
  assert.ok(!has(grinder, "APEX"));
});

test("the medium ladder steps at 10 then 30", () => {
  assert.ok(!has(ctx({ mediumWins: 9 }), "MIDDLEWEIGHT"));
  assert.ok(has(ctx({ mediumWins: 10 }), "MIDDLEWEIGHT"));
  assert.ok(!has(ctx({ mediumWins: 29 }), "HEAVYWEIGHT"));
  assert.ok(has(ctx({ mediumWins: 30 }), "HEAVYWEIGHT"));
});

test("the hard ladder steps at 1, 10 then 30", () => {
  assert.ok(!has(ctx({ hardWins: 0 }), "HARD_LINER"));
  assert.ok(has(ctx({ hardWins: 1 }), "HARD_LINER"));
  assert.ok(!has(ctx({ hardWins: 9 }), "CRUCIBLE"));
  assert.ok(has(ctx({ hardWins: 10 }), "CRUCIBLE"));
  assert.ok(!has(ctx({ hardWins: 29 }), "APEX"));
  assert.ok(has(ctx({ hardWins: 30 }), "APEX"));
});

test("All Rounder needs every difficulty, not a big total", () => {
  assert.ok(!has(ctx({ easyWins: 100, mediumWins: 100, hardWins: 9 }), "ALL_ROUNDER"));
  assert.ok(has(ctx({ easyWins: 10, mediumWins: 10, hardWins: 10 }), "ALL_ROUNDER"));
});

test("All Rounder progress reflects the weakest difficulty", () => {
  const rows = badgeProgress(ctx({ easyWins: 10, mediumWins: 10, hardWins: 0 }));
  const all = rows.find((r) => r.key === "ALL_ROUNDER")!;
  assert.equal(all.earned, false);
  assert.equal(all.progress, 0, "never won a hard battle: 0, not 2/3");
});

test("streak badges track the best streak, not the current one", () => {
  assert.ok(has(ctx({ bestStreak: 3 }), "HAT_TRICK"));
  assert.ok(has(ctx({ bestStreak: 10 }), "UNBROKEN"));
  assert.ok(!has(ctx({ bestStreak: 24 }), "IMMORTAL"));
  assert.ok(has(ctx({ bestStreak: 25 }), "IMMORTAL"));
});

test("Ranked is held once the rating is no longer provisional", () => {
  assert.ok(!has(ctx({ rating: INITIAL_RATING }), "RANKED"));
  assert.ok(has(ctx({ rating: at(1500) }), "RANKED"));
});

test("class badges require the matching tier or better", () => {
  const gamma = ctx({ rating: at(1550) });
  assert.ok(has(gamma, "GAMMA_CLASS"));
  assert.ok(!has(gamma, "BETA_CLASS"));

  // Alpha implies Beta implies Gamma: reaching the top holds them all.
  const alpha = ctx({ rating: at(2000) });
  assert.ok(has(alpha, "ALPHA_CLASS"));
  assert.ok(has(alpha, "BETA_CLASS"));
  assert.ok(has(alpha, "GAMMA_CLASS"));
});

test("a provisional player holds no class badge however high the raw rating", () => {
  const lucky = ctx({ rating: { rating: 2200, rd: 200, volatility: 0.06 } });
  assert.ok(!has(lucky, "ALPHA_CLASS"));
  assert.ok(!has(lucky, "GAMMA_CLASS"));
});

test("Pioneer is bounded by the signup cutoff", () => {
  assert.ok(has(ctx({ signupOrdinal: 1 }), "PIONEER"));
  assert.ok(has(ctx({ signupOrdinal: PIONEER_CUTOFF }), "PIONEER"));
  assert.ok(!has(ctx({ signupOrdinal: PIONEER_CUTOFF + 1 }), "PIONEER"));
  // An unknown ordinal must not silently award it.
  assert.ok(!has(ctx({ signupOrdinal: 0 }), "PIONEER"));
});

test("Founding Combatant needs both an early signup and real play", () => {
  assert.ok(!has(ctx({ signupOrdinal: 3, wins: 9 }), "FOUNDING_COMBATANT"));
  assert.ok(has(ctx({ signupOrdinal: 3, wins: 10 }), "FOUNDING_COMBATANT"));
  assert.ok(!has(ctx({ signupOrdinal: 900, wins: 500 }), "FOUNDING_COMBATANT"));
});

test("Loyalist needs a year AND continued play", () => {
  assert.ok(!has(ctx({ accountAgeDays: 400, rankedBattles: 5 }), "LOYALIST"));
  assert.ok(has(ctx({ accountAgeDays: 400, rankedBattles: 20 }), "LOYALIST"));
});

// --- Newly earned ----------------------------------------------------------

test("newlyEarned excludes what is already held", () => {
  const c = ctx({ wins: 10, bestStreak: 3 });
  const all = evaluateBadges(c).map((b) => b.key);
  assert.ok(all.includes("FIRST_BLOOD") && all.includes("TEN_WINS"));

  const fresh = newlyEarned(c, ["FIRST_BLOOD", "HAT_TRICK"]).map((b) => b.key);
  assert.ok(fresh.includes("TEN_WINS"));
  assert.ok(!fresh.includes("FIRST_BLOOD"), "already held");
  assert.ok(!fresh.includes("HAT_TRICK"), "already held");
});

test("newlyEarned is empty when nothing changed", () => {
  const c = ctx({ wins: 1 });
  const held = evaluateBadges(c).map((b) => b.key);
  assert.deepEqual(newlyEarned(c, held), []);
});

// --- Progress --------------------------------------------------------------

test("badgeProgress reports every badge with its state", () => {
  const rows = badgeProgress(ctx({ wins: 5 }));
  assert.equal(rows.length, BADGES.length);

  const ten = rows.find((r) => r.key === "TEN_WINS")!;
  assert.equal(ten.earned, false);
  assert.equal(ten.progress, 0.5, "5 of 10 wins");

  const first = rows.find((r) => r.key === "FIRST_BLOOD")!;
  assert.equal(first.earned, true);
  assert.equal(first.progress, 1);
});

test("progress is clamped to 0..1 even when far past the requirement", () => {
  for (const row of badgeProgress(ctx({ wins: 99999, bestStreak: 99999 }))) {
    if (row.progress !== null) {
      assert.ok(row.progress >= 0 && row.progress <= 1, `${row.key} = ${row.progress}`);
    }
  }
});

test("binary badges report null progress rather than a fake fraction", () => {
  const rows = badgeProgress(ctx());
  assert.equal(rows.find((r) => r.key === "PIONEER")!.progress, null);
  assert.equal(rows.find((r) => r.key === "RANKED")!.progress, null);
});

function has(c: BadgeContext, key: string): boolean {
  return evaluateBadges(c).some((b) => b.key === key);
}

// --- Placement -------------------------------------------------------------

test("a wide deviation alone leaves a player unplaced", () => {
  assert.equal(isPlaced(INITIAL_RATING), false);
  assert.equal(tierFor(INITIAL_RATING, 0), null);
});

test("a settled deviation places a player regardless of battle count", () => {
  // The ordinary path: enough mixed results for the rating to converge.
  assert.equal(isPlaced(at(1500), 3), true);
  assert.ok(tierFor(at(1500), 3));
});

/**
 * The regression this rule exists for.
 *
 * An unbeaten player's expected score approaches 95%, so each further win
 * carries almost no information and their deviation stops falling — measured,
 * it is still ~104 after sixty straight wins. Under a deviation-only gate they
 * would stay "Unranked" forever, which is exactly backwards for the strongest
 * player on the site.
 */
test("an unbeaten player places on battle count once their RD stalls", () => {
  const settledOpponent: RatingState = { rating: 1500, rd: 50, volatility: 0.06 };
  let state = INITIAL_RATING;
  for (let i = 0; i < 30; i += 1) {
    state = rateOneOnOne(state, settledOpponent, 1).after;
  }

  assert.ok(isProvisional(state.rd), "RD really has not settled");
  assert.equal(isPlaced(state), false, "the deviation gate alone would refuse");
  assert.equal(isPlaced(state, 30), true, "the battle count rescues them");
  assert.ok(tierFor(state, 30), "and they hold a real tier");
});

test("placement needs the full quota, not one battle short", () => {
  const wide: RatingState = { rating: 1700, rd: 200, volatility: 0.06 };
  assert.equal(isPlaced(wide, PLACEMENT_BATTLES - 1), false);
  assert.equal(isPlaced(wide, PLACEMENT_BATTLES), true);
});

test("nextTier and tierProgress agree with tierFor about placement", () => {
  const wide: RatingState = { rating: 1700, rd: 200, volatility: 0.06 };

  // Unplaced: no tier, no next tier, no progress.
  assert.equal(tierFor(wide, 0), null);
  assert.equal(nextTier(wide, 0), null);
  assert.equal(tierProgress(wide, 0), 0);

  // Placed by count: all three must now agree there IS a tier.
  assert.ok(tierFor(wide, PLACEMENT_BATTLES));
  const progress = tierProgress(wide, PLACEMENT_BATTLES);
  assert.ok(progress >= 0 && progress <= 1);
});

test("omitting the battle count keeps the old deviation-only behaviour", () => {
  // Existing callers that only have a rating state must not silently change.
  assert.equal(tierFor(INITIAL_RATING), null);
  assert.ok(tierFor(at(1500)));
});
