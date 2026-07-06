import type { Server } from "node:http";
import { WebSocketServer, type WebSocket } from "ws";
import { env } from "../config/env.js";
import type { RoomRegistry } from "../battle/roomRegistry.js";
import { ConnectionHandler } from "./connectionHandler.js";

/**
 * The WebSocket gateway: accepts upgrades on `/ws`, wraps each socket in a
 * ConnectionHandler, and runs two liveness sweeps —
 *  - transport ping/pong (drops sockets that miss a pong), and
 *  - app-level idle (drops authed sockets that stopped sending app pings).
 */
export class WsGateway {
  private readonly wss: WebSocketServer;
  private readonly alive = new WeakMap<WebSocket, boolean>();
  private readonly handlers = new Set<ConnectionHandler>();
  private pingSweep: NodeJS.Timeout | null = null;
  private idleSweep: NodeJS.Timeout | null = null;

  constructor(httpServer: Server, private readonly registry: RoomRegistry) {
    this.wss = new WebSocketServer({ server: httpServer, path: "/ws" });
  }

  /** Begin accepting connections and running the liveness sweeps. */
  start(): void {
    this.wss.on("connection", (ws) => {
      this.alive.set(ws, true);
      ws.on("pong", () => this.alive.set(ws, true));
      const handler = new ConnectionHandler(ws, this.registry);
      this.handlers.add(handler);
      ws.on("close", () => this.handlers.delete(handler));
    });

    this.pingSweep = setInterval(() => {
      for (const ws of this.wss.clients) {
        if (this.alive.get(ws) === false) {
          ws.terminate();
          continue;
        }
        this.alive.set(ws, false);
        ws.ping();
      }
    }, env.heartbeatTimeoutMs);

    this.idleSweep = setInterval(() => {
      const now = Date.now();
      for (const h of this.handlers) {
        if (h.isStale(now)) h.terminate();
      }
    }, env.heartbeatTimeoutMs);
  }

  /** Stop sweeps and close all sockets + the server. */
  close(): void {
    if (this.pingSweep) clearInterval(this.pingSweep);
    if (this.idleSweep) clearInterval(this.idleSweep);
    for (const ws of this.wss.clients) ws.close(1001, "server shutting down");
    this.wss.close();
  }
}
