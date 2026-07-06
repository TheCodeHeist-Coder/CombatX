import express, { type Express } from "express";
import cors from "cors";
import { env } from "../config/env.js";

/**
 * The minimal HTTP surface for ws-server: a health probe and CORS. The raw-`ws`
 * WebSocketServer attaches to the same underlying http.Server for upgrades.
 */
export function createHttpApp(): Express {
  const app = express();
  app.use(cors({ origin: env.corsOrigins, credentials: true }));
  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });
  return app;
}
