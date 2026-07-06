import type { Request, Response } from "express";
import { CreateBattleRequest, JoinBattleRequest } from "@repo/protocol";
import { badRequest } from "../../http/errors.js";
import type { AuthedRequest } from "../../middleware/auth.js";
import {
  createBattle,
  getBattleResult,
  joinBattle,
} from "./battles.service.js";

/** POST /battles — create a battleground. (Auth required.) */
export async function postBattle(req: Request, res: Response): Promise<void> {
  const { claims } = req as AuthedRequest;
  const parsed = CreateBattleRequest.safeParse(req.body);
  if (!parsed.success) {
    throw badRequest("Invalid battle config");
  }
  const result = await createBattle(claims.userId, parsed.data);
  res.send(result);
}

/** POST /battles/join — join by room code. (Auth required.) */
export async function postJoin(req: Request, res: Response): Promise<void> {
  const parsed = JoinBattleRequest.safeParse(req.body);
  if (!parsed.success) {
    throw badRequest("Invalid room code");
  }
  const result = await joinBattle(parsed.data.roomCode);
  res.send(result);
}

/** GET /battles/:id/result — final result for the results screen. */
export async function getResult(
  req: Request<{ id: string }>,
  res: Response,
): Promise<void> {
  const result = await getBattleResult(req.params.id);
  res.send(result);
}
