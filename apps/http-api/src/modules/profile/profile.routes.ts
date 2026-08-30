import { Router, type Request, type Response } from "express";
import { asyncHandler } from "../../http/asyncHandler.js";
import { requireAuth, type AuthedRequest } from "../../middleware/auth.js";
import { getMe, patchMe } from "./profile.controller.js";
import { getLeaderboard } from "./leaderboard.controller.js";
import { getPublicProfile } from "./publicProfile.controller.js";
import { getMyBattles } from "./history.controller.js";
import { getBadgeShelf, getRatingHistory } from "./ranking.controller.js";

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

// Public profiles. Auth is optional here too — a signed-out visitor can read
// any public profile, and a token only matters for viewing your own while
// private. The controller 404s a private profile rather than 403ing it.
profileRoutes.get("/users/:username", asyncHandler(getPublicProfile));

// The badge shelf and rating graph follow the profile's own visibility rule:
// both controllers 404 a private profile for anyone but its owner.
profileRoutes.get("/users/:username/badges", asyncHandler(getBadgeShelf));
profileRoutes.get(
  "/users/:username/rating-history",
  asyncHandler(getRatingHistory),
);
