import { z } from "zod";
import { Difficulty, Language, Mode, TestKind } from "./enums.js";

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
