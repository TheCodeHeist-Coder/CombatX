import type { WebSocket } from "ws";
import { encode, type ServerMessage } from "@repo/protocol";
import { serverError } from "../transport/send.js";

/**
 * Owns the live sockets for a battle and all outbound framing. Keying by userId
 * (each with a set of sockets) makes the room reconnect-tolerant: a user counts
 * as present while any of their sockets is open.
 *
 * BattleRoom delegates every "tell the room X" to this — keeping socket
 * bookkeeping and JSON framing out of the game-logic class.
 */
export class Broadcaster {
  /** userId -> set of that user's live sockets. */
  private readonly sockets = new Map<string, Set<WebSocket>>();

  /** Register a socket for a user. */
  add(userId: string, ws: WebSocket): void {
    let set = this.sockets.get(userId);
    if (!set) {
      set = new Set();
      this.sockets.set(userId, set);
    }
    set.add(ws);
  }

  /**
   * Remove one socket. Returns true when it was the user's LAST socket (i.e. the
   * user just went fully offline), so the room can update presence/seat state.
   */
  remove(userId: string, ws: WebSocket): boolean {
    const set = this.sockets.get(userId);
    if (!set) return false;
    set.delete(ws);
    if (set.size === 0) {
      this.sockets.delete(userId);
      return true;
    }
    return false;
  }

  /** Is anyone connected to this battle at all? */
  hasConnections(): boolean {
    return this.sockets.size > 0;
  }

  /** Send one server frame to every live socket in the room. */
  broadcast(msg: ServerMessage): void {
    const frame = encode(msg);
    for (const set of this.sockets.values()) {
      for (const ws of set) {
        if (ws.readyState === ws.OPEN) ws.send(frame);
      }
    }
  }

  /** Send an out-of-band error to every live socket. */
  broadcastError(code: string, message: string): void {
    for (const set of this.sockets.values()) {
      for (const ws of set) serverError(ws, code, message);
    }
  }
}
