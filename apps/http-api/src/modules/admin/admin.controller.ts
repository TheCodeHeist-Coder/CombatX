import type { Request, Response } from "express";
import { AdminLoginRequest, AdminProblemInput } from "@repo/protocol";
import { badRequest } from "../../http/errors.js";
import type { AdminRequest } from "../../middleware/adminAuth.js";
import { approveProblem, rejectProblem } from "./review.service.js";
import { getOverview } from "./admin.stats.js";
import {
  adminLogin,
  createProblem,
  deleteProblem,
  getProblem,
  listBattles,
  listProblems,
  listUsers,
  updateProblem,
} from "./admin.service.js";

function firstIssue(error: { issues: { message: string }[] }): string {
  return error.issues[0]?.message ?? "Invalid input";
}

/** Read a bounded integer query param. */
function intParam(value: unknown, fallback: number, max: number): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.min(Math.floor(n), max);
}

/** POST /admin/login — exchange admin credentials for an admin token. */
export async function postAdminLogin(
  req: Request,
  res: Response,
): Promise<void> {
  const parsed = AdminLoginRequest.safeParse(req.body);
  if (!parsed.success) throw badRequest(firstIssue(parsed.error));
  res.send(await adminLogin(parsed.data));
}

/** GET /admin/overview — dashboard headline numbers. */
export async function getAdminOverview(
  _req: Request,
  res: Response,
): Promise<void> {
  res.send(await getOverview());
}

/** GET /admin/users — paged user table. */
export async function getAdminUsers(
  req: Request,
  res: Response,
): Promise<void> {
  const search = typeof req.query.q === "string" ? req.query.q.trim() : "";
  res.send(
    await listUsers(
      search,
      intParam(req.query.limit, 50, 200),
      intParam(req.query.offset, 0, 1_000_000),
    ),
  );
}

/** GET /admin/battles — paged battle table. */
export async function getAdminBattles(
  req: Request,
  res: Response,
): Promise<void> {
  res.send(
    await listBattles(
      intParam(req.query.limit, 50, 200),
      intParam(req.query.offset, 0, 1_000_000),
    ),
  );
}

/** GET /admin/problems — every problem. */
export async function getAdminProblems(
  req: Request,
  res: Response,
): Promise<void> {
  // An unrecognised ?status is ignored rather than rejected: a stale bookmark
  // should show the whole list, not an error.
  const raw = req.query.status;
  const status =
    raw === "PENDING" || raw === "APPROVED" || raw === "REJECTED" || raw === "DRAFT"
      ? raw
      : undefined;
  res.send(await listProblems(status));
}

/** GET /admin/problems/:id — one problem in full. */
export async function getAdminProblem(
  req: Request<{ id: string }>,
  res: Response,
): Promise<void> {
  res.send(await getProblem(req.params.id));
}

/** POST /admin/problems — create a problem. */
export async function postAdminProblem(
  req: Request,
  res: Response,
): Promise<void> {
  const parsed = AdminProblemInput.safeParse(req.body);
  if (!parsed.success) throw badRequest(firstIssue(parsed.error));
  res.status(201).send(await createProblem(parsed.data));
}

/** PUT /admin/problems/:id — replace a problem. */
export async function putAdminProblem(
  req: Request<{ id: string }>,
  res: Response,
): Promise<void> {
  const parsed = AdminProblemInput.safeParse(req.body);
  if (!parsed.success) throw badRequest(firstIssue(parsed.error));
  res.send(await updateProblem(req.params.id, parsed.data));
}

/** DELETE /admin/problems/:id — remove an unused problem. */
export async function deleteAdminProblem(
  req: Request<{ id: string }>,
  res: Response,
): Promise<void> {
  await deleteProblem(req.params.id);
  res.status(204).end();
}

/**
 * POST /admin/problems/:id/approve — accept a submission and publish it.
 *
 * Typed as AdminRequest because, unlike every other problem handler, this one
 * records WHO decided — `reviewedById` is what makes a review auditable.
 */
export async function postApproveProblem(
  req: Request,
  res: Response,
): Promise<void> {
  const raw = req.params.id;
  const id = Array.isArray(raw) ? raw[0] : raw;
  if (!id) throw badRequest("Missing problem id.");
  const { admin } = req as AdminRequest;
  res.send(await approveProblem(id, admin.userId));
}

/** POST /admin/problems/:id/reject — send it back with a reason. */
export async function postRejectProblem(
  req: Request,
  res: Response,
): Promise<void> {
  const raw = req.params.id;
  const id = Array.isArray(raw) ? raw[0] : raw;
  if (!id) throw badRequest("Missing problem id.");
  const { admin } = req as AdminRequest;
  const note = typeof req.body?.reviewNote === "string" ? req.body.reviewNote : "";
  res.send(await rejectProblem(id, admin.userId, note));
}
