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

/**
 * Review state of a problem. Mirrors the Prisma enum.
 *
 * Only APPROVED problems are ever selected for a battle; the arena filters on
 * this, so a PENDING submission cannot leak into ranked play.
 */
export const ProblemStatus = z.enum(["DRAFT", "PENDING", "APPROVED", "REJECTED"]);
export type ProblemStatus = z.infer<typeof ProblemStatus>;

/**
 * Who may join a league. Mirrors the Prisma enum.
 *
 * A PUBLIC league is listed on the leagues page and anyone may form a team.
 * A PRIVATE one is unlisted and reachable only with its join code.
 */
export const LeagueVisibility = z.enum(["PUBLIC", "PRIVATE"]);
export type LeagueVisibility = z.infer<typeof LeagueVisibility>;

/**
 * A league's lifecycle. The host advances it by hand.
 *
 * CANCELLED is not FINISHED: an abandoned league has no champion, so filing
 * it as finished would claim a winner nobody won.
 */
export const LeagueStatus = z.enum([
  "DRAFT",
  "OPEN",
  "RUNNING",
  "FINISHED",
  "CANCELLED",
]);
export type LeagueStatus = z.infer<typeof LeagueStatus>;

/** The stage a fixture belongs to. */
export const LeagueRound = z.enum([
  "GROUP",
  "QUARTER_FINAL",
  "SEMI_FINAL",
  "FINAL",
]);
export type LeagueRound = z.infer<typeof LeagueRound>;

/** How far a fixture has got. */
export const FixtureStatus = z.enum([
  "SCHEDULED",
  "LIVE",
  "COMPLETED",
  "CANCELLED",
]);
export type FixtureStatus = z.infer<typeof FixtureStatus>;

/**
 * The battle Mode a league of the given team size plays at.
 *
 * League team size and battle mode are the same number wearing two hats, and
 * this is the single place that conversion happens. Indexed by team size so a
 * caller with `league.teamSize` needs no switch of its own.
 */
export const TEAM_SIZE_MODE: Record<number, Mode> = {
  1: "ONE_V_ONE",
  2: "TWO_V_TWO",
  3: "THREE_V_THREE",
  4: "FOUR_V_FOUR",
};

/** Smallest and largest team a league may be configured for. */
export const MIN_LEAGUE_TEAM_SIZE = 1;
export const MAX_LEAGUE_TEAM_SIZE = 4;
