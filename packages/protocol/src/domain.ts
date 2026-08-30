import { z } from "zod";
import { AvatarId, AvatarColor } from "./avatars.js";
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
  /** Battle-facing handle. Unique across the site. */
  username: z.string(),
  /** Real name, shown smaller beneath the username when set. */
  name: z.string().nullable(),
  /** Chosen pixel-art character. Everyone in the room sees it. */
  avatarId: AvatarId,
  avatarColor: AvatarColor,
  /** Uploaded photo, which takes precedence over the pixel character. */
  imageUrl: z.string().nullable(),
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
  /**
   * Whether this battle moves ratings. True only for matchmaker-paired
   * battles; a room-code battle is always false, because there the players
   * chose each other and any rating movement could be traded between two
   * accounts. The client shows a "Ranked" marker from this.
   */
  isRanked: z.boolean().default(false),
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
 * A player's Glicko-2 rating state, as the client sees it.
 *
 * `rd` is exposed rather than hidden because it is the honest reason a rating
 * is or is not shown on the ladder: a client that only received `rating` could
 * not explain why a 1700-rated player is listed as unranked.
 */
export const RatingView = z.object({
  rating: z.number(),
  rd: z.number(),
  /** rating - 2*rd. What the leaderboard actually sorts by. */
  conservative: z.number(),
  /** True while rd is too high to publish. */
  provisional: z.boolean(),
  /** Battles that have moved this rating. */
  rankedBattles: z.number().int().nonnegative(),
  peakRating: z.number(),
  /** The Greek-letter tier key, or null while provisional. */
  tier: z.string().nullable(),
  tierLabel: z.string().nullable(),
  /** 0..1 toward the next tier; 0 while provisional, 1 at the ceiling. */
  tierProgress: z.number().min(0).max(1),
});
export type RatingView = z.infer<typeof RatingView>;

/** What one ranked battle did to a rating. */
export const RatingDelta = z.object({
  before: z.number(),
  after: z.number(),
  /** after - before, rounded as displayed. Negative on a loss. */
  delta: z.number(),
  rdBefore: z.number(),
  rdAfter: z.number(),
  /** The tier held before and after, so the UI can celebrate a promotion. */
  tierBefore: z.string().nullable(),
  tierAfter: z.string().nullable(),
});
export type RatingDelta = z.infer<typeof RatingDelta>;

/**
 * One badge, flattened for the wire.
 *
 * The definition (label, description, glyph) is duplicated from @repo/game
 * rather than sent as a bare key, so an older client that has never heard of a
 * newly added badge can still render it correctly instead of showing a blank
 * chip. `earnedAt` is null for a badge that is merely being described.
 */
export const BadgeView = z.object({
  key: z.string(),
  label: z.string(),
  description: z.string(),
  category: z.string(),
  rarity: z.string(),
  glyph: z.string(),
  earnedAt: z.string().nullable().default(null),
});
export type BadgeView = z.infer<typeof BadgeView>;

/** A badge with the holder's progress toward it, for the "locked" shelf. */
export const BadgeProgressView = BadgeView.extend({
  earned: z.boolean(),
  /** 0..1, or null for a badge with no meaningful partial state. */
  progress: z.number().min(0).max(1).nullable(),
});
export type BadgeProgressView = z.infer<typeof BadgeProgressView>;

/**
 * What one player earned from a finished battle. Computed server-side by the
 * pure rules in `@repo/game` — the client renders these, it never derives them.
 */
export const ProgressionAward = z.object({
  userId: z.string(),
  /** XP granted, every multiplier already applied. */
  xp: z.number().int().nonnegative(),
  /** XP before the multipliers, so the UI can show the breakdown. */
  baseXp: z.number().int().nonnegative(),
  multiplier: z.number().positive(),
  /** The difficulty weight applied to this award. */
  difficultyWeight: z.number().positive().default(1),
  /** The anti-grind taper applied: 1 normally, lower past the daily threshold. */
  taper: z.number().positive().default(1),
  /** The player's win streak after this battle. */
  newStreak: z.number().int().nonnegative(),
  perfect: z.boolean(),
  /** Career XP total after this award. */
  totalXp: z.number().int().nonnegative(),

  /**
   * The rating change, or null when the battle was unranked.
   *
   * Room-code battles are always unranked — you pick your own opponent there,
   * so a rating movement could be traded between two accounts. Null is the
   * signal for the results screen to omit the rating row entirely rather than
   * show a misleading zero.
   */
  rating: RatingDelta.nullable().default(null),

  /** Badges this battle unlocked. Usually empty; the UI celebrates non-empty. */
  newBadges: z.array(BadgeView).default([]),
});
export type ProgressionAward = z.infer<typeof ProgressionAward>;

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
