import type { Job } from "bullmq";
import type { Redis } from "ioredis";
import { prisma } from "@repo/db";
import { JudgeJob, RESULT_CHANNEL, type JudgeResult } from "@repo/protocol";
import { judge } from "./judge.js";

/**
 * Process one judge job end to end: validate the payload, run it through the
 * judge, write the result through to Postgres, and publish it on RESULT_CHANNEL.
 * Pure of BullMQ wiring so it can be tested/driven directly; the worker just
 * hands jobs to this.
 */
export async function processJob(
  job: Job,
  publisher: Redis,
): Promise<JudgeResult> {
  // Re-validate the job payload at the boundary — never trust the queue blindly.
  const parsed = JudgeJob.parse(job.data);

  // Mark RUNNING so the room can reflect it (best-effort; don't fail the job).
  await prisma.submission
    .update({ where: { id: parsed.submissionId }, data: { status: "RUNNING" } })
    .catch(() => {});

  const outcome = await judge(parsed);

  const result: JudgeResult = {
    submissionId: parsed.submissionId,
    battleId: parsed.battleId,
    userId: parsed.userId,
    side: parsed.side,
    passed: outcome.passed,
    total: outcome.total,
    timeMs: outcome.timeMs,
    allPassed: outcome.allPassed,
    errorMessage: outcome.errorMessage,
  };

  // Write-through to the durable record (ws-server also updates on receipt;
  // this makes the DB correct even if the room is already gone).
  await prisma.submission
    .update({
      where: { id: parsed.submissionId },
      data: {
        status: outcome.errorMessage ? "ERROR" : "COMPLETED",
        passedCount: outcome.passed,
        totalCount: outcome.total,
        runtimeMs: outcome.timeMs,
        errorMessage: outcome.errorMessage,
        judgedAt: new Date(),
      },
    })
    .catch((err) => console.error("[judge] DB write-through failed:", err));

  // Announce the result. ws-server picks it up on RESULT_CHANNEL.
  await publisher.publish(RESULT_CHANNEL, JSON.stringify(result));
  return result;
}
