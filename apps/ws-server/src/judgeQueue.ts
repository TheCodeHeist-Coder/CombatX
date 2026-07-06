import { Queue } from "bullmq";
import {
  JUDGE_QUEUE_NAME,
  RESULT_CHANNEL,
  JudgeResult,
  parseJudgeResult,
  type JudgeJob,
} from "@repo/protocol";
import type IORedis from "ioredis";
import { makeRedis, makeSubscriber } from "./redis.js";

/**
 * The producer side of the judge pipeline. ws-server enqueues JudgeJobs here;
 * judge-worker consumes them, runs the code, and publishes a JudgeResult back
 * on RESULT_CHANNEL — which we subscribe to and hand off to a callback.
 */
export class JudgePipeline {
  private readonly queue: Queue<JudgeJob>;
  private readonly connection: IORedis;
  private readonly subscriber: IORedis;

  constructor() {
    this.connection = makeRedis();
    this.subscriber = makeSubscriber();
    this.queue = new Queue<JudgeJob>(JUDGE_QUEUE_NAME, {
      connection: this.connection,
      defaultJobOptions: {
        // A judging job is cheap to retry; drop it after a couple of attempts.
        attempts: 2,
        backoff: { type: "fixed", delay: 500 },
        removeOnComplete: 1000,
        removeOnFail: 1000,
      },
    });
  }

  /** Enqueue a job for the judge-worker. */
  async enqueue(job: JudgeJob): Promise<void> {
    await this.queue.add("judge", job, { jobId: job.submissionId });
  }

  /**
   * Subscribe to judge results. `onResult` is invoked for every valid result
   * message the worker publishes. Invalid frames are logged and dropped.
   */
  async onResult(handler: (result: JudgeResult) => void): Promise<void> {
    await this.subscriber.subscribe(RESULT_CHANNEL);
    this.subscriber.on("message", (channel, raw) => {
      if (channel !== RESULT_CHANNEL) return;
      try {
        handler(parseJudgeResult(raw));
      } catch (err) {
        console.error("[judge] dropped malformed result frame:", err);
      }
    });
  }

  async close(): Promise<void> {
    await this.queue.close();
    this.subscriber.disconnect();
    this.connection.disconnect();
  }
}

export { JudgeResult };
