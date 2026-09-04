import { z } from "zod";
import { Difficulty, Language, Mode, ProblemStatus, TestKind } from "./enums.js";

/**
 * REST contract for the super-admin panel (`/admin/*` on apps/http-api).
 *
 * Kept in its own module rather than mixed into http.ts so it is obvious at a
 * glance which shapes are admin-only, and so a reviewer can check every
 * privileged endpoint by reading one file.
 */

/** POST /admin/login — credentials for the admin panel. */
export const AdminLoginRequest = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password"),
});
export type AdminLoginRequest = z.infer<typeof AdminLoginRequest>;

export const AdminLoginResponse = z.object({
  token: z.string(),
  userId: z.string(),
  username: z.string(),
  email: z.string(),
});
export type AdminLoginResponse = z.infer<typeof AdminLoginResponse>;

/** A single day's tally, for the small trend charts. */
export const DailyCount = z.object({
  /** ISO date, YYYY-MM-DD. */
  day: z.string(),
  count: z.number().int().min(0),
});
export type DailyCount = z.infer<typeof DailyCount>;

/**
 * GET /admin/overview — the dashboard's headline numbers.
 *
 * `onlineNow` is read from ws-server's live socket registry rather than from
 * a database column: the only honest definition of "logged in right now" is a
 * connection that is actually open.
 */
export const AdminOverviewResponse = z.object({
  users: z.object({
    total: z.number().int().min(0),
    registered: z.number().int().min(0),
    guests: z.number().int().min(0),
    /** Live ws-server connections. Null when ws-server is unreachable. */
    onlineNow: z.number().int().min(0).nullable(),
    activeToday: z.number().int().min(0),
    activeWeek: z.number().int().min(0),
    signupsToday: z.number().int().min(0),
    signupsWeek: z.number().int().min(0),
  }),
  battles: z.object({
    total: z.number().int().min(0),
    finished: z.number().int().min(0),
    inProgress: z.number().int().min(0),
    today: z.number().int().min(0),
    week: z.number().int().min(0),
    /** Battles that moved a rating. The rest are room-code battles. */
    ranked: z.number().int().min(0),
  }),
  /**
   * Ladder health. Worth watching as its own group: a placed population that
   * stops growing, or a queue that never drains, is the first sign that ranked
   * play is not working even while total battles look fine.
   */
  ranking: z.object({
    /** Accounts whose rating is settled enough to publish. */
    placed: z.number().int().min(0),
    /** Accounts that have played ranked but are still provisional. */
    placing: z.number().int().min(0),
    /** Players currently waiting for a match. */
    queued: z.number().int().min(0),
    /** Rating of the highest placed player, or null when nobody is placed. */
    topRating: z.number().int().nullable(),
    /** How many hold each tier, keyed by tier key. */
    byTier: z.record(z.string(), z.number().int().min(0)),
    /** Badge awards handed out in total. */
    badgesAwarded: z.number().int().min(0),
  }),
  submissions: z.object({
    total: z.number().int().min(0),
    today: z.number().int().min(0),
  }),
  traffic: z.object({
    totalViews: z.number().int().min(0),
    viewsToday: z.number().int().min(0),
    uniqueVisitors30d: z.number().int().min(0),
    /** Most-visited paths over the last 30 days. */
    topPaths: z.array(
      z.object({ path: z.string(), count: z.number().int().min(0) }),
    ),
  }),
  problems: z.object({
    total: z.number().int().min(0),
    byDifficulty: z.record(Difficulty, z.number().int().min(0)),
  }),
  /** Last 14 days, oldest first — drives the sparklines. */
  trend: z.object({
    signups: z.array(DailyCount),
    battles: z.array(DailyCount),
    views: z.array(DailyCount),
  }),
});
export type AdminOverviewResponse = z.infer<typeof AdminOverviewResponse>;

/** A user row in the admin table. Carries the email, which the public API never does. */
export const AdminUserRow = z.object({
  id: z.string(),
  username: z.string(),
  name: z.string().nullable(),
  email: z.string().nullable(),
  isGuest: z.boolean(),
  role: z.enum(["PLAYER", "SUPER_ADMIN"]),
  isPublic: z.boolean(),
  xp: z.number().int(),
  wins: z.number().int(),
  losses: z.number().int(),
  /** Glicko-2 standing, so the console can spot rating anomalies. */
  rating: z.number().int(),
  ratingRd: z.number().int(),
  rankedBattles: z.number().int(),
  /** The tier key, or null while the rating is still provisional. */
  tier: z.string().nullable(),
  badgeCount: z.number().int().min(0).default(0),
  createdAt: z.string(),
  lastBattleAt: z.string().nullable(),
});
export type AdminUserRow = z.infer<typeof AdminUserRow>;

