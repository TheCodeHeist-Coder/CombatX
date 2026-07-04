/**
 * Pure scoring logic. Shared by judge-worker (authoritative scoring) so that
 * output comparison is defined in exactly one place.
 */

/**
 * Normalize program output for comparison:
 *  - strip trailing whitespace on each line
 *  - drop trailing blank lines
 *  - normalize CRLF -> LF
 * This tolerates cosmetic whitespace differences while keeping semantics exact.
 */
export function normalizeOutput(s: string): string {
  return s
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/g, ""))
    .join("\n")
    .replace(/\n+$/g, "");
}

/** True when actual output matches expected after normalization. */
export function outputMatches(actual: string, expected: string): boolean {
  return normalizeOutput(actual) === normalizeOutput(expected);
}

export interface TestOutcome {
  ordinal: number;
  passed: boolean;
}

export interface ScoreResult {
  passed: number;
  total: number;
  allPassed: boolean;
  outcomes: TestOutcome[];
}

/** Aggregate per-test outcomes into a score. */
export function score(outcomes: TestOutcome[]): ScoreResult {
  const total = outcomes.length;
  const passed = outcomes.filter((o) => o.passed).length;
  return {
    passed,
    total,
    allPassed: total > 0 && passed === total,
    outcomes,
  };
}
