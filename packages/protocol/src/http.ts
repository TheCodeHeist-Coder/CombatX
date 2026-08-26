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
/**
 * "About me" text. Capped well below a database-bloating size; this is a short
 * introduction on a battle site, not a blog post.
 */
export const Bio = z.string().max(500);

/**
 * The external profiles a user may link, as one table.
 *
 * Handles are stored WITHOUT the URL prefix, which is what keeps these fields
 * from becoming an open redirect: the site builds the URL itself from a
 * pattern here, so a value can never point somewhere else. Each `pattern` is
 * that platform's own rule for what a handle may contain.
 *
 * Adding a site means adding a row here — the Prisma column, the settings
 * form, and the profile page all derive from this.
 */
export const PROFILE_LINKS = [
  {
    key: "github",
    label: "GitHub",
    max: 39,
    // GitHub allows internal single hyphens but not leading/trailing ones.
    pattern: /^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/,
    url: (h: string) => `https://github.com/${h}`,
    placeholder: "octocat",
    display: (h: string) => `@${h}`,
  },
  {
    key: "linkedin",
    label: "LinkedIn",
    max: 100,
    pattern: /^[a-zA-Z0-9-]+$/,
    url: (h: string) => `https://www.linkedin.com/in/${h}`,
    placeholder: "your-handle",
    display: (h: string) => h,
  },
  {
    key: "twitter",
    label: "X",
    max: 15,
    pattern: /^[a-zA-Z0-9_]+$/,
    url: (h: string) => `https://x.com/${h}`,
    placeholder: "handle",
    display: (h: string) => `@${h}`,
  },
  {
    key: "codeforces",
    label: "Codeforces",
    max: 24,
    pattern: /^[a-zA-Z0-9_.-]+$/,
    url: (h: string) => `https://codeforces.com/profile/${h}`,
    placeholder: "tourist",
    display: (h: string) => h,
  },
  {
    key: "leetcode",
    label: "LeetCode",
    max: 39,
    pattern: /^[a-zA-Z0-9_.-]+$/,
    url: (h: string) => `https://leetcode.com/u/${h}/`,
    placeholder: "handle",
    display: (h: string) => h,
  },
  {
    key: "codechef",
    label: "CodeChef",
    max: 40,
    pattern: /^[a-zA-Z0-9_]+$/,
    url: (h: string) => `https://www.codechef.com/users/${h}`,
    placeholder: "handle",
    display: (h: string) => h,
  },
  {
    key: "hackerrank",
    label: "HackerRank",
    max: 40,
    pattern: /^[a-zA-Z0-9_]+$/,
    url: (h: string) => `https://www.hackerrank.com/profile/${h}`,
    placeholder: "handle",
    display: (h: string) => h,
  },
] as const;

export type ProfileLinkKey = (typeof PROFILE_LINKS)[number]["key"];

/** A Zod schema per link, built from the table so the rules cannot drift. */
export const ProfileLinkSchemas = Object.fromEntries(
  PROFILE_LINKS.map((l) => [
    l.key,
    z
      .string()
      .max(l.max)
      .regex(l.pattern, `Enter a ${l.label} handle, not a URL.`),
  ]),
) as Record<ProfileLinkKey, z.ZodString>;

/**
 * A personal site. Full URL, but restricted to http(s) so a profile cannot
 * carry a `javascript:` or `data:` link that runs when a visitor clicks it.
 */
export const WebsiteUrl = z
  .string()
  .max(200)
  .url("Enter a full URL, e.g. https://example.com")
  .refine(
    (v) => /^https?:\/\//i.test(v),
    "Only http and https links are allowed.",
  );

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
  isPublic: z.boolean(),
  bio: z.string().nullable(),
  github: z.string().nullable(),
  linkedin: z.string().nullable(),
  twitter: z.string().nullable(),
  codeforces: z.string().nullable(),
  leetcode: z.string().nullable(),
  codechef: z.string().nullable(),
  hackerrank: z.string().nullable(),
  website: z.string().nullable(),
  xp: z.number().int().min(0),
  wins: z.number().int().min(0),
  losses: z.number().int().min(0),
  winStreak: z.number().int().min(0),
  bestStreak: z.number().int().min(0),
});
export type ProfileResponse = z.infer<typeof ProfileResponse>;

/**
 * GET /users/:username — someone else's profile.
 *
 * Deliberately NOT ProfileResponse: this is what a stranger may see, so it
 * omits the account's email entirely. Only served when the owner has made the
 * profile public — see the service, which 404s otherwise.
 */
export const PublicProfileResponse = z.object({
  userId: z.string(),
  username: z.string(),
  name: z.string().nullable(),
  avatarId: AvatarId,
  avatarColor: AvatarColor,
  imageUrl: z.string().nullable(),
  bio: z.string().nullable(),
  github: z.string().nullable(),
  linkedin: z.string().nullable(),
  twitter: z.string().nullable(),
  codeforces: z.string().nullable(),
  leetcode: z.string().nullable(),
  codechef: z.string().nullable(),
  hackerrank: z.string().nullable(),
  website: z.string().nullable(),
  /** ISO date the account was created, for a "member since" line. */
  joinedAt: z.string(),
  xp: z.number().int().min(0),
  wins: z.number().int().min(0),
  losses: z.number().int().min(0),
  winStreak: z.number().int().min(0),
  bestStreak: z.number().int().min(0),
});
export type PublicProfileResponse = z.infer<typeof PublicProfileResponse>;

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
  /** Whether strangers may open this profile. */
  isPublic: z.boolean().optional(),
  // Each nullable so an empty field can clear a previously-set value. The
  // client sends null for "cleared"; omitted still means "leave alone".
  bio: Bio.nullable().optional(),
  github: ProfileLinkSchemas.github.nullable().optional(),
  linkedin: ProfileLinkSchemas.linkedin.nullable().optional(),
  twitter: ProfileLinkSchemas.twitter.nullable().optional(),
  codeforces: ProfileLinkSchemas.codeforces.nullable().optional(),
  leetcode: ProfileLinkSchemas.leetcode.nullable().optional(),
  codechef: ProfileLinkSchemas.codechef.nullable().optional(),
  hackerrank: ProfileLinkSchemas.hackerrank.nullable().optional(),
  website: WebsiteUrl.nullable().optional(),
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
