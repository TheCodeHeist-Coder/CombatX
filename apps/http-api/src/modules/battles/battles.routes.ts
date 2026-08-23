import { Router } from "express";
import { asyncHandler } from "../../http/asyncHandler.js";
import { requireAuth } from "../../middleware/auth.js";
import {
  getResult,
  getSolutions,
  postBattle,
  postJoin,
} from "./battles.controller.js";

/** Battle lifecycle routes. */
export const battlesRoutes: Router = Router();

// Creating and joining a battle require a guest identity.
battlesRoutes.post("/battles", requireAuth, asyncHandler(postBattle));
battlesRoutes.post("/battles/join", requireAuth, asyncHandler(postJoin));

// Reading a result is public (the results screen is shareable).
battlesRoutes.get("/battles/:id/result", asyncHandler(getResult));

// Same for the post-match solutions: the service only serves them once the
// battle is FINISHED, so there is nothing left to protect by the time it does.
battlesRoutes.get("/battles/:id/solutions", asyncHandler(getSolutions));
