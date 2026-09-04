import type { Request, Response } from "express";
import {
  AdminSeasonEndInput,
  AdminSeasonStartInput,
} from "@repo/protocol";
import { badRequest } from "../../http/errors.js";
import {
  activeSeason,
  endSeason,
  listSeasons,
  seasonStandings,
  startSeason,
} from "./seasons.service.js";

function firstIssue(error: { issues: { message: string }[] }): string {
  return error.issues[0]?.message ?? "Invalid input";
}

function pathId(req: Request): string {
  const raw = req.params.id;
  const id = Array.isArray(raw) ? raw[0] : raw;
  if (!id) throw badRequest("Missing season id.");
  return id;
}

/** GET /admin/seasons — every season, plus whichever is running. */
export async function getAdminSeasons(
  _req: Request,
  res: Response,
): Promise<void> {
  const [rows, active] = await Promise.all([listSeasons(), activeSeason()]);
  res.send({ rows, active });
}

/** POST /admin/seasons — open a new season. */
export async function postAdminSeason(
  req: Request,
  res: Response,
): Promise<void> {
  const parsed = AdminSeasonStartInput.safeParse(req.body);
  if (!parsed.success) throw badRequest(firstIssue(parsed.error));
  res.status(201).send(await startSeason(parsed.data.name));
}

/**
 * POST /admin/seasons/:id/end — close a season and soften the ladder.
 *
 * Irreversible: it writes a permanent archive and rewrites every rating. The
 * console asks for typed confirmation before calling this.
 */
export async function postAdminSeasonEnd(
  req: Request,
  res: Response,
): Promise<void> {
  const parsed = AdminSeasonEndInput.safeParse(req.body ?? {});
  if (!parsed.success) throw badRequest(firstIssue(parsed.error));
  res.send(await endSeason(pathId(req), parsed.data.nextName));
}

/** GET /admin/seasons/:id/standings — the final table for a closed season. */
export async function getAdminSeasonStandings(
  req: Request,
  res: Response,
): Promise<void> {
  res.send({ rows: await seasonStandings(pathId(req)) });
}
