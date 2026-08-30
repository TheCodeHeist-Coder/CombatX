import express, {
  type Express,
  type NextFunction,
  type Request,
  type Response,
} from "express";
import cors from "cors";
import { env } from "./env.js";
import { notFound, sendError } from "./http/errors.js";
import { healthRoutes } from "./modules/health/health.routes.js";
import { authRoutes } from "./modules/auth/auth.routes.js";
import { battlesRoutes } from "./modules/battles/battles.routes.js";
import { profileRoutes } from "./modules/profile/profile.routes.js";
import { matchmakingRoutes } from "./modules/matchmaking/matchmaking.routes.js";
import { adminRoutes } from "./modules/admin/admin.routes.js";
import { trackRoutes } from "./modules/track/track.routes.js";

/**
 * Assemble the Express application: global middleware, feature routers, and the
 * fall-through 404 + central error handler. Kept separate from index.ts so the
 * app can be imported (e.g. for tests) without starting a server.
 */
export function createApp(): Express {
  const app = express();

  app.use(express.json({ limit: "1mb" }));
  app.use(cors({ origin: env.corsOrigins, credentials: true }));

  // Feature routers.
  app.use(healthRoutes);
  app.use(authRoutes);
  app.use(battlesRoutes);
  app.use(profileRoutes);
  app.use(matchmakingRoutes);
  app.use(trackRoutes);
  app.use(adminRoutes);

  // Unmatched routes → uniform 404.
  app.use((_req, res) => {
    sendError(res, notFound("Route not found"));
  });

  // Central error handler (last). Catches anything thrown synchronously in
  // middleware; async controllers already funnel through asyncHandler. Once the
  // response has started, delegate to Express' default handler.
  app.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) {
      next(err);
      return;
    }
    sendError(res, err);
  });

  return app;
}
