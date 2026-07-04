import { z } from "zod";
import {
  BattleStatus,
  Difficulty,
  FinishReason,
  Language,
  Mode,
  PresenceStatus,
  Side,
  SubmissionStatus,
} from "./enums.js";

/** A sample (visible) test case. Hidden tests NEVER appear in any client-facing schema. */
export const SampleTest = z.object({
  ordinal: z.number().int().nonnegative(),
  input: z.string(),
  expectedOutput: z.string(),
});
export type SampleTest = z.infer<typeof SampleTest>;

/**
 * The client-safe projection of a Problem. Contains statement, constraints,
 * starter code, and SAMPLE tests only — hidden tests are stripped server-side.
 */
export const PublicProblem = z.object({
  id: z.string(),
  title: z.string(),
  statementMarkdown: z.string(),
  constraints: z.string(),
  difficulty: Difficulty,
  allowedLanguages: z.array(Language),
  /** language -> starter snippet */
  starterCode: z.record(Language, z.string()),
  sampleTests: z.array(SampleTest),
  /** total number of tests (sample + hidden) so clients can show "x / total". */
  totalTests: z.number().int().positive(),
});
export type PublicProblem = z.infer<typeof PublicProblem>;

/** A player as seen by everyone in the room. */
export const PlayerView = z.object({
  userId: z.string(),
  displayName: z.string(),
  side: Side.nullable(),
  slot: z.number().int().nonnegative().nullable(),
  ready: z.boolean(),
  presence: PresenceStatus,
  isHost: z.boolean(),
});
export type PlayerView = z.infer<typeof PlayerView>;

/** Battle configuration chosen by the host at creation. */
export const BattleConfig = z.object({
  mode: Mode,
  difficulty: Difficulty,
  timeLimitSec: z.number().int().positive(),
});
export type BattleConfig = z.infer<typeof BattleConfig>;

/** Aggregate opponent-safe progress for a side: best passed-count so far. */
export const SideProgress = z.object({
  side: Side,
  bestPassed: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
});
export type SideProgress = z.infer<typeof SideProgress>;

/** A single submission result as broadcast to the room (NO source code). */
export const SubmissionResultView = z.object({
  submissionId: z.string(),
  userId: z.string(),
  side: Side,
  status: SubmissionStatus,
  passed: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
  timeMs: z.number().nonnegative(),
  /** compile / runtime error message, truncated; present when status === ERROR */
  errorMessage: z.string().nullable().optional(),
});
export type SubmissionResultView = z.infer<typeof SubmissionResultView>;

/** Final standings row per side. */
export const StandingRow = z.object({
  side: Side,
  bestPassed: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
  /** earliest submissionId that achieved bestPassed (tie-break authority) */
  decidingSubmissionId: z.string().nullable(),
});
export type StandingRow = z.infer<typeof StandingRow>;

/**
 * Full server snapshot of a battle. Sent on join and reconnect so a client
 * can rehydrate its entire view from a single message.
 */
export const BattleSnapshot = z.object({
  battleId: z.string(),
  roomCode: z.string(),
  status: BattleStatus,
  config: BattleConfig,
  players: z.array(PlayerView),
  /** present once status >= COUNTDOWN (problem revealed at start) */
  problem: PublicProblem.nullable(),
  /** epoch ms; present once IN_PROGRESS */
  serverStartAt: z.number().nullable(),
  serverEndAt: z.number().nullable(),
  /** current server time, so the client can compute its clock offset */
  serverNowMs: z.number(),
  /** aggregate progress per side (opponent-safe) */
  progress: z.array(SideProgress),
  /** the caller's own submission results (full, since they own them) */
  ownSubmissions: z.array(SubmissionResultView),
  winnerSide: Side.nullable(),
  finishReason: FinishReason.nullable(),
});
export type BattleSnapshot = z.infer<typeof BattleSnapshot>;
