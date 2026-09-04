import { z } from "zod";
import { Difficulty, Language, ProblemStatus, TestKind } from "./enums.js";

/**
 * Community problems — the catalogue players browse and the ones they submit.
 *
 * WHAT IS DELIBERATELY ABSENT FROM THE CATALOGUE
 * ----------------------------------------------
 * `IntelProblemRow` carries a title, a difficulty and a usage count, and
 * NOTHING ELSE. No statement, no constraints, no test cases — not even the
 * sample ones.
 *
 * That is the whole point. A player who can read a problem before meeting it
 * in a ranked battle can memorise the answer, and the rating that results is
 * a lie. The catalogue exists to show what the arena holds and how much each
 * problem gets played, not to be a practice ground.
 *
 * A submission author is the one exception: they may read back their OWN
 * problem in full, because they wrote it.
 */

/** One test case as the author's form submits it. */
export const CommunityTestCaseInput = z.object({
  kind: TestKind,
  input: z.string(),
  expectedOutput: z.string(),
  weight: z.number().int().min(1).max(100).default(1),
});
export type CommunityTestCaseInput = z.infer<typeof CommunityTestCaseInput>;

/**
 * A problem as a player submits it.
 *
 * Mirrors AdminProblemInput rather than extending it: the two forms are
 * allowed to drift (an admin may one day set fields a player cannot), and
 * inheriting would make that drift a breaking change instead of an edit.
 *
 * The floors are higher than the admin form's on purpose. An admin writing a
 * two-word statement is making a mistake they can see and fix; a stranger
 * doing it is submitting something the reviewer has to read and reject. Asking
 * for 40 characters of statement and two test cases costs an honest author
 * nothing and removes most of the noise.
 */
export const CommunityProblemInput = z.object({
  title: z
    .string()
    .min(6, "Give the problem a real title")
    .max(120, "Title is too long"),
  statementMarkdown: z
    .string()
    .min(40, "Explain the problem properly — at least a couple of sentences")
    .max(20000),
  constraints: z.string().max(2000).default(""),
  difficulty: Difficulty,
  allowedLanguages: z.array(Language).min(1, "Pick at least one language"),
  starterCode: z.record(Language, z.string()),
  timeLimitDefaultSec: z.number().int().min(60).max(7200),
  testCases: z
    .array(CommunityTestCaseInput)
    // Two, not one: a single test case is almost never enough to tell a
    // correct solution from one that hard-codes the answer.
    .min(2, "Add at least two test cases")
    .max(40, "That is more test cases than a battle needs"),
});
export type CommunityProblemInput = z.infer<typeof CommunityProblemInput>;

/**
 * A near-duplicate the server found while checking a submission.
 *
 * `similarity` is 0..1 over the normalised title, and `reason` says which
 * field triggered it, so the author is told what to change rather than just
 * being blocked.
 */
export const DuplicateMatch = z.object({
  id: z.string(),
  title: z.string(),
  difficulty: Difficulty,
  similarity: z.number().min(0).max(1),
  reason: z.enum(["TITLE", "STATEMENT"]),
});
export type DuplicateMatch = z.infer<typeof DuplicateMatch>;

/** The answer to "is this problem already in the arena?". */
export const DuplicateCheckResponse = z.object({
  /** True when something is close enough that the author should look. */
  duplicate: z.boolean(),
  matches: z.array(DuplicateMatch).default([]),
});
export type DuplicateCheckResponse = z.infer<typeof DuplicateCheckResponse>;

/** What the duplicate check needs. Deliberately not the whole problem. */
export const DuplicateCheckRequest = z.object({
  title: z.string().min(1).max(200),
  statementMarkdown: z.string().max(20000).default(""),
  /** Set when editing, so a problem is not reported as a duplicate of itself. */
  excludeId: z.string().optional(),
});
export type DuplicateCheckRequest = z.infer<typeof DuplicateCheckRequest>;

/** One row of the public catalogue. No statement, no tests — see the note above. */
export const IntelProblemRow = z.object({
  id: z.string(),
  title: z.string(),
  difficulty: Difficulty,
  /** How many battles have used it. The only statistic worth showing. */
  battleCount: z.number().int().min(0),
  /** Username of the player who authored it; null when the arena wrote it. */
  authorName: z.string().nullable().default(null),
});
export type IntelProblemRow = z.infer<typeof IntelProblemRow>;

export const IntelCatalogueResponse = z.object({
  rows: z.array(IntelProblemRow),
  /** Totals by difficulty, for the catalogue header. */
  easy: z.number().int().min(0).default(0),
  medium: z.number().int().min(0).default(0),
  hard: z.number().int().min(0).default(0),
});
export type IntelCatalogueResponse = z.infer<typeof IntelCatalogueResponse>;

/** One of the author's own submissions, with its review state. */
export const MyProblemRow = z.object({
  id: z.string(),
  title: z.string(),
  difficulty: Difficulty,
  status: ProblemStatus,
  /** The reviewer's note, when it was rejected. */
  reviewNote: z.string().nullable().default(null),
  reviewedAt: z.string().nullable().default(null),
  battleCount: z.number().int().min(0).default(0),
  testCount: z.number().int().min(0).default(0),
  createdAt: z.string(),
});
export type MyProblemRow = z.infer<typeof MyProblemRow>;

export const MyProblemsResponse = z.object({
  rows: z.array(MyProblemRow),
});
export type MyProblemsResponse = z.infer<typeof MyProblemsResponse>;

/** The author reading back one of their own submissions, in full. */
export const MyProblemDetail = z.object({
  id: z.string(),
  title: z.string(),
  statementMarkdown: z.string(),
  constraints: z.string(),
  difficulty: Difficulty,
  status: ProblemStatus,
  reviewNote: z.string().nullable().default(null),
  allowedLanguages: z.array(z.string()),
  starterCode: z.record(z.string(), z.string()),
  timeLimitDefaultSec: z.number().int(),
  testCases: z.array(
    z.object({
      kind: TestKind,
      input: z.string(),
      expectedOutput: z.string(),
      ordinal: z.number().int(),
      weight: z.number().int(),
    }),
  ),
});
export type MyProblemDetail = z.infer<typeof MyProblemDetail>;

/** What a submission returns: the new id, plus anything the author should see. */
export const SubmitProblemResponse = z.object({
  id: z.string(),
  status: ProblemStatus,
  /** Near-duplicates found at submit time, when the author chose to proceed. */
  warnings: z.array(DuplicateMatch).default([]),
});
export type SubmitProblemResponse = z.infer<typeof SubmitProblemResponse>;

/** An admin's decision on a submitted problem. */
export const ReviewDecisionInput = z.object({
  /** Required when rejecting: the author is shown this verbatim. */
  reviewNote: z
    .string()
    .max(1000)
    .optional()
    .transform((v) => v?.trim() ?? ""),
});
export type ReviewDecisionInput = z.infer<typeof ReviewDecisionInput>;
