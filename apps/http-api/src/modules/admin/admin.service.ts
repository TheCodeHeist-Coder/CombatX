import { prisma } from "@repo/db";
import { signAdminToken, verifyPassword } from "@repo/auth";
import { tierFor } from "@repo/game";
import type {
  AdminBattlesResponse,
  AdminLoginRequest,
  AdminLoginResponse,
  AdminProblemDetail,
  AdminProblemInput,
  AdminProblemsResponse,
  AdminUsersResponse,
} from "@repo/protocol";
import { badRequest, conflict, notFound, unauthorized } from "../../http/errors.js";
import { env } from "../../env.js";

/** Hard cap on any admin list page, so one request cannot pull the whole table. */
const MAX_PAGE = 200;

/**
 * Log in to the admin panel.
 *
 * The role check happens BEFORE the password is confirmed to be correct in the
 * sense that matters — a non-admin who supplies the right password still gets
 * the same "Invalid credentials" as a wrong one, so this endpoint cannot be
 * used to discover which accounts are administrators.
 */
export async function adminLogin(
  input: AdminLoginRequest,
): Promise<AdminLoginResponse> {
  const user = await prisma.user.findUnique({
    where: { email: input.email.toLowerCase().trim() },
  });

  const passwordOk =
    user?.passwordHash != null
      ? await verifyPassword(input.password, user.passwordHash)
      : false;

  if (!user || !passwordOk || user.role !== "SUPER_ADMIN") {
    throw unauthorized("Invalid credentials.");
  }

  return {
    token: await signAdminToken(
      { userId: user.id, email: user.email ?? "" },
      env.jwtSecret,
    ),
    userId: user.id,
    username: user.username,
    email: user.email ?? "",
  };
}

/** Paged user list. Optional case-insensitive search on username or email. */
export async function listUsers(
  search: string,
  limit: number,
  offset: number,
): Promise<AdminUsersResponse> {
  const where = search
    ? {
        OR: [
          { username: { contains: search, mode: "insensitive" as const } },
          { email: { contains: search, mode: "insensitive" as const } },
          { name: { contains: search, mode: "insensitive" as const } },
        ],
      }
    : {};

  const [rows, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: Math.min(limit, MAX_PAGE),
      skip: offset,
      select: {
        id: true,
        username: true,
        name: true,
        email: true,
        isGuest: true,
        role: true,
        isPublic: true,
        xp: true,
        wins: true,
        losses: true,
        rating: true,
        ratingRd: true,
        ratingVolatility: true,
        rankedBattles: true,
        createdAt: true,
        lastBattleAt: true,
        _count: { select: { badges: true } },
      },
    }),
    prisma.user.count({ where }),
  ]);

  return {
    rows: rows.map(({ _count, ratingVolatility, ...u }) => ({
      ...u,
      rating: Math.round(u.rating),
      ratingRd: Math.round(u.ratingRd),
      // The same tier the player sees, derived from the same pure function —
      // the console must never show a different standing to the one on the
      // profile.
      tier:
        tierFor({
          rating: u.rating,
          rd: u.ratingRd,
          volatility: ratingVolatility,
        })?.key ?? null,
      badgeCount: _count.badges,
      createdAt: u.createdAt.toISOString(),
      lastBattleAt: u.lastBattleAt?.toISOString() ?? null,
    })),
    total,
  };
}

/** Paged battle list, newest first. */
export async function listBattles(
  limit: number,
  offset: number,
): Promise<AdminBattlesResponse> {
  const [rows, total] = await Promise.all([
    prisma.battle.findMany({
      orderBy: { createdAt: "desc" },
      take: Math.min(limit, MAX_PAGE),
      skip: offset,
      include: {
        problem: { select: { title: true } },
        host: { select: { username: true } },
        teams: { include: { _count: { select: { members: true } } } },
      },
    }),
    prisma.battle.count(),
  ]);

  return {
    rows: rows.map((b) => ({
      id: b.id,
      roomCode: b.roomCode,
      mode: b.mode,
      difficulty: b.difficulty,
      status: b.status,
      problemTitle: b.problem?.title ?? null,
      hostUsername: b.host?.username ?? null,
      playerCount: b.teams.reduce((n, t) => n + t._count.members, 0),
      winnerSide: b.winnerSide ?? null,
      createdAt: b.createdAt.toISOString(),
    })),
    total,
  };
}

