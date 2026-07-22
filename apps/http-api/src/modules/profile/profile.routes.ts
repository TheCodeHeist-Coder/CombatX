import { Router, type Request, type Response } from "express";
import { asyncHandler } from "../../http/asyncHandler.js";
import { requireAuth, type AuthedRequest } from "../../middleware/auth.js";
import { getMe } from "./profile.controller.js";

/** Profile + progression routes. */
export const profileRoutes: Router = Router();

profileRoutes.get(
  "/me",
  requireAuth,
  asyncHandler((req: Request, res: Response) =>
    getMe(req as AuthedRequest, res),
  ),
);
