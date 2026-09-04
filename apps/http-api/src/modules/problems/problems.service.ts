/**
 * Community problems: the public catalogue and player submissions.
 *
 * Separate from admin.service on purpose. The admin module trusts its caller
 * completely — a SUPER_ADMIN may write anything. This module does not: every
 * function here is reachable by any logged-in player, so ownership and review
 * state are checked on the SERVER rather than assumed from the UI.
 */

import { prisma } from "@repo/db";
import type {
  CommunityProblemInput,
  IntelCatalogueResponse,
  MyProblemDetail,
  MyProblemRow,
} from "@repo/protocol";
import { badRequest, conflict, forbidden, notFound } from "../../http/errors.js";
import { findDuplicates } from "./duplicates.js";

/**
 * How many problems one author may have awaiting review at once.
 *
 * A queue limit rather than a rate limit: the cost being controlled is the
 * REVIEWER's attention, not server load. Someone with five unreviewed
 * submissions should improve those before adding a sixth.
 */
const MAX_PENDING_PER_AUTHOR = 5;

/** Reject starter code naming a language the problem does not allow. */
function assertStarterCodeMatches(input: CommunityProblemInput): void {
  for (const lang of Object.keys(input.starterCode)) {
    if (!input.allowedLanguages.includes(lang as never)) {
      throw badRequest(
        `Starter code names ${lang}, which is not in the allowed languages.`,
      );
    }
  }
}

/**
 * Reject a test suite that cannot distinguish a right answer from a wrong one.
 *
 * Two test cases whose expected output is identical will both pass for a
 * program that ignores its input entirely. A reviewer would catch it, but
 * catching it here means the author finds out immediately instead of after a
 * round trip through a human.
 */
function assertTestsAreDiscriminating(input: CommunityProblemInput): void {
  const outputs = new Set(
    input.testCases.map((t) => t.expectedOutput.trim()),
  );
  if (outputs.size === 1) {
    throw badRequest(
      "Every test case expects the same output — a program that ignores its " +
        "input would pass. Add a case with a different answer.",
    );
  }
  const blank = input.testCases.filter((t) => t.expectedOutput.trim() === "");
  if (blank.length === input.testCases.length) {
    throw badRequest("Test cases need expected output.");
  }
}

/**
 * The public catalogue.
 *
 * APPROVED only, and deliberately WITHOUT statements or test cases — see the
 * note on IntelProblemRow. `_count` on battles gives the usage figure without
 * loading a single battle row.
 */
export async function listCatalogue(): Promise<IntelCatalogueResponse> {
  const rows = await prisma.problem.findMany({
    where: { status: "APPROVED" },
    select: {
      id: true,
      title: true,
      difficulty: true,
      author: { select: { username: true } },
      _count: { select: { battles: true } },
    },
    orderBy: [{ difficulty: "asc" }, { title: "asc" }],
  });

  const mapped = rows.map((r) => ({
    id: r.id,
    title: r.title,
    difficulty: r.difficulty,
    battleCount: r._count.battles,
    authorName: r.author?.username ?? null,
  }));

  return {
    rows: mapped,
    easy: mapped.filter((r) => r.difficulty === "EASY").length,
    medium: mapped.filter((r) => r.difficulty === "MEDIUM").length,
    hard: mapped.filter((r) => r.difficulty === "HARD").length,
  };
}

