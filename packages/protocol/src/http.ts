import { z } from "zod";
import { AvatarId, AvatarColor } from "./avatars.js";
import { BattleConfig, StandingRow } from "./domain.js";
import {
  BattleStatus,
  Difficulty,
  FinishReason,
  Language,
  Mode,
  Side,
} from "./enums.js";

/**
 * REST contract for `apps/http-api`. Request/response bodies validated with
 * these schemas on both ends.
 */

/**
 * Identity field rules, shared by signup and profile edits so the client and
 * server cannot drift on what counts as valid.
 *
 * Username is restricted to letters, digits, underscore and hyphen: it is the
 * battle-facing handle, and allowing spaces or punctuation makes impersonation
 * by lookalike easy and the name awkward to reference.
 */
export const Username = z
  .string()
  .min(3, "Username must be at least 3 characters")
  .max(20, "Username must be at most 20 characters")
  .regex(
    /^[a-zA-Z0-9_-]+$/,
    "Use letters, numbers, underscore or hyphen only",
  );
export type Username = z.infer<typeof Username>;

export const Email = z.string().email("Enter a valid email address").max(254);

/**
 * Minimum 8 characters and nothing else. Composition rules (a symbol, a digit,
 * a capital) push people toward predictable substitutions rather than longer
 * passwords, so length is the only requirement worth enforcing.
 */
export const Password = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(200);

/** Real name, optional everywhere. Empty string is treated as "not set". */
export const RealName = z.string().max(60);

/**
 * A profile photo, stored inline as a data URL (there is no object store yet;
 * see apps/web/lib/image.ts).
 *
 * The length cap is enforced here rather than only in the browser because the
 * client limit is advisory — anyone can POST directly — and an unbounded string
 * column is a cheap way to bloat the database. 400KB leaves headroom over the
 * ~300KB the client targets.
 *
 * `data:` only: an arbitrary remote URL would let a profile field point the
 * whole site at a third-party host, which is both a privacy leak (every viewer
 * hits it) and an SSRF-shaped foot-gun the day anything server-side fetches it.
 */
export const ProfileImage = z
  .string()
  .max(400_000, "That image is too large.")
  .regex(/^data:image\/(png|jpeg|webp);base64,/, "Unsupported image format.");

// POST /auth/signup — create an account.
export const SignupRequest = z.object({
  email: Email,
  password: Password,
  username: Username,
  /** Optional; shown smaller beneath the username when present. */
  name: RealName.optional(),
  /** Assigned by the client at signup so nobody starts without a character. */
  avatarId: AvatarId.optional(),
  avatarColor: AvatarColor.optional(),
});
export type SignupRequest = z.infer<typeof SignupRequest>;

// POST /auth/login — exchange credentials for a session token.
export const LoginRequest = z.object({
  email: Email,
  /** Not `Password` — an old account may predate the length rule. */
  password: z.string().min(1, "Enter your password"),
});
export type LoginRequest = z.infer<typeof LoginRequest>;

/** GET /auth/available?username=… — live uniqueness check for the signup form. */
export const UsernameAvailableResponse = z.object({
  username: z.string(),
  available: z.boolean(),
});
export type UsernameAvailableResponse = z.infer<
  typeof UsernameAvailableResponse
>;

/** What both signup and login return: a token plus the identity to render. */
export const AuthResponse = z.object({
  token: z.string(),
  userId: z.string(),
  username: z.string(),
  name: z.string().nullable(),
  email: z.string(),
  avatarId: AvatarId,
  avatarColor: AvatarColor,
  imageUrl: z.string().nullable(),
});
export type AuthResponse = z.infer<typeof AuthResponse>;

// GET /me — the caller's profile and progression. (Auth required.)
// Separate from auth because progression changes after every battle, so the
// client needs to be able to refetch it without re-authenticating.
export const ProfileResponse = z.object({
  userId: z.string(),
  username: z.string(),
  name: z.string().nullable(),
  email: z.string(),
  avatarId: AvatarId,
  avatarColor: AvatarColor,
  imageUrl: z.string().nullable(),
  xp: z.number().int().min(0),
  wins: z.number().int().min(0),
  losses: z.number().int().min(0),
  winStreak: z.number().int().min(0),
  bestStreak: z.number().int().min(0),
});
export type ProfileResponse = z.infer<typeof ProfileResponse>;

// PATCH /me — change identity or look. (Auth required.)
// Every field optional: the client sends only what actually changed.
export const UpdateProfileRequest = z.object({
  username: Username.optional(),
  /** Empty string clears the name; that is why this is not `.min(1)`. */
  name: RealName.optional(),
  avatarId: AvatarId.optional(),
  avatarColor: AvatarColor.optional(),
  /** Null clears an uploaded photo and falls back to the pixel avatar. */
  imageUrl: ProfileImage.nullable().optional(),
});
export type UpdateProfileRequest = z.infer<typeof UpdateProfileRequest>;

/**
 * The update response carries a FRESH token: JWTs embed the username, and
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
  username: z.string(),
  name: z.string().nullable(),
  avatarId: AvatarId,
  avatarColor: AvatarColor,
  imageUrl: z.string().nullable(),
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

// GET /battles/:id/solutions — every side's source code, AFTER the battle.
//
// Source is withheld entirely while a battle is live (see the arena: you only
// ever see an opponent's pass-count). Once it is FINISHED the code is no longer
// worth copying, and reading how your opponent solved it is the point of the
// debrief — so the whole room's submissions become readable here.
export const SolutionEntry = z.object({
  submissionId: z.string(),
  userId: z.string(),
  username: z.string(),
  avatarId: AvatarId,
  avatarColor: AvatarColor,
  imageUrl: z.string().nullable(),
  side: Side,
  language: Language,
  sourceCode: z.string(),
  passed: z.number().int().min(0),
  total: z.number().int().min(0),
  timeMs: z.number().min(0),
  /** ISO timestamp the server received it — the tie-break authority. */
  submittedAt: z.string(),
  /** True for the submission that decided the battle. */
  isDeciding: z.boolean(),
});
export type SolutionEntry = z.infer<typeof SolutionEntry>;

export const BattleSolutionsResponse = z.object({
  battleId: z.string(),
  /** Best (or only) submission per player, newest-scoring first. */
  entries: z.array(SolutionEntry),
});
export type BattleSolutionsResponse = z.infer<typeof BattleSolutionsResponse>;

export const ApiError = z.object({
  code: z.string(),
  message: z.string(),
});
export type ApiError = z.infer<typeof ApiError>;