/** Every problem, with counts the list view shows. */
export async function listProblems(
  status?: "DRAFT" | "PENDING" | "APPROVED" | "REJECTED",
): Promise<AdminProblemsResponse> {
  const rows = await prisma.problem.findMany({
    where: status ? { status } : {},
    // Pending first regardless of the filter: an unreviewed submission is the
    // one thing on this page that is waiting on the admin.
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: {
      testCases: { select: { kind: true } },
      author: { select: { username: true } },
      _count: { select: { battles: true } },
    },
  });

  return {
    rows: rows.map((p) => ({
      id: p.id,
      title: p.title,
      difficulty: p.difficulty,
      allowedLanguages: p.allowedLanguages,
      testCount: p.testCases.length,
      sampleCount: p.testCases.filter((t) => t.kind === "SAMPLE").length,
      battleCount: p._count.battles,
      timeLimitDefaultSec: p.timeLimitDefaultSec,
      createdAt: p.createdAt.toISOString(),
      status: p.status,
      authorName: p.author?.username ?? null,
      reviewNote: p.reviewNote,
    })),
  };
}

/** One problem in full, for the edit form. */
export async function getProblem(id: string): Promise<AdminProblemDetail> {
  const p = await prisma.problem.findUnique({
    where: { id },
    include: {
      testCases: { orderBy: { ordinal: "asc" } },
      _count: { select: { battles: true } },
    },
  });
  if (!p) throw notFound("No such problem.");

  return {
    id: p.id,
    title: p.title,
    statementMarkdown: p.statementMarkdown,
    constraints: p.constraints,
    difficulty: p.difficulty,
    allowedLanguages: p.allowedLanguages,
    starterCode: (p.starterCode ?? {}) as Record<string, string>,
    timeLimitDefaultSec: p.timeLimitDefaultSec,
    battleCount: p._count.battles,
    testCases: p.testCases.map((t) => ({
      id: t.id,
      kind: t.kind,
      input: t.input,
      expectedOutput: t.expectedOutput,
      ordinal: t.ordinal,
      weight: t.weight,
    })),
  };
}

/**
 * Reject a problem whose starter code names a language it does not allow.
 *
 * Caught here rather than left to the client: a starter snippet for a language
 * the problem forbids would be dead data at best, and at worst would surface
 * in the arena's language picker as an option the judge cannot run.
 */
function assertStarterCodeMatches(input: AdminProblemInput): void {
  for (const lang of Object.keys(input.starterCode)) {
    if (!input.allowedLanguages.includes(lang as never)) {
      throw badRequest(
        `Starter code names ${lang}, which is not in the allowed languages.`,
      );
    }
  }
}

/** Create a problem and its test cases in one transaction. */
export async function createProblem(
  input: AdminProblemInput,
): Promise<{ id: string }> {
  assertStarterCodeMatches(input);

  const problem = await prisma.problem.create({
    data: {
      title: input.title,
      statementMarkdown: input.statementMarkdown,
      constraints: input.constraints,
      difficulty: input.difficulty,
      allowedLanguages: input.allowedLanguages,
      starterCode: input.starterCode,
      timeLimitDefaultSec: input.timeLimitDefaultSec,
      testCases: {
        create: input.testCases.map((t, i) => ({
          kind: t.kind,
          input: t.input,
          expectedOutput: t.expectedOutput,
          ordinal: i,
          weight: t.weight,
        })),
      },
    },
    select: { id: true },
  });
  return problem;
}

/**
 * Replace a problem and its test cases.
 *
 * Test cases are deleted and recreated rather than diffed: they have no
 * identity worth preserving (nothing references a TestCase row), and diffing
 * would add a lot of code to save a few writes on a table this small.
 */
export async function updateProblem(
  id: string,
  input: AdminProblemInput,
): Promise<{ id: string }> {
  assertStarterCodeMatches(input);

  const existing = await prisma.problem.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!existing) throw notFound("No such problem.");

  await prisma.$transaction([
    prisma.testCase.deleteMany({ where: { problemId: id } }),
    prisma.problem.update({
      where: { id },
      data: {
        title: input.title,
        statementMarkdown: input.statementMarkdown,
        constraints: input.constraints,
        difficulty: input.difficulty,
        allowedLanguages: input.allowedLanguages,
        starterCode: input.starterCode,
        timeLimitDefaultSec: input.timeLimitDefaultSec,
        testCases: {
          create: input.testCases.map((t, i) => ({
            kind: t.kind,
            input: t.input,
            expectedOutput: t.expectedOutput,
            ordinal: i,
            weight: t.weight,
          })),
        },
      },
    }),
  ]);
  return { id };
}

/**
 * Delete a problem.
 *
 * Refused once any battle references it: those battles' results and
 * submissions only make sense alongside the problem that was asked, and the
 * foreign key would block the delete anyway — this turns a database error into
 * an explanation.
 */
export async function deleteProblem(id: string): Promise<void> {
  const problem = await prisma.problem.findUnique({
    where: { id },
    select: { _count: { select: { battles: true } } },
  });
  if (!problem) throw notFound("No such problem.");
  if (problem._count.battles > 0) {
    throw conflict(
      "PROBLEM_IN_USE",
      `This problem has been used in ${problem._count.battles} battle(s) and cannot be deleted.`,
    );
  }
  await prisma.problem.delete({ where: { id } });
}
