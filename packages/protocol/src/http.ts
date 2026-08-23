import { z } from "zod";
import { AvatarId, AvatarColor } from "./avatars.js";
import { BattleConfig, StandingRow } from "./domain.js";
import {
  BattleStatus,
  Difficulty,
  FinishReason,
  Mode,
  Side,
} from "./enums.js";

/**
 * REST contract for `apps/http-api`. Request/response bodies validated with
 * these schemas on both ends.
 */

// POST /auth/guest — create a guest identity.
export const GuestAuthRequest = z.object({
  displayName: z.string().min(1).max(24),
  /** Optional at sign-up — omitted means "seed one from my user id". */
  avatarId: AvatarId.optional(),
  avatarColor: AvatarColor.optional(),
});
export type GuestAuthRequest = z.infer<typeof GuestAuthRequest>;

export const GuestAuthResponse = z.object({
  token: z.string(),
  userId: z.string(),
  displayName: z.string(),
  avatarId: AvatarId,
  avatarColor: AvatarColor,
});
export type GuestAuthResponse = z.infer<typeof GuestAuthResponse>;

// GET /me — the caller's profile and progression. (Auth required.)
// Separate from auth because progression changes after every battle, so the
// client needs to be able to refetch it without re-authenticating.
export const ProfileResponse = z.object({
  userId: z.string(),
  displayName: z.string(),
  avatarId: AvatarId,
  avatarColor: AvatarColor,
  xp: z.number().int().min(0),
  wins: z.number().int().min(0),
  losses: z.number().int().min(0),
  winStreak: z.number().int().min(0),
  bestStreak: z.number().int().min(0),
});
export type ProfileResponse = z.infer<typeof ProfileResponse>;

// PATCH /me — change your display name. (Auth required.)
export const UpdateProfileRequest = z.object({
  displayName: z.string().min(1).max(24).optional(),
  avatarId: AvatarId.optional(),
  avatarColor: AvatarColor.optional(),
});
export type UpdateProfileRequest = z.infer<typeof UpdateProfileRequest>;

/**
 * The rename response carries a FRESH token: guest JWTs embed displayName, and
 * ws-server seats players using the name in the claims. Without re-minting,
 * a renamed player would still appear under their old name in a battle.
 */
export const UpdateProfileResponse = z.object({
  token: z.string(),
  profile: ProfileResponse,
});
export type UpdateProfileResponse = z.infer<typeof UpdateProfileResponse>;

// GET /leaderboard — top operatives by XP. Public: no auth, no secrets.
export const LeaderboardEntry = z.object({
  rank: z.number().int().positive(),
  userId: z.string(),
  displayName: z.string(),
  avatarId: AvatarId,
  avatarColor: AvatarColor,
  xp: z.number().int().min(0),
  wins: z.number().int().min(0),
  losses: z.number().int().min(0),
  bestStreak: z.number().int().min(0),
});
export type LeaderboardEntry = z.infer<typeof LeaderboardEntry>;

export const LeaderboardResponse = z.object({
  entries: z.array(LeaderboardEntry),
  /** The caller's own row, even if outside the returned page. Null if unranked. */
  me: LeaderboardEntry.nullable(),
});
export type LeaderboardResponse = z.infer<typeof LeaderboardResponse>;

// GET /me/battles — the caller's battle history. (Auth required.)
export const BattleHistoryEntry = z.object({
  battleId: z.string(),
  roomCode: z.string(),
  mode: Mode,
  difficulty: Difficulty,
  status: BattleStatus,
  /** The side the caller played on; null if they never took a seat. */
  mySide: Side.nullable(),
  winnerSide: Side.nullable(),
  reason: FinishReason.nullable(),
  problemTitle: z.string().nullable(),
  myBestPassed: z.number().int().min(0),
  totalTests: z.number().int().min(0),
  finishedAt: z.string().nullable(),
  createdAt: z.string(),
});
export type BattleHistoryEntry = z.infer<typeof BattleHistoryEntry>;

export const BattleHistoryResponse = z.object({
  entries: z.array(BattleHistoryEntry),
});
export type BattleHistoryResponse = z.infer<typeof BattleHistoryResponse>;

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
