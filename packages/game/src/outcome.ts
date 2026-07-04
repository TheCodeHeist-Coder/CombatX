import type { FinishReason, Side, StandingRow } from "@repo/protocol";

/**
 * A completed submission, as the referee sees it. `submittedAt` is the
 * SERVER-received timestamp (epoch ms) — the sole tie-break authority.
 */
export interface JudgedSubmission {
  submissionId: string;
  side: Side;
  passed: number;
  total: number;
  submittedAt: number;
}

export interface BattleOutcome {
  winnerSide: Side | null;
  reason: FinishReason;
  standings: StandingRow[];
  decidingSubmissionId: string | null;
}

/**
 * For a side, find the submission with the highest passed-count, breaking ties
 * by earliest submittedAt (so the FIRST time a side reached its best counts).
 */
function bestForSide(
  submissions: JudgedSubmission[],
  side: Side,
): { bestPassed: number; total: number; decidingSubmissionId: string | null } {
  const mine = submissions.filter((s) => s.side === side);
  if (mine.length === 0) {
    return { bestPassed: 0, total: 0, decidingSubmissionId: null };
  }
  let best = mine[0]!;
  for (const s of mine) {
    if (
      s.passed > best.passed ||
      (s.passed === best.passed && s.submittedAt < best.submittedAt)
    ) {
      best = s;
    }
  }
  return {
    bestPassed: best.passed,
    total: best.total,
    decidingSubmissionId: best.submissionId,
  };
}

/**
 * Instant-win check: did a submission just pass ALL tests? If so its side wins
 * immediately. Returns the outcome, or null if no instant win yet.
 *
 * If BOTH sides have an all-pass submission (rare race), the earliest
 * submittedAt wins.
 */
export function checkInstantWin(
  submissions: JudgedSubmission[],
): BattleOutcome | null {
  const fullPasses = submissions.filter(
    (s) => s.total > 0 && s.passed === s.total,
  );
  if (fullPasses.length === 0) return null;

  let winner = fullPasses[0]!;
  for (const s of fullPasses) {
    if (s.submittedAt < winner.submittedAt) winner = s;
  }

  return {
    winnerSide: winner.side,
    reason: "ALL_PASSED",
    standings: buildStandings(submissions),
    decidingSubmissionId: winner.submissionId,
  };
}

/**
 * Timeout resolution: whoever has the highest best-passed count wins; ties
 * broken by which side reached that count earliest. Equal counts AND equal
 * timing (or no submissions on either side) => draw (winnerSide null).
 */
export function resolveOnTimeout(
  submissions: JudgedSubmission[],
): BattleOutcome {
  const a = bestForSide(submissions, "A");
  const b = bestForSide(submissions, "B");

  let winnerSide: Side | null = null;
  let decidingSubmissionId: string | null = null;

  if (a.bestPassed > b.bestPassed) {
    winnerSide = "A";
    decidingSubmissionId = a.decidingSubmissionId;
  } else if (b.bestPassed > a.bestPassed) {
    winnerSide = "B";
    decidingSubmissionId = b.decidingSubmissionId;
  } else if (a.bestPassed > 0) {
    // Equal, non-zero best: earliest submittedAt among the two deciding subs.
    const aSub = submissions.find((s) => s.submissionId === a.decidingSubmissionId);
    const bSub = submissions.find((s) => s.submissionId === b.decidingSubmissionId);
    if (aSub && bSub) {
      if (aSub.submittedAt < bSub.submittedAt) {
        winnerSide = "A";
        decidingSubmissionId = a.decidingSubmissionId;
      } else if (bSub.submittedAt < aSub.submittedAt) {
        winnerSide = "B";
        decidingSubmissionId = b.decidingSubmissionId;
      }
      // exactly equal timing => draw
    }
  }

  return {
    winnerSide,
    reason: "TIMEOUT",
    standings: buildStandings(submissions),
    decidingSubmissionId,
  };
}

/** One standings row per side (A then B). */
export function buildStandings(submissions: JudgedSubmission[]): StandingRow[] {
  return (["A", "B"] as const).map((side) => {
    const best = bestForSide(submissions, side);
    return {
      side,
      bestPassed: best.bestPassed,
      total: best.total,
      decidingSubmissionId: best.decidingSubmissionId,
    };
  });
}
