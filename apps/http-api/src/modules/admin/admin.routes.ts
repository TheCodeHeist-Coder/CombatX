import { Router } from "express";
import { asyncHandler } from "../../http/asyncHandler.js";
import { requireAdmin } from "../../middleware/adminAuth.js";
import {
  deleteAdminProblem,
  getAdminBattles,
  getAdminOverview,
  getAdminProblem,
  getAdminProblems,
  getAdminUsers,
  postAdminLogin,
  postAdminProblem,
  putAdminProblem,
} from "./admin.controller.js";

/**
 * Super-admin routes.
 *
 * Login is necessarily public — it is how a token is obtained — and lives on
 * its own router so it is not merely *ordered* before the guard. The guarded
 * router applies requireAdmin with router.use(), so every handler mounted on
 * it is protected by construction: a route added later cannot ship unguarded
 * by forgetting a middleware argument.
 */
const publicAdminRoutes: Router = Router();
publicAdminRoutes.post("/admin/login", asyncHandler(postAdminLogin));

const guardedAdminRoutes: Router = Router();
guardedAdminRoutes.use(requireAdmin);

guardedAdminRoutes.get("/overview", asyncHandler(getAdminOverview));
guardedAdminRoutes.get("/users", asyncHandler(getAdminUsers));
guardedAdminRoutes.get("/battles", asyncHandler(getAdminBattles));

guardedAdminRoutes.get("/problems", asyncHandler(getAdminProblems));
guardedAdminRoutes.post("/problems", asyncHandler(postAdminProblem));
guardedAdminRoutes.get("/problems/:id", asyncHandler(getAdminProblem));
guardedAdminRoutes.put("/problems/:id", asyncHandler(putAdminProblem));
guardedAdminRoutes.delete("/problems/:id", asyncHandler(deleteAdminProblem));

export const adminRoutes: Router = Router();
adminRoutes.use(publicAdminRoutes);
adminRoutes.use("/admin", guardedAdminRoutes);
