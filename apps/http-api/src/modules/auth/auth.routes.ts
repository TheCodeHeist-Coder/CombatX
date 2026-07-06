import { Router } from "express";
import { asyncHandler } from "../../http/asyncHandler.js";
import { postGuest } from "./auth.controller.js";

/** Guest authentication routes. */
export const authRoutes: Router = Router();

authRoutes.post("/auth/guest", asyncHandler(postGuest));
