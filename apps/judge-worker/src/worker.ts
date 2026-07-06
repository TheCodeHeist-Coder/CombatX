import { Worker } from "bullmq";
import type { Redis } from "ioredis";
import { prisma } from "@repo/db";
import { JUDGE_QUEUE_NAME, type JudgeResult } from "@repo/protocol";
import { env } from "./config/env.js";
import { makeRedis } from "./infra/redis.js";
import { processJob } from "./judge/processor.js";

/**
 * The consumer side of the judge pipeline. Owns the BullMQ Worker + its Redis
 * connections, hands each job to the processor, and logs verdicts. index.ts
 * just constructs this and wires signals to start()/stop().
 */
export class JudgeWorker {
  private readonly connection: Redis;
  private readonly publisher: Redis;
  private readonly worker: Worker;

  constructor() {
    this.connection = makeRedis();
    this.publisher = makeRedis();
    this.worker = new Worker(
      JUDGE_QUEUE_NAME,
      (job) => processJob(job, this.publisher),
      { connection: this.connection, concurrency: env.concurrency },
    );
    this.registerEvents();
  }

  private registerEvents(): void {
    this.worker.on("ready", () => {
      console.log(
        `judge-worker ready (concurrency=${env.concurrency}, piston=${env.pistonUrl})`,
      );
    });
    this.worker.on("completed", (job, result: JudgeResult) => {
      console.log(
        `[judge] ${job.id} → ${result.passed}/${result.total}` +
          (result.allPassed ? " ✅ ALL PASSED" : "") +
          (result.errorMessage ? ` (err: ${result.errorMessage})` : ""),
      );
    });
    this.worker.on("failed", (job, err) => {
      console.error(`[judge] job ${job?.id} failed:`, err.message);
    });
  }

  /** Gracefully drain in-flight jobs and release all connections. */
  async close(): Promise<void> {
    await this.worker.close();
    this.connection.disconnect();
    this.publisher.disconnect();
    await prisma.$disconnect().catch(() => {});
  }
}
