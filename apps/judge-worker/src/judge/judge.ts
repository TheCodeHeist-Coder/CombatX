import { prisma } from "@repo/db";
import { outputMatches, score, type TestOutcome } from "@repo/game";
import type { JudgeJob } from "@repo/protocol";
import { runOnce } from "./piston.js";

export interface JudgeOutcome {
  passed: number;
  total: number;
  allPassed: boolean;
  timeMs: number;
  errorMessage: string | null;
}

/**
 * Judge one submission: run its source against every test case (sample AND
 * hidden) for the problem, comparing stdout via the shared `outputMatches`
 * normalization, and aggregate into a score.
 *
 * Runs tests sequentially in ordinal order. A compilation failure aborts early
 * (it fails every test identically) and reports the compiler message.
 */
export async function judge(job: JudgeJob): Promise<JudgeOutcome> {
  const tests = await prisma.testCase.findMany({
    where: { problemId: job.problemId },
    orderBy: { ordinal: "asc" },
  });

  const total = tests.length;
  if (total === 0) {
    return { passed: 0, total: 0, allPassed: false, timeMs: 0, errorMessage: "Problem has no test cases." };
  }

  const outcomes: TestOutcome[] = [];
  let totalTimeMs = 0;
  let firstError: string | null = null;

  for (const test of tests) {
    const started = process.hrtime.bigint();
    const result = await runOnce(job.language, job.source, test.input);
    const elapsedMs = Number(process.hrtime.bigint() - started) / 1e6;
    totalTimeMs += elapsedMs;

    // Compilation failures fail identically for every test — abort early and
    // record every remaining test as failed so the score/total stays honest.
    const isCompileError = !result.ok && /compil/i.test(result.failure ?? "");
    if (isCompileError) {
      firstError ??= result.failure;
      outcomes.push({ ordinal: test.ordinal, passed: false });
      for (const rest of tests.slice(outcomes.length)) {
        outcomes.push({ ordinal: rest.ordinal, passed: false });
      }
      break;
    }

    const passed = result.ok && outputMatches(result.stdout, test.expectedOutput);
    if (!passed && firstError === null && result.failure) {
      firstError = result.failure;
    }
    outcomes.push({ ordinal: test.ordinal, passed });
  }

  const s = score(outcomes);
  return {
    passed: s.passed,
    total: s.total,
    allPassed: s.allPassed,
    timeMs: Math.round(totalTimeMs),
    // Only surface an error message when nothing passed AND we saw a real
    // failure signal (compile/runtime/timeout) — a plain wrong-answer isn't an
    // "error", it's just a failing test.
    errorMessage: s.passed === 0 && firstError ? firstError : null,
  };
}
