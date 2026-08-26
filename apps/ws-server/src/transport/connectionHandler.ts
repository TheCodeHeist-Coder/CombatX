import type { WebSocket } from "ws";
import { verifySessionToken } from "@repo/auth";
import {
  normalizeAvatar,
  parseClientMessage,
  type ClientMessage,
} from "@repo/protocol";
import { prisma } from "@repo/db";
import { env } from "../config/env.js";
import type { RoomRegistry } from "../battle/roomRegistry.js";
import type { BattleRoom } from "../battle/battleRoom.js";
import type { Connection } from "../types.js";
import { ack, ackError, send, serverError } from "./send.js";

/**
 * Per-socket state machine. A socket must complete `hello` before any other
 * message is honored; after that we route messages to its BattleRoom.
 */
export class ConnectionHandler {
  private conn: Connection | null = null;
  private room: BattleRoom | null = null;

  constructor(
    private readonly ws: WebSocket,
    private readonly registry: RoomRegistry,
  ) {
    ws.on("message", (data) => void this.onMessage(data.toString()));
    ws.on("close", () => this.onClose());
    ws.on("error", () => this.onClose());
  }

  private async onMessage(raw: string): Promise<void> {
    let msg: ClientMessage;
    try {
      msg = parseClientMessage(raw);
    } catch {
      serverError(this.ws, "BAD_FRAME", "Malformed message.");
      return;
    }

    // The hello handshake must come first.
    if (msg.t === "hello") {
      await this.handleHello(msg);
      return;
    }
    if (!this.conn || !this.room) {
      // Every non-hello client message carries a reqId, so we can ack-error it.
      ackError(this.ws, msg.reqId, "NOT_READY", "Send hello first.");
      return;
    }
    this.conn.lastSeen = Date.now();

    switch (msg.t) {
      case "team:select":
        return this.reply(msg.reqId, this.room.selectSeat(this.conn.userId, msg.side, msg.slot));
      case "player:ready":
        return this.reply(msg.reqId, this.room.setReady(this.conn.userId, msg.ready));
      case "battle:start": {
        const err = await this.room.start(this.conn.userId);
        return this.reply(msg.reqId, err);
      }
      case "code:submit": {
        const res = await this.room.submit(this.conn.userId, msg.language, msg.source);
        if ("error" in res) {
          ackError(this.ws, msg.reqId, "SUBMIT_REJECTED", res.error);
        } else {
          ack(this.ws, msg.reqId, { submissionId: res.submissionId });
        }
        return;
      }
      case "battle:leave":
        ack(this.ws, msg.reqId);
        this.onClose();
        return;
      case "ping":
        send(this.ws, {
          t: "pong",
          reqId: msg.reqId,
          clientTime: msg.clientTime,
          serverTime: Date.now(),
        });
        return;
    }
  }

  private async handleHello(
    msg: Extract<ClientMessage, { t: "hello" }>,
  ): Promise<void> {
    if (this.conn) {
      ackError(this.ws, msg.reqId, "ALREADY_HELLO", "Already authenticated.");
      return;
    }

    let claims;
    try {
      claims = await verifySessionToken(msg.token, env.jwtSecret);
    } catch {
      ackError(this.ws, msg.reqId, "UNAUTHORIZED", "Invalid or expired token.");
      this.ws.close();
      return;
    }

    const room = await this.registry.get(msg.battleId);
    if (!room) {
      ackError(this.ws, msg.reqId, "NOT_FOUND", "Battle not found or ended.");
      this.ws.close();
      return;
    }

    // Name, avatar and photo are not in the token, so read the current values.
    // A failed or missing row is not fatal — normalizeAvatar seeds a stable
    // stand-in and the rest fall back to null.
    const user = await prisma.user.findUnique({
      where: { id: claims.userId },
      select: {
        name: true,
        avatarId: true,
        avatarColor: true,
        imageUrl: true,
      },
    });
    const avatar = normalizeAvatar(
      user?.avatarId,
      user?.avatarColor,
      claims.userId,
    );

    this.conn = {
      ws: this.ws,
      userId: claims.userId,
      username: claims.username,
      name: user?.name ?? null,
      avatarId: avatar.avatarId,
      avatarColor: avatar.avatarColor,
      imageUrl: user?.imageUrl ?? null,
      battleId: msg.battleId,
      lastSeen: Date.now(),
      authed: true,
    };
    this.room = room;
    room.attach(this.conn);

    // hello-ack carries the caller's identity + full rehydration snapshot.
    ack(this.ws, msg.reqId, {
      userId: claims.userId,
      snapshot: room.snapshotFor(claims.userId),
    });
  }

  /** Ack (null err) or ack-error (message) — the common lobby-action pattern. */
  private reply(reqId: string, err: string | null): void {
    if (err) ackError(this.ws, reqId, "REJECTED", err);
    else ack(this.ws, reqId);
  }

  private onClose(): void {
    if (this.conn && this.room) {
      this.room.detach(this.conn.userId, this.ws);
    }
    this.conn = null;
    this.room = null;
    if (this.ws.readyState === this.ws.OPEN) this.ws.close();
  }

  /** Idle check used by the server-wide heartbeat sweep. */
  isStale(nowMs: number): boolean {
    if (!this.conn) return false; // pre-hello sockets are swept by ws ping/pong
    return nowMs - this.conn.lastSeen > env.heartbeatTimeoutMs;
  }

  terminate(): void {
    this.onClose();
    this.ws.terminate();
  }
}
