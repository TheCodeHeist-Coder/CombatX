import type { WebSocket } from "ws";
import { encode, type ServerMessage } from "@repo/protocol";

/** Send a single server frame to one socket (no-op if it's not open). */
export function send(ws: WebSocket, msg: ServerMessage): void {
  if (ws.readyState !== ws.OPEN) return;
  ws.send(encode(msg));
}

/** Acknowledge a request with optional data payload. */
export function ack(ws: WebSocket, reqId: string, data?: unknown): void {
  send(ws, { t: "ack", reqId, data });
}

/** Reject a request. */
export function ackError(
  ws: WebSocket,
  reqId: string,
  code: string,
  message: string,
): void {
  send(ws, { t: "ack-error", reqId, code, message });
}

/** Emit an out-of-band error not tied to a specific request. */
export function serverError(
  ws: WebSocket,
  code: string,
  message: string,
): void {
  send(ws, { t: "error", code, message });
}
