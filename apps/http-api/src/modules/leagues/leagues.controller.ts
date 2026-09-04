import type { Request, Response } from "express";
import {
  CreateFixtureInput,
  CreateLeagueInput,
  CreateTeamInput,
  JoinLeagueInput,
  UpdateLeagueInput,
} from "@repo/protocol";
import type { AuthedRequest } from "../../middleware/auth.js";
import { verifyBearer } from "../../middleware/auth.js";
import { badRequest } from "../../http/errors.js";
import {
  createLeague,
  createTeam,
  deleteLeague,
  findLeagueByCode,
  getLeague,
  joinTeam,
  leaveTeam,
  listLeagues,
  updateLeague,
} from "./leagues.service.js";
import {
  cancelFixture,
  createFixture,
  listProblemOptions,
  startLeg,
} from "./fixtures.service.js";

function firstIssue(error: { issues: { message: string }[] }): string {
  return error.issues[0]?.message ?? "Invalid input";
}

/**
 * Read a route param as a plain string.
 *
 * Express types a param as `string | string[]` because a pattern CAN repeat
 * one. Ours cannot, so this narrows in one place rather than casting at each
 * call site. Mirrors the helper in the problems controller.
 */
function param(req: Request, name: string): string {
  const raw = req.params[name];
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) throw badRequest(`Missing ${name}.`);
  return value;
}

/**
 * The caller's id when they happen to be signed in, or null.
 *
 * The leagues list and a public league's page are readable signed-out, but
 * read DIFFERENTLY when signed in — "my leagues" and the join code depend on
 * who is asking. So these routes take an optional identity rather than being
 * split into public and private variants of the same page.
 */
async function optionalUserId(req: Request): Promise<string | null> {
  const claims = await verifyBearer(req.headers.authorization);
  return claims?.userId ?? null;
}

/* --- leagues -------------------------------------------------------------- */

/** GET /leagues — public leagues, plus the caller's own when signed in. */
export async function getLeagues(req: Request, res: Response): Promise<void> {
  res.send(await listLeagues(await optionalUserId(req)));
}

/** GET /leagues/:id — one league's dashboard. */
export async function getLeagueDetail(
  req: Request,
  res: Response,
): Promise<void> {
  res.send(await getLeague(await optionalUserId(req), param(req, "id")));
}

/** POST /leagues/lookup — resolve a join code to a league. */
export async function postLeagueLookup(
  req: Request,
  res: Response,
): Promise<void> {
  const parsed = JoinLeagueInput.safeParse(req.body);
  if (!parsed.success) throw badRequest(firstIssue(parsed.error));
  res.send(
    await findLeagueByCode(await optionalUserId(req), parsed.data.joinCode),
  );
}

/** POST /leagues — create one. */
export async function postLeague(req: Request, res: Response): Promise<void> {
  const { claims } = req as AuthedRequest;
  const parsed = CreateLeagueInput.safeParse(req.body);
  if (!parsed.success) throw badRequest(firstIssue(parsed.error));
  res.status(201).send(await createLeague(claims.userId, parsed.data));
}

/** PUT /leagues/:id — host edits it. */
export async function putLeague(req: Request, res: Response): Promise<void> {
  const { claims } = req as AuthedRequest;
  const parsed = UpdateLeagueInput.safeParse(req.body);
  if (!parsed.success) throw badRequest(firstIssue(parsed.error));
  res.send(await updateLeague(claims.userId, param(req, "id"), parsed.data));
}

/** DELETE /leagues/:id — host deletes it. */
export async function deleteLeagueRoute(
  req: Request,
  res: Response,
): Promise<void> {
  const { claims } = req as AuthedRequest;
  await deleteLeague(claims.userId, param(req, "id"));
  res.status(204).end();
}

/* --- teams ---------------------------------------------------------------- */

/** POST /leagues/:id/teams — found a team and captain it. */
export async function postTeam(req: Request, res: Response): Promise<void> {
  const { claims } = req as AuthedRequest;
  const parsed = CreateTeamInput.safeParse(req.body);
  if (!parsed.success) throw badRequest(firstIssue(parsed.error));
  res
    .status(201)
    .send(await createTeam(claims.userId, param(req, "id"), parsed.data));
}

/** POST /leagues/:id/teams/:teamId/join — join an existing team. */
export async function postTeamJoin(
  req: Request,
  res: Response,
): Promise<void> {
  const { claims } = req as AuthedRequest;
  res.send(
    await joinTeam(claims.userId, param(req, "id"), param(req, "teamId")),
  );
}

/**
 * DELETE /leagues/:id/teams/:teamId/members/:userId — leave, or be removed.
 *
 * One route for both because they are the same operation with a different
 * actor, and the service decides whether this actor is allowed to remove
 * that member.
 */
export async function deleteTeamMember(
  req: Request,
  res: Response,
): Promise<void> {
  const { claims } = req as AuthedRequest;
  await leaveTeam(
    claims.userId,
    param(req, "id"),
    param(req, "teamId"),
    param(req, "userId"),
  );
  res.status(204).end();
}

/* --- fixtures ------------------------------------------------------------- */

/** GET /leagues/problem-options — problems a host may pin. Titles only. */
export async function getProblemOptions(
  _req: Request,
  res: Response,
): Promise<void> {
  res.send({ rows: await listProblemOptions() });
}

/** POST /leagues/:id/fixtures — schedule a tie. */
export async function postFixture(req: Request, res: Response): Promise<void> {
  const { claims } = req as AuthedRequest;
  const parsed = CreateFixtureInput.safeParse(req.body);
  if (!parsed.success) throw badRequest(firstIssue(parsed.error));
  res
    .status(201)
    .send(await createFixture(claims.userId, param(req, "id"), parsed.data));
}

/** DELETE /leagues/:id/fixtures/:fixtureId — call a tie off. */
export async function deleteFixture(
  req: Request,
  res: Response,
): Promise<void> {
  const { claims } = req as AuthedRequest;
  await cancelFixture(claims.userId, param(req, "id"), param(req, "fixtureId"));
  res.status(204).end();
}

/**
 * POST /leagues/:id/fixtures/:fixtureId/legs/:legId/start — kick off a leg.
 *
 * Returns the battle both teams should be sent into. Idempotent: a leg that
 * has already started returns the same battle rather than creating a second.
 */
export async function postLegStart(
  req: Request,
  res: Response,
): Promise<void> {
  const { claims } = req as AuthedRequest;
  res.send(
    await startLeg(
      claims.userId,
      param(req, "id"),
      param(req, "fixtureId"),
      param(req, "legId"),
    ),
  );
}
