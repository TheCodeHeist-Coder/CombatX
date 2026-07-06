import "./loadEnv.js"; // must be first — loads .env before @repo/db reads it
import { createServer } from "node:http";
import express from "express";
import cors from "cors";
import { WebSocketServer, type WebSocket } from "ws";
import { env } from "./env.js";
import { JudgePipeline } from "./judgeQueue.js";
import { RoomRegistry } from "./roomRegistry.js";
import { ConnectionHandler } from "./connectionHandler.js";

// --- HTTP layer (Express): health + the server the WS upgrades attach to -----
const app = express();
app.use(cors({ origin: env.corsOrigins, credentials: true }));
app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

const httpServer = createServer(app);

// --- Judge pipeline + room registry -----------------------------------------
const judge = new JudgePipeline();
const registry = new RoomRegistry(judge);

// Fan judge results from the worker out to the owning room.
await judge.onResult((result) => {
  void registry.routeResult(result.battleId, {
    submissionId: result.submissionId,
    passed: result.passed,
    total: result.total,
    timeMs: result.timeMs,
    allPassed: result.allPassed,
    errorMessage: result.errorMessage,
  });
});

// --- WebSocket layer ---------------------------------------------------------
const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

/** ws-level liveness: sockets that miss a pong between sweeps are terminated. */
const alive = new WeakMap<WebSocket, boolean>();
const handlers = new Set<ConnectionHandler>();

wss.on("connection", (ws) => {
  alive.set(ws, true);
  ws.on("pong", () => alive.set(ws, true));
  const handler = new ConnectionHandler(ws, registry);
  handlers.add(handler);
  ws.on("close", () => handlers.delete(handler));
});

// Transport-level keepalive: ping every heartbeat window, drop the unresponsive.
const pingSweep = setInterval(() => {
  for (const ws of wss.clients) {
    if (alive.get(ws) === false) {
      ws.terminate();
      continue;
    }
    alive.set(ws, false);
    ws.ping();
  }
}, env.heartbeatTimeoutMs);

// App-level idle sweep: drop authed sockets that stopped sending app pings.
const idleSweep = setInterval(() => {
  const now = Date.now();
  for (const h of handlers) {
    if (h.isStale(now)) h.terminate();
  }
}, env.heartbeatTimeoutMs);

// --- Boot --------------------------------------------------------------------
httpServer.listen(env.port, env.host, () => {
  console.log(`ws-server listening on http://${env.host}:${env.port} (ws path /ws)`);
});

// --- Graceful shutdown -------------------------------------------------------
async function shutdown(signal: string): Promise<void> {
  console.log(`\n${signal} received, shutting down ws-server...`);
  clearInterval(pingSweep);
  clearInterval(idleSweep);
  for (const ws of wss.clients) ws.close(1001, "server shutting down");
  wss.close();
  registry.disposeAll();
  await judge.close();
  httpServer.close(() => process.exit(0));
  // Failsafe if connections don't drain.
  setTimeout(() => process.exit(0), 5000).unref();
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