export const AdminUsersResponse = z.object({
  rows: z.array(AdminUserRow),
  total: z.number().int().min(0),
});
export type AdminUsersResponse = z.infer<typeof AdminUsersResponse>;

/** A battle row in the admin table. */
export const AdminBattleRow = z.object({
  id: z.string(),
  roomCode: z.string(),
  mode: Mode,
  difficulty: Difficulty,
  status: z.string(),
  problemTitle: z.string().nullable(),
  hostUsername: z.string().nullable(),
  playerCount: z.number().int().min(0),
  winnerSide: z.string().nullable(),
  createdAt: z.string(),
});
export type AdminBattleRow = z.infer<typeof AdminBattleRow>;

export const AdminBattlesResponse = z.object({
  rows: z.array(AdminBattleRow),
  total: z.number().int().min(0),
});
export type AdminBattlesResponse = z.infer<typeof AdminBattlesResponse>;

/* --- Problem authoring ---------------------------------------------------- */

/** One test case as the admin form submits it. */
export const AdminTestCaseInput = z.object({
  kind: TestKind,
  input: z.string(),
  expectedOutput: z.string(),
  /** Weight toward the pass count. Defaults to 1. */
  weight: z.number().int().min(1).max(100).default(1),
});
export type AdminTestCaseInput = z.infer<typeof AdminTestCaseInput>;

/**
 * A problem, as created or edited in the admin panel.
 *
 * At least one test case is required: a problem with none would let every
 * submission "pass" vacuously and end a battle the instant it started.
 */
export const AdminProblemInput = z.object({
  title: z.string().min(1, "Title is required").max(120),
  statementMarkdown: z.string().min(1, "Statement is required"),
  constraints: z.string().max(2000).default(""),
  difficulty: Difficulty,
  allowedLanguages: z
    .array(Language)
    .min(1, "Pick at least one language"),
  /** language -> starter snippet. Keys must be in allowedLanguages. */
  starterCode: z.record(Language, z.string()),
  timeLimitDefaultSec: z.number().int().min(60).max(7200),
  testCases: z
    .array(AdminTestCaseInput)
    .min(1, "A problem needs at least one test case"),
});
export type AdminProblemInput = z.infer<typeof AdminProblemInput>;

export const AdminProblemRow = z.object({
  id: z.string(),
  title: z.string(),
  difficulty: Difficulty,
  allowedLanguages: z.array(z.string()),
  testCount: z.number().int().min(0),
  sampleCount: z.number().int().min(0),
  battleCount: z.number().int().min(0),
  timeLimitDefaultSec: z.number().int(),
  createdAt: z.string(),
  /** Review state. Seeded and admin-authored problems are APPROVED. */
  status: ProblemStatus.default("APPROVED"),
  /** Username of the player who submitted it; null for admin-authored. */
  authorName: z.string().nullable().default(null),
  /** Why it was rejected, if it was. */
  reviewNote: z.string().nullable().default(null),
});
export type AdminProblemRow = z.infer<typeof AdminProblemRow>;

export const AdminProblemsResponse = z.object({
  rows: z.array(AdminProblemRow),
});
export type AdminProblemsResponse = z.infer<typeof AdminProblemsResponse>;

/** The full problem, for the edit form. */
export const AdminProblemDetail = z.object({
  id: z.string(),
  title: z.string(),
  statementMarkdown: z.string(),
  constraints: z.string(),
  difficulty: Difficulty,
  allowedLanguages: z.array(z.string()),
  starterCode: z.record(z.string(), z.string()),
  timeLimitDefaultSec: z.number().int(),
  battleCount: z.number().int().min(0),
  testCases: z.array(
    z.object({
      id: z.string(),
      kind: TestKind,
      input: z.string(),
      expectedOutput: z.string(),
      ordinal: z.number().int(),
      weight: z.number().int(),
    }),
  ),
});
export type AdminProblemDetail = z.infer<typeof AdminProblemDetail>;

// --- Badge rules -----------------------------------------------------------
//
// Badges are admin-editable. A rule is DATA — a metric, a comparator and a
// threshold — never an expression, so nothing an admin types is ever executed.
// The metric list is closed and mirrored from @repo/game, which means a
// malformed or unknown metric is rejected at the edge by Zod rather than
// reaching the evaluator.

export const BadgeMetricEnum = z.enum([
  "wins", "losses", "draws", "xp", "bestStreak", "rankedBattles",
  "upsetWins", "perfectWins", "easyWins", "mediumWins", "hardWins",
  "distinctProblemsWon", "accountAgeDays", "signupOrdinal",
  "rating", "conservativeRating", "tierIndex", "placed", "winRate",
]);
export type BadgeMetricEnum = z.infer<typeof BadgeMetricEnum>;

