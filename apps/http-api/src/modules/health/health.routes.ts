import { Router } from "express";

/** Liveness probe. */
export const healthRoutes: Router = Router();

healthRoutes.get("/health", (_req, res) => {
  res.send({ ok: true });
});
