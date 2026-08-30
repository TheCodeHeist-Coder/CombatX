/**
 * Glicko-2 rating.
 *
 * Pure arithmetic, no database and no clock — exactly like the outcome and
 * progression rules, so the client can render a projected rating change
 * without duplicating the formula and without a round trip.
 *
 * WHY GLICKO-2 RATHER THAN ELO
 * ----------------------------
 * Elo carries a single number, so it cannot distinguish "1500 and we are sure"
 * from "1500 and we have no idea". A brand-new player and a 200-battle veteran
 * look identical, and the only lever is a fixed K-factor that is either too
 * slow for newcomers or too jumpy for veterans.
 *
 * Glicko-2 carries a rating deviation (RD) alongside the rating — how
 * uncertain we are. That buys three things this platform specifically needs:
 *
 *   1. New players converge in a handful of battles (high RD => large swings),
 *      then stabilise automatically as RD falls.
 *   2. Uncertainty is a publishable fact: the leaderboard hides anyone still
 *      above PROVISIONAL_RD, so a lucky 3-0 opening cannot top the board.
 *   3. RD grows back while idle, so someone returning after two months
 *      re-converges instead of sitting on a stale number.
 *
 * The implementation follows Glickman's published paper (glicko.net/glicko/
 * glicko2.pdf). Names below match the paper — mu, phi, sigma, v, delta — so
 * the code can be checked against it line by line. Ratings are stored in the
 * familiar 1500-centred scale and converted to the internal scale on entry.
 */

/** Where an unrated player starts. The Glicko-2 conventional origin. */
export const DEFAULT_RATING = 1500;
/** Starting deviation. Deliberately wide: we know nothing about a new player. */
export const DEFAULT_RD = 350;
/** Starting volatility, per Glickman's recommendation. */
export const DEFAULT_VOLATILITY = 0.06;

/**
 * The floor a rating can never fall below.
 *
 * Without it a player on a long losing run drifts arbitrarily low and can
 * never realistically climb back, which reads as punishment rather than
 * measurement. It also bounds what an opponent can lose by beating them.
 */
export const RATING_FLOOR = 100;

/**
 * Above this RD a rating is "provisional" — shown to its owner, but withheld
 * from the leaderboard.
 *
 * 100 is reached on about the 13th battle (measured, see rating.test.ts), so
 * it takes a genuine run of play to appear on the ladder. That is the point:
 * a lucky 3-0 opening should not outrank a proven player.
 */
export const PROVISIONAL_RD = 100;

/**
 * The ceiling RD decays back toward while a player is idle. Equal to the
 * starting RD: after a long enough absence we genuinely know nothing again.
 */
const MAX_RD = DEFAULT_RD;

/**
 * System constant (tau). Constrains volatility change between periods.
 * Glickman suggests 0.3-1.2; smaller is steadier. 0.5 is the usual default
 * and suits a ladder where we would rather under-react to an upset.
 */
const TAU = 0.5;

/** Glicko-2 internal scale factor: 400 / ln(10). */
const SCALE = 173.7178;

/** Convergence tolerance for the volatility iteration. */
const EPSILON = 0.000001;

/** A player's rating state, in the public 1500-centred scale. */
export interface RatingState {
  rating: number;
  rd: number;
  volatility: number;
}

/** The result of one battle from one player's point of view. */
export interface RatingMatch {
  opponent: RatingState;
  /** 1 win, 0 loss, 0.5 draw. */
  score: number;
}

/** What one rating period did to a player. */
export interface RatingChange {
  before: RatingState;
  after: RatingState;
  /** after.rating - before.rating, rounded the same way it is displayed. */
  delta: number;
}

export const INITIAL_RATING: RatingState = {
  rating: DEFAULT_RATING,
  rd: DEFAULT_RD,
  volatility: DEFAULT_VOLATILITY,
};

