import { z } from "zod";
import { BattleConfig, StandingRow } from "./domain.js";
import { Difficulty, FinishReason, Mode, Side } from "./enums.js";

/**
 * REST contract for `apps/http-api`. Request/response bodies validated with
 * these schemas on both ends.
 */

// POST /auth/guest — create a guest identity.
export const GuestAuthRequest = z.object({
  displayName: z.string().min(1).max(24),
});
export type GuestAuthRequest = z.infer<typeof GuestAuthRequest>;

export const GuestAuthResponse = z.object({
  token: z.string(),
  userId: z.string(),
  displayName: z.string(),
});
export type GuestAuthResponse = z.infer<typeof GuestAuthResponse>;

// POST /battles — create a battleground. (Auth required.)
export const CreateBattleRequest = z.object({
  mode: Mode,
  difficulty: Difficulty,
  timeLimitSec: z.number().int().min(60).max(3600),
});
export type CreateBattleRequest = z.infer<typeof CreateBattleRequest>;

export const CreateBattleResponse = z.object({
  battleId: z.string(),
  roomCode: z.string(),
});
export type CreateBattleResponse = z.infer<typeof CreateBattleResponse>;

// POST /battles/join — join by room code. (Auth required.)
export const JoinBattleRequest = z.object({
  roomCode: z.string().min(4).max(12),
});
export type JoinBattleRequest = z.infer<typeof JoinBattleRequest>;

export const JoinBattleResponse = z.object({
  battleId: z.string(),
  roomCode: z.string(),
});
export type JoinBattleResponse = z.infer<typeof JoinBattleResponse>;

// GET /battles/:id/result — final result for the results screen.
export const BattleResultResponse = z.object({
  battleId: z.string(),
  config: BattleConfig,
  winnerSide: Side.nullable(),
  reason: FinishReason.nullable(),
  standings: z.array(StandingRow),
  decidingSubmissionId: z.string().nullable(),
});
export type BattleResultResponse = z.infer<typeof BattleResultResponse>;

export const ApiError = z.object({
  code: z.string(),
  message: z.string(),
});
export type ApiError = z.infer<typeof ApiError>;