/** Everything this author has submitted, newest first. */
export async function listMyProblems(userId: string): Promise<MyProblemRow[]> {
  const rows = await prisma.problem.findMany({
    where: { authorId: userId },
    select: {
      id: true,
      title: true,
      difficulty: true,
      status: true,
      reviewNote: true,
      reviewedAt: true,
      createdAt: true,
      _count: { select: { battles: true, testCases: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    difficulty: r.difficulty,
    status: r.status,
    reviewNote: r.reviewNote,
    reviewedAt: r.reviewedAt?.toISOString() ?? null,
    battleCount: r._count.battles,
    testCount: r._count.testCases,
    createdAt: r.createdAt.toISOString(),
  }));
}

/**
 * One of the author's own problems, in full.
 *
 * Ownership is enforced in the WHERE clause rather than fetched-then-checked,
 * so there is no window in which the row exists in memory for the wrong user.
 * A problem belonging to someone else is reported as missing, not forbidden —
 * "forbidden" would confirm the id exists.
 */
export async function getMyProblem(
  userId: string,
  id: string,
): Promise<MyProblemDetail> {
  const row = await prisma.problem.findFirst({
    where: { id, authorId: userId },
    select: {
      id: true,
      title: true,
      statementMarkdown: true,
      constraints: true,
      difficulty: true,
      status: true,
      reviewNote: true,
      allowedLanguages: true,
      starterCode: true,
      timeLimitDefaultSec: true,
      testCases: {
        orderBy: { ordinal: "asc" },
        select: {
          kind: true,
          input: true,
          expectedOutput: true,
          ordinal: true,
          weight: true,
        },
      },
    },
  });
  if (!row) throw notFound("No such problem.");

  return {
    ...row,
    starterCode: (row.starterCode ?? {}) as Record<string, string>,
  };
}

/**
 * Submit a new problem for review.
 *
 * `acknowledgedDuplicate` is the author saying "I have seen the near-matches
 * and mine is different". Without it, a near-match returns 409 carrying the
 * matches so the UI can show them. An EXACT title collision is refused
 * regardless — there is no judgement call to make.
 */
export async function submitProblem(
  userId: string,
  input: CommunityProblemInput,
  acknowledgedDuplicate: boolean,
): Promise<{ id: string; warnings: Awaited<ReturnType<typeof findDuplicates>>["matches"] }> {
  assertStarterCodeMatches(input);
  assertTestsAreDiscriminating(input);

  const author = await prisma.user.findUnique({
    where: { id: userId },
    select: { isGuest: true },
  });
  if (!author) throw notFound("No such user.");
  if (author.isGuest) {
    throw forbidden("Guests cannot submit problems. Create an account first.");
  }

  const pending = await prisma.problem.count({
    where: { authorId: userId, status: "PENDING" },
  });
  if (pending >= MAX_PENDING_PER_AUTHOR) {
    throw conflict(
      "TOO_MANY_PENDING",
      `You already have ${pending} problems awaiting review. Wait for those before submitting more.`,
    );
  }

  const dupes = await findDuplicates(input.title, input.statementMarkdown);
  if (dupes.exact) {
    throw conflict(
      "DUPLICATE_PROBLEM",
      `A problem called "${dupes.matches[0]?.title}" already exists. Pick a different title.`,
    );
  }
  if (dupes.duplicate && !acknowledgedDuplicate) {
    throw conflict(
      "POSSIBLE_DUPLICATE",
      "This looks close to a problem the arena already has.",
    );
  }

  const problem = await prisma.problem.create({
    data: {
      title: input.title.trim(),
      statementMarkdown: input.statementMarkdown,
      constraints: input.constraints,
      difficulty: input.difficulty,
      allowedLanguages: input.allowedLanguages,
      starterCode: input.starterCode,
      timeLimitDefaultSec: input.timeLimitDefaultSec,
      status: "PENDING",
      authorId: userId,
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

  return { id: problem.id, warnings: dupes.matches };
}

/**
 * Edit one of the author's own submissions.
 *
 * Only while PENDING or REJECTED. An APPROVED problem is live — players have
 * fought it and results reference it — so letting the author rewrite it after
 * the fact would change a problem out from under a finished battle.
 *
 * Resubmitting a REJECTED problem returns it to PENDING and clears the note,
 * which is what makes rejection a round trip rather than a dead end.
 */
export async function updateMyProblem(
  userId: string,
  id: string,
  input: CommunityProblemInput,
  acknowledgedDuplicate: boolean,
): Promise<{ id: string; status: "PENDING" }> {
  assertStarterCodeMatches(input);
  assertTestsAreDiscriminating(input);

  const existing = await prisma.problem.findFirst({
    where: { id, authorId: userId },
    select: { status: true },
  });
  if (!existing) throw notFound("No such problem.");
  if (existing.status === "APPROVED") {
    throw conflict(
      "PROBLEM_APPROVED",
      "This problem is live and can no longer be edited.",
    );
  }

  const dupes = await findDuplicates(input.title, input.statementMarkdown, id);
  if (dupes.exact) {
    throw conflict(
      "DUPLICATE_PROBLEM",
      `A problem called "${dupes.matches[0]?.title}" already exists. Pick a different title.`,
    );
  }
  if (dupes.duplicate && !acknowledgedDuplicate) {
    throw conflict(
      "POSSIBLE_DUPLICATE",
      "This looks close to a problem the arena already has.",
    );
  }

  // Test cases are replaced wholesale rather than diffed: nothing references a
  // TestCase row, so they have no identity worth preserving — the same choice
  // admin.service makes for the same reason.
  await prisma.$transaction([
    prisma.testCase.deleteMany({ where: { problemId: id } }),
    prisma.problem.update({
      where: { id },
      data: {
        title: input.title.trim(),
        statementMarkdown: input.statementMarkdown,
        constraints: input.constraints,
        difficulty: input.difficulty,
        allowedLanguages: input.allowedLanguages,
        starterCode: input.starterCode,
        timeLimitDefaultSec: input.timeLimitDefaultSec,
        // Back into the queue, with the old rejection note cleared.
        status: "PENDING",
        reviewNote: null,
        reviewedAt: null,
        reviewedById: null,
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

  return { id, status: "PENDING" };
}

/**
 * Withdraw a submission.
 *
 * Only while it is not approved: an approved problem may already have battles
 * pointing at it, and deleting it would orphan their results.
 */
export async function withdrawMyProblem(
  userId: string,
  id: string,
): Promise<void> {
  const existing = await prisma.problem.findFirst({
    where: { id, authorId: userId },
    select: { status: true, _count: { select: { battles: true } } },
  });
  if (!existing) throw notFound("No such problem.");
  if (existing.status === "APPROVED" || existing._count.battles > 0) {
    throw conflict(
      "PROBLEM_IN_USE",
      "This problem is live and cannot be withdrawn.",
    );
  }
  await prisma.problem.delete({ where: { id } });
}
