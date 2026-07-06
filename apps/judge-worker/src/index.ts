import "./loadEnv.js"; // must be first — loads .env before @repo/db reads it
import { Worker, type Job } from "bullmq";
import { prisma } from "@repo/db";
import {
  JUDGE_QUEUE_NAME,
  JudgeJob,
  RESULT_CHANNEL,
  type JudgeResult,
} from "@repo/protocol";
import { env } from "./env.js";
import { makeRedis } from "./redis.js";
import { judge } from "./judge.js";

/**
 * The consumer side of the judge pipeline. Pulls JudgeJobs off the BullMQ
 * `judge` queue, runs the code against the problem's tests, writes the result
 * through to Postgres, and publishes a JudgeResult on RESULT_CHANNEL — which
 * ws-server subscribes to and fans out to the battle room.
 */

const connection = makeRedis();
const publisher = makeRedis();

async function processJob(job: Job): Promise<JudgeResult> {
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

const worker = new Worker(JUDGE_QUEUE_NAME, processJob, {
  connection,
  concurrency: env.concurrency,
});

worker.on("ready", () => {
  console.log(
    `judge-worker ready (concurrency=${env.concurrency}, piston=${env.pistonUrl})`,
  );
});
worker.on("completed", (job, result: JudgeResult) => {
  console.log(
    `[judge] ${job.id} → ${result.passed}/${result.total}` +
      (result.allPassed ? " ✅ ALL PASSED" : "") +
      (result.errorMessage ? ` (err: ${result.errorMessage})` : ""),
  );
});
worker.on("failed", (job, err) => {
  console.error(`[judge] job ${job?.id} failed:`, err.message);
});

// --- Graceful shutdown -------------------------------------------------------
async function shutdown(signal: string): Promise<void> {
  console.log(`\n${signal} received, shutting down judge-worker...`);
  await worker.close();
  connection.disconnect();
  publisher.disconnect();
  await prisma.$disconnect().catch(() => {});
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