/** Public scale -> internal. */
function toMu(rating: number): number {
  return (rating - DEFAULT_RATING) / SCALE;
}
function toPhi(rd: number): number {
  return rd / SCALE;
}
/** Internal -> public scale. */
function fromMu(mu: number): number {
  return mu * SCALE + DEFAULT_RATING;
}
function fromPhi(phi: number): number {
  return phi * SCALE;
}

/** g(phi) — how much an opponent's uncertainty damps their influence. */
function g(phi: number): number {
  return 1 / Math.sqrt(1 + (3 * phi * phi) / (Math.PI * Math.PI));
}

/** E(mu, mu_j, phi_j) — expected score against one opponent. */
function expectation(mu: number, oppMu: number, oppPhi: number): number {
  return 1 / (1 + Math.exp(-g(oppPhi) * (mu - oppMu)));
}

/**
 * Expected score against a single opponent, in the public scale.
 *
 * Exported because the UI wants it: showing "you are favoured 68%" before a
 * ranked battle, and explaining afterwards why an upset moved the rating so
 * far, both need this number.
 */
export function expectedScore(player: RatingState, opponent: RatingState): number {
  return expectation(toMu(player.rating), toMu(opponent.rating), toPhi(opponent.rd));
}

/**
 * Solve for the new volatility (sigma') by the illinois-variant regula falsi
 * from the paper's Step 5. Converges in a handful of iterations.
 */
function newVolatility(
  phi: number,
  sigma: number,
  v: number,
  delta: number,
): number {
  const a = Math.log(sigma * sigma);
  const phiSq = phi * phi;
  const deltaSq = delta * delta;

  const f = (x: number): number => {
    const ex = Math.exp(x);
    const denom = phiSq + v + ex;
    return (
      (ex * (deltaSq - phiSq - v - ex)) / (2 * denom * denom) - (x - a) / (TAU * TAU)
    );
  };

  let A = a;
  let B: number;

  if (deltaSq > phiSq + v) {
    B = Math.log(deltaSq - phiSq - v);
  } else {
    // Walk B down until f(B) turns negative, per the paper.
    let k = 1;
    while (f(a - k * TAU) < 0) k += 1;
    B = a - k * TAU;
  }

  let fA = f(A);
  let fB = f(B);

  // Bounded rather than while(true): the iteration provably converges, but a
  // pathological input must not be able to hang the finish handler.
  for (let i = 0; i < 100 && Math.abs(B - A) > EPSILON; i += 1) {
    const C = A + ((A - B) * fA) / (fB - fA);
    const fC = f(C);

    if (fC * fB <= 0) {
      A = B;
      fA = fB;
    } else {
      fA /= 2;
    }

    B = C;
    fB = fC;
  }

  return Math.exp(A / 2);
}

/**
 * Apply one rating period's worth of results to a player.
 *
 * Glicko-2 is defined over a *period* of several games rather than one at a
 * time. We rate each battle as its own period, which is the standard
 * simplification for real-time ladders: it costs a little accuracy against
 * batching, and buys an immediate, explainable number the moment a battle
 * ends. Passing multiple matches is still supported and behaves correctly.
 */
