import type { Request, Response } from "express";
import {
  CommunityProblemInput,
  DuplicateCheckRequest,
} from "@repo/protocol";
import type { AuthedRequest } from "../../middleware/auth.js";
import { badRequest, HttpError } from "../../http/errors.js";
import { findDuplicates } from "./duplicates.js";
import {
  getMyProblem,
  listCatalogue,
  listMyProblems,
  submitProblem,
  updateMyProblem,
  withdrawMyProblem,
} from "./problems.service.js";

function firstIssue(error: { issues: { message: string }[] }): string {
  return error.issues[0]?.message ?? "Invalid input";
}

/**
 * Did the author say "yes, I know it looks similar"?
 *
 * A query flag rather than a body field so it never has to be threaded through
 * the problem schema, which describes the PROBLEM and not the act of sending
 * it. Only ever relaxes a warning; it can never bypass an exact-title refusal.
 */
function acknowledged(req: Request): boolean {
  return req.query.acknowledgeDuplicate === "true";
}

/**
 * Read `:id` as a plain string.
 *
 * Express types a route param as `string | string[]`, because a pattern CAN
 * repeat one. Ours cannot, so this narrows in a single place rather than
 * casting at every call site.
 */
function pathId(req: Request): string {
  const raw = req.params.id;
  const id = Array.isArray(raw) ? raw[0] : raw;
  if (!id) throw badRequest("Missing problem id.");
  return id;
}

/** GET /problems/catalogue — the public Intel list. Approved problems only. */
export async function getCatalogue(
  _req: Request,
  res: Response,
): Promise<void> {
  res.send(await listCatalogue());
}

/**
 * POST /problems/check-duplicate — "does this already exist?".
 *
 * Its own endpoint so the submit form can ask WHILE the author is typing,
 * rather than only finding out when they press submit and lose the round trip.
 * Read-only and cheap; it writes nothing.
 */
export async function postDuplicateCheck(
  req: Request,
  res: Response,
): Promise<void> {
  const parsed = DuplicateCheckRequest.safeParse(req.body);
  if (!parsed.success) throw badRequest(firstIssue(parsed.error));

  const report = await findDuplicates(
    parsed.data.title,
    parsed.data.statementMarkdown,
    parsed.data.excludeId,
  );
  res.send({ duplicate: report.duplicate, matches: report.matches });
}

/** GET /problems/mine — this author's submissions and their review state. */
export async function getMyProblems(
  req: Request,
  res: Response,
): Promise<void> {
  const { claims } = req as AuthedRequest;
  res.send({ rows: await listMyProblems(claims.userId) });
}

/** GET /problems/mine/:id — one of the author's own problems, in full. */
export async function getMyProblemDetail(
  req: Request,
  res: Response,
): Promise<void> {
  const { claims } = req as AuthedRequest;
  res.send(await getMyProblem(claims.userId, pathId(req)));
}

/**
 * POST /problems/submit — send a new problem for review.
 *
 * A near-duplicate comes back as 409 POSSIBLE_DUPLICATE carrying the matches,
 * so the client can show them and offer to resubmit with the acknowledgement.
 * The matches ride on the error body rather than a 200, because the submission
 * genuinely did not happen.
 */
export async function postSubmitProblem(
  req: Request,
  res: Response,
): Promise<void> {
  const { claims } = req as AuthedRequest;
  const parsed = CommunityProblemInput.safeParse(req.body);
  if (!parsed.success) throw badRequest(firstIssue(parsed.error));

  try {
    const result = await submitProblem(
      claims.userId,
      parsed.data,
      acknowledged(req),
    );
    res.status(201).send({
      id: result.id,
      status: "PENDING",
      warnings: result.warnings,
    });
  } catch (err) {
    // Re-thrown with the matches attached: the plain conflict from the service
    // says THAT it looks duplicated, this says what it looks like.
    if (isConflict(err, "POSSIBLE_DUPLICATE")) {
      const report = await findDuplicates(
        parsed.data.title,
        parsed.data.statementMarkdown,
      );
      res.status(409).send({
        code: "POSSIBLE_DUPLICATE",
        message: "This looks close to a problem the arena already has.",
        matches: report.matches,
      });
      return;
    }
    throw err;
  }
}

/** PUT /problems/mine/:id — edit a pending or rejected submission. */
export async function putMyProblem(
  req: Request,
  res: Response,
): Promise<void> {
  const { claims } = req as AuthedRequest;
  const id = pathId(req);

  const parsed = CommunityProblemInput.safeParse(req.body);
  if (!parsed.success) throw badRequest(firstIssue(parsed.error));

  try {
    res.send(
      await updateMyProblem(claims.userId, id, parsed.data, acknowledged(req)),
    );
  } catch (err) {
    if (isConflict(err, "POSSIBLE_DUPLICATE")) {
      const report = await findDuplicates(
        parsed.data.title,
        parsed.data.statementMarkdown,
        id,
      );
      res.status(409).send({
        code: "POSSIBLE_DUPLICATE",
        message: "This looks close to a problem the arena already has.",
        matches: report.matches,
      });
      return;
    }
    throw err;
  }
}

/** DELETE /problems/mine/:id — withdraw a submission before it goes live. */
export async function deleteMyProblem(
  req: Request,
  res: Response,
): Promise<void> {
  const { claims } = req as AuthedRequest;
  await withdrawMyProblem(claims.userId, pathId(req));
  res.status(204).end();
}

/** Narrow an unknown throw to one of our conflicts with a given code. */
function isConflict(err: unknown, code: string): boolean {
  return err instanceof HttpError && err.code === code;
}
