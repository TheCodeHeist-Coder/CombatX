import { Router, type Request, type Response } from "express";
import { asyncHandler } from "../../http/asyncHandler.js";
import { requireAuth, type AuthedRequest } from "../../middleware/auth.js";
import { getMe, patchMe } from "./profile.controller.js";
import { getLeaderboard } from "./leaderboard.controller.js";
import { getMyBattles } from "./history.controller.js";

/** Profile, progression, history, and leaderboard routes. */
export const profileRoutes: Router = Router();

const authed =
  (fn: (req: AuthedRequest, res: Response) => Promise<void>) =>
  (req: Request, res: Response) =>
    fn(req as AuthedRequest, res);

profileRoutes.get("/me", requireAuth, asyncHandler(authed(getMe)));
profileRoutes.patch("/me", requireAuth, asyncHandler(authed(patchMe)));
profileRoutes.get(
  "/me/battles",
  requireAuth,
  asyncHandler(authed(getMyBattles)),
);

// Public: auth is optional and only used to locate the caller's own row.
profileRoutes.get("/leaderboard", asyncHandler(getLeaderboard));
