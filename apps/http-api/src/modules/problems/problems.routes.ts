import { Router } from "express";
import { asyncHandler } from "../../http/asyncHandler.js";
import { requireAuth } from "../../middleware/auth.js";
import {
  deleteMyProblem,
  getCatalogue,
  getMyProblemDetail,
  getMyProblems,
  postDuplicateCheck,
  postSubmitProblem,
  putMyProblem,
} from "./problems.controller.js";

/**
 * Community problem routes — the catalogue and player submissions.
 *
 * ROUTE ORDER MATTERS. `/problems/mine` is registered before any `/problems/:id`
 * pattern would be, so the literal path is not swallowed by a parameter. There
 * is deliberately NO public `/problems/:id` returning a statement: the arena's
 * problems stay unreadable outside a battle, and an author reads their own
 * through `/problems/mine/:id`.
 */
export const problemRoutes: Router = Router();

// Public: the catalogue carries no statements or tests, so it needs no auth.
problemRoutes.get("/problems/catalogue", asyncHandler(getCatalogue));

// Authoring. Every one of these requires a real account — the service also
// refuses guests, so the middleware is not the only thing standing in the way.
problemRoutes.post(
  "/problems/check-duplicate",
  requireAuth,
  asyncHandler(postDuplicateCheck),
);
problemRoutes.get("/problems/mine", requireAuth, asyncHandler(getMyProblems));
problemRoutes.get(
  "/problems/mine/:id",
  requireAuth,
  asyncHandler(getMyProblemDetail),
);
problemRoutes.post(
  "/problems/submit",
  requireAuth,
  asyncHandler(postSubmitProblem),
);
problemRoutes.put(
  "/problems/mine/:id",
  requireAuth,
  asyncHandler(putMyProblem),
);
problemRoutes.delete(
  "/problems/mine/:id",
  requireAuth,
  asyncHandler(deleteMyProblem),
);
