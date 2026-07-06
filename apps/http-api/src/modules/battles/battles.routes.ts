import { Router } from "express";
import { asyncHandler } from "../../http/asyncHandler.js";
import { requireAuth } from "../../middleware/auth.js";
import { getResult, postBattle, postJoin } from "./battles.controller.js";

/** Battle lifecycle routes. */
export const battlesRoutes: Router = Router();

// Creating and joining a battle require a guest identity.
battlesRoutes.post("/battles", requireAuth, asyncHandler(postBattle));
battlesRoutes.post("/battles/join", requireAuth, asyncHandler(postJoin));

// Reading a result is public (the results screen is shareable).
battlesRoutes.get("/battles/:id/result", asyncHandler(getResult));
