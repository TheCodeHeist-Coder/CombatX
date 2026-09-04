"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import {
  HelloAckData,
  parseServerMessage,
  SubmitAckData,
  type ClientMessage,
  type Language,
  type ServerMessage,
  type Side,
} from "@repo/protocol";
import { WS_URL } from "./config";
import {
  initialBattleState,
  reduceBattle,
  type BattleState,
} from "./battleState";

export type ConnStatus =
  | "connecting"
  | "handshaking"
  | "open"
  | "reconnecting"
  | "closed";

/** A pending request awaiting its correlated ack, keyed by reqId. */
interface Pending {
  resolve: (data: unknown) => void;
  reject: (err: Error) => void;
}

export interface BattleConnection {
  state: BattleState;
  status: ConnStatus;
  /** true once the hello handshake has completed at least once. */
  ready: boolean;
  selectSeat: (side: Side, slot: number) => Promise<void>;
  setReady: (ready: boolean) => Promise<void>;
  start: () => Promise<void>;
  submit: (language: Language, source: string) => Promise<string>;
  leave: () => Promise<void>;
  /** Offer, accept or decline a rematch once the battle has finished. */
  rematch: (action: "OFFER" | "ACCEPT" | "DECLINE") => Promise<void>;
}

let reqCounter = 0;
function nextReqId(): string {
  reqCounter += 1;
  return `r${reqCounter}-${Date.now().toString(36)}`;
}

/**
 * Owns a single battle WebSocket: opens it, performs the `hello` handshake,
 * folds server events into `BattleState`, correlates request→ack with reqIds,
 * keeps an app-level heartbeat, and transparently reconnects with backoff.
 *
 * All the screens consume this one hook; they never touch the socket directly.
 */
export function useBattleConnection(
  battleId: string,
  token: string,
): BattleConnection {
  const [state, dispatch] = useReducer(reduceBattle, initialBattleState);
  const [status, setStatus] = useState<ConnStatus>("connecting");
  const [ready, setReadyFlag] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const pendingRef = useRef<Map<string, Pending>>(new Map());
  const closedByUsRef = useRef(false);
  const retryRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /** Send a fire-and-forget frame (no ack expected). */
  const rawSend = useCallback((msg: ClientMessage) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }, []);

  /** Send a request and resolve when its correlated ack arrives (or reject). */
  const requestWithAck = useCallback(
    (build: (reqId: string) => ClientMessage): Promise<unknown> => {
      return new Promise((resolve, reject) => {
        const ws = wsRef.current;
        if (!ws || ws.readyState !== WebSocket.OPEN) {
          reject(new Error("Not connected"));
          return;
        }
        const reqId = nextReqId();
        pendingRef.current.set(reqId, { resolve, reject });
        ws.send(JSON.stringify(build(reqId)));

        // Safety timeout so a lost ack doesn't hang the UI forever.
        setTimeout(() => {
          const p = pendingRef.current.get(reqId);
          if (p) {
            pendingRef.current.delete(reqId);
            p.reject(new Error("Request timed out"));
          }
        }, 10_000);
      });
    },
    [],
  );

  const handleMessage = useCallback(
    (raw: string) => {
      let msg: ServerMessage;
      try {
        msg = parseServerMessage(raw);
      } catch {
        return; // ignore malformed frames
      }

      // Ack correlation first — resolve/reject the matching pending request.
      if (msg.t === "ack" || msg.t === "ack-error") {
        const pending = pendingRef.current.get(msg.reqId);
        if (pending) {
          pendingRef.current.delete(msg.reqId);
          if (msg.t === "ack") pending.resolve(msg.data);
          else pending.reject(new Error(msg.message));
        }
        return;
      }

      // Everything else folds into the local projection.
      dispatch(msg);
    },
    [],
  );

  // ---- socket lifecycle ---------------------------------------------------
  useEffect(() => {
    closedByUsRef.current = false;

    function connect() {
      setStatus(retryRef.current === 0 ? "connecting" : "reconnecting");
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        setStatus("handshaking");
        const reqId = nextReqId();
        pendingRef.current.set(reqId, {
          resolve: (data) => {
            const parsed = HelloAckData.safeParse(data);
            if (parsed.success) {
              // Seed identity + initial snapshot in one synthetic action.
              dispatch({
                t: "@hello",
                userId: parsed.data.userId,
                snapshot: parsed.data.snapshot,
              });
            }
            retryRef.current = 0;
            setReadyFlag(true);
            setStatus("open");
          },
          reject: () => setStatus("closed"),
        });
        ws.send(JSON.stringify({ t: "hello", reqId, token, battleId }));

        // App-level heartbeat (belt-and-suspenders over ws ping frames).
        pingTimerRef.current = setInterval(() => {
          rawSend({ t: "ping", reqId: nextReqId(), clientTime: Date.now() });
        }, 15_000);
      };

      ws.onmessage = (ev) => handleMessage(String(ev.data));

      ws.onclose = () => {
        if (pingTimerRef.current) clearInterval(pingTimerRef.current);
        if (closedByUsRef.current) {
          setStatus("closed");
          return;
        }
        // Exponential backoff, capped.
        const delay = Math.min(1000 * 2 ** retryRef.current, 8000);
        retryRef.current += 1;
        setStatus("reconnecting");
        reconnectTimerRef.current = setTimeout(connect, delay);
      };

      ws.onerror = () => ws.close();
    }

    connect();

    return () => {
      closedByUsRef.current = true;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (pingTimerRef.current) clearInterval(pingTimerRef.current);
      wsRef.current?.close();
    };
  }, [battleId, token, handleMessage, rawSend]);

  // ---- typed actions ------------------------------------------------------
  const selectSeat = useCallback(
    async (side: Side, slot: number) => {
      await requestWithAck((reqId) => ({
        t: "team:select",
        reqId,
        side,
        slot,
      }));
    },
    [requestWithAck],
  );

  const setReady = useCallback(
    async (isReady: boolean) => {
      await requestWithAck((reqId) => ({
        t: "player:ready",
        reqId,
        ready: isReady,
      }));
    },
    [requestWithAck],
  );

  const start = useCallback(async () => {
    await requestWithAck((reqId) => ({ t: "battle:start", reqId }));
  }, [requestWithAck]);

  const submit = useCallback(
    async (language: Language, source: string): Promise<string> => {
      const data = await requestWithAck((reqId) => ({
        t: "code:submit",
        reqId,
        language,
        source,
      }));
      const parsed = SubmitAckData.safeParse(data);
      return parsed.success ? parsed.data.submissionId : "";
    },
    [requestWithAck],
  );

  const leave = useCallback(async () => {
    try {
      await requestWithAck((reqId) => ({ t: "battle:leave", reqId }));
    } catch {
      // best-effort
    }
  }, [requestWithAck]);

  /**
   * Ask for, agree to, or refuse a rematch.
   *
   * The result arrives as a broadcast `battle:rematch-state`, not as this
   * promise's value: every player in the room needs the same view of the
   * negotiation, and one client's ack cannot deliver that.
   */
  const rematch = useCallback(
    async (action: "OFFER" | "ACCEPT" | "DECLINE") => {
      try {
        await requestWithAck((reqId) => ({
          t: "battle:rematch",
          reqId,
          action,
        }));
      } catch {
        // The broadcast is the source of truth; a failed ack just means the
        // button does nothing, which the state already reflects.
      }
    },
    [requestWithAck],
  );

  return {
    state,
    status,
    ready,
    selectSeat,
    setReady,
    start,
    submit,
    leave,
    rematch,
  };
}
