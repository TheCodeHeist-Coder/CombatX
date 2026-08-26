import { Router } from "express";
import { asyncHandler } from "../../http/asyncHandler.js";
import {
  getUsernameAvailable,
  postLogin,
  postSignup,
} from "./auth.controller.js";

/** Account authentication routes. All public — they are how you get a token. */
export const authRoutes: Router = Router();

authRoutes.post("/auth/signup", asyncHandler(postSignup));
authRoutes.post("/auth/login", asyncHandler(postLogin));
authRoutes.get("/auth/available", asyncHandler(getUsernameAvailable));
