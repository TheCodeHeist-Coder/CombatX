import assert from "node:assert/strict";
import { test } from "node:test";
import {
  applyRatingPeriod,
  conservativeRating,
  decayRating,
  DEFAULT_RATING,
  DEFAULT_RD,
  expectedScore,
  INITIAL_RATING,
  isProvisional,
  rateOneOnOne,
  RATING_FLOOR,
  softReset,
  type RatingState,
} from "./rating.js";

const settled: RatingState = { rating: 1500, rd: 50, volatility: 0.06 };

/**
 * The worked example from Glickman's paper (glicko2.pdf, section "Example
 * calculation"): a 1500/200 player beats 1400/30, loses to 1550/100, loses to
 * 1700/300. The paper's answers are r'=1464.06, RD'=151.52, sigma'=0.05999.
 *
 * This is the test that matters. If the implementation is wrong anywhere,
 * these three numbers will not come out.
 */
test("reproduces the published Glicko-2 worked example", () => {
  const player: RatingState = { rating: 1500, rd: 200, volatility: 0.06 };
  const { after } = applyRatingPeriod(player, [
    { opponent: { rating: 1400, rd: 30, volatility: 0.06 }, score: 1 },
    { opponent: { rating: 1550, rd: 100, volatility: 0.06 }, score: 0 },
    { opponent: { rating: 1700, rd: 300, volatility: 0.06 }, score: 0 },
  ]);

  assert.ok(Math.abs(after.rating - 1464.06) < 0.1, `rating was ${after.rating}`);
  assert.ok(Math.abs(after.rd - 151.52) < 0.1, `rd was ${after.rd}`);
  assert.ok(Math.abs(after.volatility - 0.05999) < 0.0001, `sigma was ${after.volatility}`);
});

test("a win raises the rating and a loss lowers it", () => {
  const win = rateOneOnOne(settled, settled, 1);
  const loss = rateOneOnOne(settled, settled, 0);

  assert.ok(win.delta > 0, "win should gain");
  assert.ok(loss.delta < 0, "loss should lose");
});

test("evenly matched players trade symmetric amounts", () => {
  const win = rateOneOnOne(settled, settled, 1);
  const loss = rateOneOnOne(settled, settled, 0);

  // The zero-sum property is what makes win-trading pointless: whatever one
  // account gains, the other gives up.
  assert.equal(win.delta, -loss.delta);
});

test("beating a stronger opponent pays more than beating a weaker one", () => {
  const strong: RatingState = { rating: 1900, rd: 50, volatility: 0.06 };
  const weak: RatingState = { rating: 1100, rd: 50, volatility: 0.06 };

  const overStrong = rateOneOnOne(settled, strong, 1).delta;
  const overWeak = rateOneOnOne(settled, weak, 1).delta;

  assert.ok(overStrong > overWeak, `${overStrong} should exceed ${overWeak}`);
});

test("losing to a weaker opponent costs more than losing to a stronger one", () => {
  const strong: RatingState = { rating: 1900, rd: 50, volatility: 0.06 };
  const weak: RatingState = { rating: 1100, rd: 50, volatility: 0.06 };

  const toStrong = rateOneOnOne(settled, strong, 0).delta;
  const toWeak = rateOneOnOne(settled, weak, 0).delta;

  assert.ok(toWeak < toStrong, `${toWeak} should be worse than ${toStrong}`);
});

test("a new player's rating moves further than a settled player's", () => {
  const fresh = rateOneOnOne(INITIAL_RATING, settled, 1);
  const veteran = rateOneOnOne(settled, settled, 1);

  assert.ok(
    Math.abs(fresh.delta) > Math.abs(veteran.delta),
    "high RD should mean large swings",
  );
});