export function applyRatingPeriod(
  player: RatingState,
  matches: RatingMatch[],
): RatingChange {
  // No games: only the deviation moves, growing back toward MAX_RD.
  if (matches.length === 0) {
    return { before: player, after: decayRating(player), delta: 0 };
  }

  const mu = toMu(player.rating);
  const phi = toPhi(player.rd);
  const sigma = player.volatility;

  // Step 3: estimated variance of the rating, from game outcomes alone.
  let vInv = 0;
  // Step 4: the estimated improvement, pre-scaled by v.
  let deltaSum = 0;

  for (const m of matches) {
    const oppMu = toMu(m.opponent.rating);
    const oppPhi = toPhi(m.opponent.rd);
    const gPhi = g(oppPhi);
    const e = expectation(mu, oppMu, oppPhi);

    vInv += gPhi * gPhi * e * (1 - e);
    deltaSum += gPhi * (m.score - e);
  }

  // Guard against a degenerate v: E near 0 or 1 makes vInv vanish and v explode.
  // Clamping keeps the arithmetic finite for an extreme rating gap.
  const v = vInv > 0 ? 1 / vInv : Number.MAX_SAFE_INTEGER;
  const delta = v * deltaSum;

  // Step 5.
  const sigmaPrime = newVolatility(phi, sigma, v, delta);

  // Step 6: pre-period deviation, inflated by the new volatility.
  const phiStar = Math.sqrt(phi * phi + sigmaPrime * sigmaPrime);

  // Step 7: the new deviation and rating.
  const phiPrime = 1 / Math.sqrt(1 / (phiStar * phiStar) + 1 / v);
  const muPrime = mu + phiPrime * phiPrime * deltaSum;

  const after: RatingState = {
    rating: clampRating(fromMu(muPrime)),
    rd: clampRd(fromPhi(phiPrime)),
    volatility: sigmaPrime,
  };

  return {
    before: player,
    after,
    delta: Math.round(after.rating) - Math.round(player.rating),
  };
}

/**
 * Convenience for the overwhelmingly common case: one battle, one opponent.
 */
export function rateOneOnOne(
  player: RatingState,
  opponent: RatingState,
  score: number,
): RatingChange {
  return applyRatingPeriod(player, [{ opponent, score }]);
}

/**
 * Grow a player's RD back toward MAX_RD for a period of inactivity.
 *
 * This is Glicko-2's Step 6 applied with no games: the longer someone is away,
 * the less certain their rating is, so their next battles move it further.
 * Ratings themselves never change here — absence is not evidence of skill.
 */
export function decayRating(player: RatingState, periods = 1): RatingState {
  if (periods <= 0) return player;
  const phi = toPhi(player.rd);
  const sigma = player.volatility;
  const phiStar = Math.sqrt(phi * phi + periods * sigma * sigma);
  return { ...player, rd: clampRd(fromPhi(phiStar)) };
}

/**
 * Pull a rating toward the origin at a season boundary.
 *
 * A hard reset throws away everything we learned; no reset makes a season
 * meaningless. A soft reset keeps the ordering but compresses the spread, so
 * the top is reachable again while a strong player does not restart from
 * scratch. RD is widened so the first battles of a season re-converge quickly.
 */
export function softReset(player: RatingState, pull = 0.35): RatingState {
  const k = Math.min(1, Math.max(0, pull));
  return {
    rating: clampRating(player.rating + (DEFAULT_RATING - player.rating) * k),
    rd: clampRd(Math.max(player.rd, DEFAULT_RD * 0.6)),
    volatility: DEFAULT_VOLATILITY,
  };
}

/** True when a rating is still too uncertain to publish on the leaderboard. */
export function isProvisional(rd: number): boolean {
  return rd > PROVISIONAL_RD;
}

/**
 * A conservative rating: the bottom of the ~95% confidence interval.
 *
 * This is what the leaderboard should SORT by. Ranking on the raw rating
 * rewards a small sample that got lucky; ranking on rating - 2*RD asks
 * "what is this player's skill at worst?", so climbing requires both playing
 * well and playing enough for us to be sure of it.
 */
export function conservativeRating(state: RatingState): number {
  return state.rating - 2 * state.rd;
}

function clampRating(r: number): number {
  if (!Number.isFinite(r)) return DEFAULT_RATING;
  return Math.max(RATING_FLOOR, r);
}

function clampRd(rd: number): number {
  if (!Number.isFinite(rd)) return DEFAULT_RD;
  // A small floor keeps a very active player's rating responsive rather than
  // frozen once RD collapses toward zero.
  return Math.min(MAX_RD, Math.max(30, rd));
}
