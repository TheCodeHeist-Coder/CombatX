import { z } from "zod";

/** Battle side. Team A vs Team B. */
export const Side = z.enum(["A", "B"]);
export type Side = z.infer<typeof Side>;

/** Game mode. Phase 1 ships ONE_V_ONE only; the rest are reserved for Phase 2. */
export const Mode = z.enum([
  "ONE_V_ONE",
  "TWO_V_TWO",
  "THREE_V_THREE",
  "FOUR_V_FOUR",
]);
export type Mode = z.infer<typeof Mode>;

/** Number of slots per side for a given mode. */
export const MODE_TEAM_SIZE: Record<Mode, number> = {
  ONE_V_ONE: 1,
  TWO_V_TWO: 2,
  THREE_V_THREE: 3,
  FOUR_V_FOUR: 4,
};

export const Difficulty = z.enum(["EASY", "MEDIUM", "HARD"]);
export type Difficulty = z.infer<typeof Difficulty>;

/** Languages the judge supports. Phase 1 ships PYTHON only. */
export const Language = z.enum(["PYTHON", "JAVASCRIPT", "CPP", "JAVA"]);
export type Language = z.infer<typeof Language>;

/** Piston runtime identifiers keyed by our Language enum. */
export const PISTON_RUNTIME: Record<Language, { language: string; version: string }> = {
  PYTHON: { language: "python", version: "3.12.0" },
  JAVASCRIPT: { language: "javascript", version: "20.11.1" },
  CPP: { language: "c++", version: "10.2.0" },
  JAVA: { language: "java", version: "15.0.2" },
};

/** Server-authoritative battle lifecycle. */
export const BattleStatus = z.enum([
  "LOBBY",
  "COUNTDOWN",
  "IN_PROGRESS",
  "FINISHED",
  "ABANDONED",
]);
export type BattleStatus = z.infer<typeof BattleStatus>;

/** How a battle ended. */
export const FinishReason = z.enum(["ALL_PASSED", "TIMEOUT", "FORFEIT"]);
export type FinishReason = z.infer<typeof FinishReason>;

/** Lifecycle of a single submission. */
export const SubmissionStatus = z.enum([
  "QUEUED",
  "RUNNING",
  "COMPLETED",
  "ERROR",
]);
export type SubmissionStatus = z.infer<typeof SubmissionStatus>;

/** Presence of a player's connection. */
export const PresenceStatus = z.enum(["ONLINE", "RECONNECTING", "DISCONNECTED"]);
export type PresenceStatus = z.infer<typeof PresenceStatus>;

/**
 * Whether a test case is shown to players or held back.
 *
 * SAMPLE tests ship with the problem statement; HIDDEN ones are stripped
 * server-side and only ever run by the judge. Mirrors the Prisma enum.
 */
export const TestKind = z.enum(["SAMPLE", "HIDDEN"]);
export type TestKind = z.infer<typeof TestKind>;
