import { Router, type Request, type Response } from "express";
import { asyncHandler } from "../../http/asyncHandler.js";
import { requireAuth, type AuthedRequest } from "../../middleware/auth.js";
import {
  deleteQueue,
  getQueueStatus,
  postQueueJoin,
} from "./matchmaking.controller.js";

/**
 * Ranked matchmaking. Every route requires auth: the queue pairs accounts, and
 * an anonymous entry would have no rating to pair on.
 */
export const matchmakingRoutes: Router = Router();

const authed =
  (fn: (req: AuthedRequest, res: Response) => Promise<void>) =>
  (req: Request, res: Response) =>
    fn(req as AuthedRequest, res);

matchmakingRoutes.post(
  "/matchmaking/queue",
  requireAuth,
  asyncHandler(authed(postQueueJoin)),
);
matchmakingRoutes.get(
  "/matchmaking/queue",
  requireAuth,
  asyncHandler(authed(getQueueStatus)),
);
matchmakingRoutes.delete(
  "/matchmaking/queue",
  requireAuth,
  asyncHandler(authed(deleteQueue)),
);
