"use client";

import { Shell, Centered, Spinner } from "./atoms.js";
import { TopBar } from "./TopBar.js";
import { ConnBadge } from "./ConnBadge.js";
import { Lobby } from "./lobby/Lobby.js";
import { Arena } from "./battle/Arena.js";
import { Results } from "./results/Results.js";
import { useBattleConnection } from "../lib/useBattleConnection.js";
import type { Session } from "../lib/session.js";

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
    return <Results conn={conn} session={session} />;
  }

  if (phase === "IN_PROGRESS" || phase === "COUNTDOWN") {
    return <Arena conn={conn} session={session} />;
  }

  // LOBBY (default)
  return <Lobby conn={conn} session={session} />;
}
