import { z } from "zod";
import { Language, Side } from "./enums.js";

/**
 * Internal contract between `ws-server` (producer) and `judge-worker`
 * (consumer), carried over BullMQ (Redis). Never touches clients.
 */

export const JUDGE_QUEUE_NAME = "judge";

/** Redis pub/sub channel the worker publishes results to; ws-server subscribes. */
export const RESULT_CHANNEL = "judge:results";

/** A judging job enqueued when a player submits. */
export const JudgeJob = z.object({
  submissionId: z.string(),
  battleId: z.string(),
  problemId: z.string(),
  userId: z.string(),
  side: Side,
  language: Language,
  source: z.string(),
});
export type JudgeJob = z.infer<typeof JudgeJob>;

/** The result the worker publishes back on RESULT_CHANNEL. */
export const JudgeResult = z.object({
  submissionId: z.string(),
  battleId: z.string(),
  userId: z.string(),
  side: Side,
  passed: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
  timeMs: z.number().nonnegative(),
  /** true when every test passed — triggers the instant-win check */
  allPassed: z.boolean(),
  errorMessage: z.string().nullable(),
});
export type JudgeResult = z.infer<typeof JudgeResult>;

export function parseJudgeResult(raw: string): JudgeResult {
  return JudgeResult.parse(JSON.parse(raw));
}