export const BadgeComparatorEnum = z.enum(["gte", "lte"]);
export type BadgeComparatorEnum = z.infer<typeof BadgeComparatorEnum>;

export const BadgeCategoryEnum = z.enum([
  "MILESTONE", "DIFFICULTY", "SKILL", "STREAK", "PIONEER", "CONTRIBUTION",
]);
export type BadgeCategoryEnum = z.infer<typeof BadgeCategoryEnum>;

export const BadgeRarityEnum = z.enum([
  "COMMON", "UNCOMMON", "RARE", "LEGENDARY",
]);
export type BadgeRarityEnum = z.infer<typeof BadgeRarityEnum>;

export const AdminBadgeCondition = z.object({
  metric: BadgeMetricEnum,
  comparator: BadgeComparatorEnum,
  /** Bounded so a typo cannot create a rule no player could ever satisfy. */
  threshold: z.number().min(0).max(1_000_000),
});
export type AdminBadgeCondition = z.infer<typeof AdminBadgeCondition>;

/**
 * What the console sends when creating or editing a badge.
 *
 * `key` is absent: it is set once at creation and never editable, because
 * UserBadge rows reference it. Renaming a badge changes its LABEL, which is
 * free; changing the key would orphan every award already handed out.
 */
export const AdminBadgeInput = z.object({
  label: z.string().min(1, "A name is required").max(40),
  description: z.string().min(1, "A description is required").max(200),
  category: BadgeCategoryEnum,
  rarity: BadgeRarityEnum,
  /** Which animal crest to draw. Validated against the art list by the client. */
  artKey: z.string().min(1).max(60),
  glyph: z.string().min(1).max(2),
  conditions: z
    .array(AdminBadgeCondition)
    .min(1, "A badge needs at least one condition")
    .max(6, "Six conditions is plenty"),
  progressFrom: z.number().int().min(0).max(5).nullable(),
  /** Repeatable badges award one copy per this much of the progress metric. */
  repeatEvery: z.number().int().min(1).max(1000).nullable().default(null),
  enabled: z.boolean(),
  sortOrder: z.number().int().min(0).max(100_000),
});
export type AdminBadgeInput = z.infer<typeof AdminBadgeInput>;

/** Creating a badge also needs a key, which is then permanent. */
export const AdminBadgeCreate = AdminBadgeInput.extend({
  key: z
    .string()
    .min(2)
    .max(40)
    .regex(/^[A-Z][A-Z0-9_]*$/, "Use CAPITALS_AND_UNDERSCORES"),
});
export type AdminBadgeCreate = z.infer<typeof AdminBadgeCreate>;

export const AdminBadgeRow = AdminBadgeCreate.extend({
  /** How many players currently hold this badge. */
  holders: z.number().int().min(0),
  /** A one-line, human-readable rendering of the conditions. */
  summary: z.string(),
});
export type AdminBadgeRow = z.infer<typeof AdminBadgeRow>;

export const AdminBadgesResponse = z.object({
  rows: z.array(AdminBadgeRow),
  /** True when the table has never been seeded, so the console can offer to. */
  empty: z.boolean(),
});
export type AdminBadgesResponse = z.infer<typeof AdminBadgesResponse>;

/**
 * The result of re-running every rule over every player.
 *
 * Editing a threshold does not retroactively award anything on its own — the
 * award pass runs when a battle finishes. This endpoint is the explicit
 * "apply it now" action, and it reports what actually changed so an operator
 * can see the blast radius of their edit.
 */
export const AdminBadgeRecalcResponse = z.object({
  usersScanned: z.number().int().min(0),
  awarded: z.number().int().min(0),
  revoked: z.number().int().min(0),
  /** Per-badge counts of what was handed out, keyed by badge key. */
  awardedByBadge: z.record(z.string(), z.number().int()),
});
export type AdminBadgeRecalcResponse = z.infer<typeof AdminBadgeRecalcResponse>;

/** A preview of how many players a rule would match, before saving it. */
export const AdminBadgePreviewRequest = z.object({
  conditions: z.array(AdminBadgeCondition).min(1).max(6),
});
export type AdminBadgePreviewRequest = z.infer<typeof AdminBadgePreviewRequest>;

export const AdminBadgePreviewResponse = z.object({
  /** How many non-guest accounts satisfy these conditions right now. */
  matches: z.number().int().min(0),
  totalUsers: z.number().int().min(0),
  summary: z.string(),
});
export type AdminBadgePreviewResponse = z.infer<typeof AdminBadgePreviewResponse>;
