import express, { type Express } from "express";
import cors from "cors";
import { env } from "../config/env.js";
import type { RoomRegistry } from "../battle/roomRegistry.js";

/**
 * The minimal HTTP surface for ws-server: a health probe, an internal live-
 * stats endpoint, and CORS. The raw-`ws` WebSocketServer attaches to the same
 * underlying http.Server for upgrades.
 */
export function createHttpApp(registry: RoomRegistry): Express {
  const app = express();
  app.use(cors({ origin: env.corsOrigins, credentials: true }));

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  /**
   * GET /internal/stats — live connection counts for the admin dashboard.
   *
   * Called server-to-server by http-api, never by a browser: it is not behind
   * auth, so ws-server's port must not be publicly reachable in a real
   * deployment. It returns only two integers — no identities, no room codes —
   * so an exposure leaks a load number rather than anything about players.
   */
  app.get("/internal/stats", (_req, res) => {
    res.json(registry.liveStats());
  });

  return app;
}
