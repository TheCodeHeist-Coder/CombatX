import type { Response } from "express";
import { QueueJoinRequest } from "@repo/protocol";
import { badRequest } from "../../http/errors.js";
import type { AuthedRequest } from "../../middleware/auth.js";
import {
  findAssignedBattle,
  joinQueue,
  leaveQueue,
  status,
} from "./matchmaking.service.js";

/** POST /matchmaking/queue — enter the ranked queue. */
export async function postQueueJoin(
  req: AuthedRequest,
  res: Response,
): Promise<void> {
  const parsed = QueueJoinRequest.safeParse(req.body);
  if (!parsed.success) {
    throw badRequest(parsed.error.issues[0]?.message ?? "Invalid request");
  }
  res.json(await joinQueue(req.claims.userId, parsed.data.difficulty));
}

/** DELETE /matchmaking/queue — leave the queue. */
export async function deleteQueue(
  req: AuthedRequest,
  res: Response,
): Promise<void> {
  await leaveQueue(req.claims.userId);
  res.json(await status(req.claims.userId));
}

/**
 * GET /matchmaking/queue — poll for a match.
 *
 * Also reports a battle the caller was already placed into, so a client that
 * reloaded mid-queue finds its match rather than sitting on an empty status.
 */
export async function getQueueStatus(
  req: AuthedRequest,
  res: Response,
): Promise<void> {
  const current = await status(req.claims.userId);
  if (current.matchedBattleId) {
    res.json(current);
    return;
  }

  const assigned = await findAssignedBattle(req.claims.userId);
  if (assigned) {
    res.json({
      ...current,
      queued: false,
      matchedBattleId: assigned.battleId,
      matchedRoomCode: assigned.roomCode,
    });
    return;
  }

  res.json(current);
}