test("deviation shrinks as a player keeps playing", () => {
  let state = INITIAL_RATING;
  for (let i = 0; i < 6; i += 1) {
    state = rateOneOnOne(state, settled, i % 2 === 0 ? 1 : 0).after;
  }
  assert.ok(state.rd < DEFAULT_RD, "RD should fall with games played");

  // Measured, not assumed: RD crosses PROVISIONAL_RD on the 13th battle for a
  // player alternating wins and losses against a settled opponent. Keep going
  // and the provisional flag must clear.
  for (let i = 0; i < 10; i += 1) {
    state = rateOneOnOne(state, settled, i % 2 === 0 ? 1 : 0).after;
  }
  assert.ok(!isProvisional(state.rd), `still provisional at rd ${state.rd}`);
});

test("a draw between equals barely moves the rating", () => {
  const { delta } = rateOneOnOne(settled, settled, 0.5);
  assert.equal(delta, 0);
});

test("the rating never falls below the floor", () => {
  let state: RatingState = { rating: 300, rd: 200, volatility: 0.06 };
  const crusher: RatingState = { rating: 2400, rd: 30, volatility: 0.06 };
  for (let i = 0; i < 60; i += 1) {
    state = rateOneOnOne(state, crusher, 0).after;
  }
  assert.ok(state.rating >= RATING_FLOOR, `fell to ${state.rating}`);
});

test("idle time widens the deviation but leaves the rating alone", () => {
  const idle = decayRating(settled, 20);
  assert.ok(idle.rd > settled.rd, "RD should grow while idle");
  assert.equal(idle.rating, settled.rating);
  assert.ok(idle.rd <= DEFAULT_RD, "RD should not exceed the ceiling");
});

test("an empty rating period only decays", () => {
  const { after, delta } = applyRatingPeriod(settled, []);
  assert.equal(delta, 0);
  assert.ok(after.rd >= settled.rd);
});

test("expected score is symmetric and favours the stronger player", () => {
  const strong: RatingState = { rating: 1900, rd: 50, volatility: 0.06 };
  const e = expectedScore(settled, strong);

  assert.ok(e < 0.5, "the weaker player should be the underdog");
  assert.ok(e > 0 && e < 1);
  assert.ok(Math.abs(expectedScore(settled, settled) - 0.5) < 0.001);
});

test("the soft reset compresses toward the origin without reordering", () => {
  const high: RatingState = { rating: 2100, rd: 45, volatility: 0.06 };
  const low: RatingState = { rating: 1200, rd: 45, volatility: 0.06 };

  const highAfter = softReset(high);
  const lowAfter = softReset(low);

  assert.ok(highAfter.rating < high.rating, "a high rating should come down");
  assert.ok(lowAfter.rating > low.rating, "a low rating should come up");
  assert.ok(highAfter.rating > lowAfter.rating, "ordering must survive");
  assert.ok(highAfter.rd > high.rd, "RD should widen for the new season");
});

test("the conservative rating penalises an unproven player", () => {
  const proven: RatingState = { rating: 1600, rd: 40, volatility: 0.06 };
  const unproven: RatingState = { rating: 1600, rd: 250, volatility: 0.06 };

  assert.ok(
    conservativeRating(proven) > conservativeRating(unproven),
    "same rating, less certainty, lower standing",
  );
});

test("trading wins back and forth is a net loss of nothing and a gain of nothing", () => {
  // The collusion scenario: two accounts alternating wins. Their combined
  // rating must not drift upward.
  let a = INITIAL_RATING;
  let b = INITIAL_RATING;
  const startTotal = a.rating + b.rating;

  for (let i = 0; i < 40; i += 1) {
    const aWins = i % 2 === 0;
    const nextA = rateOneOnOne(a, b, aWins ? 1 : 0).after;
    const nextB = rateOneOnOne(b, a, aWins ? 0 : 1).after;
    a = nextA;
    b = nextB;
  }

  const endTotal = a.rating + b.rating;
  assert.ok(
    Math.abs(endTotal - startTotal) < 1,
    `farming moved the total from ${startTotal} to ${endTotal}`,
  );
});

test("DEFAULT_RATING is the fixed point of the soft reset", () => {
  const at = softReset({ rating: DEFAULT_RATING, rd: 50, volatility: 0.06 });
  assert.equal(Math.round(at.rating), DEFAULT_RATING);
});
