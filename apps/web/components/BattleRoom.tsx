"use client";

import { useEffect, useState } from "react";
import { Shell, Centered, Spinner } from "./atoms";
import { TopBar } from "./TopBar";
import { ConnBadge } from "./ConnBadge";
import { Lobby } from "./lobby/Lobby";
import { Arena } from "./battle/Arena";
import { Results } from "./results/Results";
import { useBattleConnection } from "../lib/useBattleConnection";
import { getBattleResult } from "../lib/api";
import type { Session } from "../lib/session";

/**
 * Owns the live connection for one battle and renders the phase that matches
 * the server's authoritative status: lobby → arena → results. A single socket
 * spans all three, so state never flickers on transitions.
 */
export function BattleRoom({
  battleId,
  session,
}: {
  battleId: string;
  session: Session;
}) {
  const conn = useBattleConnection(battleId, session.token);
  const { state, status, ready } = conn;
  const snap = state.snapshot;

  /*
   * Is this battle already over?
   *
   * The ws-server refuses to serve a FINISHED battle — its room is evicted
   * the moment everyone leaves — so a socket opened against one can never
   * attach, and this page sat on "Reconnecting…" indefinitely. Anyone
   * reloading the debrief, or opening a shared result link, hit that.
   *
   * So we ask the REST result instead. It is the durable record and answers
   * for a finished battle whether or not a room still exists.
   */
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    // Only worth asking while the socket has not produced a snapshot: once it
    // has, the snapshot is authoritative and this would be a wasted request.
    if (snap) return;
    let alive = true;
    getBattleResult(battleId)
      .then((r) => {
        // A result with a reason means the battle genuinely finished, rather
        // than the endpoint answering for one that never started.
        if (alive && r.reason !== null) setFinished(true);
      })
      .catch(() => {
        /* not finished, or not readable — fall through to the socket. */
      });
    return () => {
      alive = false;
    };
  }, [battleId, snap]);

  if (finished && !snap) {
    return <Results conn={conn} session={session} battleId={battleId} />;
  }

  // Before the first snapshot lands, show a minimal connecting state.
  if (!ready || !snap) {
    return (
      <Shell>
        <TopBar session={session} right={<ConnBadge status={status} />} />
        <Centered>
          <Spinner />
          <p className="text-sm" style={{ color: "var(--color-ink-dim)" }}>
            {status === "reconnecting"
              ? "Reconnecting…"
              : "Joining the room…"}
          </p>
        </Centered>
      </Shell>
    );
  }

  const phase = snap.status;

  if (phase === "FINISHED" || phase === "ABANDONED") {
    return <Results conn={conn} session={session} battleId={battleId} />;
  }

  if (phase === "IN_PROGRESS" || phase === "COUNTDOWN") {
    return <Arena conn={conn} session={session} />;
  }

  // LOBBY (default)
  return <Lobby conn={conn} session={session} />;
}
