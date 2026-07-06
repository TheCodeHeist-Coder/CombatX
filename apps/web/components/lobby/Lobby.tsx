"use client";

import { useState } from "react";
import { canStart, startBlockedReason, teamSize } from "@repo/game";
import type { LobbyPlayer } from "@repo/game";
import type { Side } from "@repo/protocol";
import { Shell, ErrorBanner, Spinner } from "../atoms";
import { TopBar } from "../TopBar";
import { ConnBadge } from "../ConnBadge";
import { RoomCode } from "./RoomCode";
import { TeamPanel } from "./TeamPanel";
import { selectMe } from "../../lib/battleState";
import { modeLabel, titleCase } from "../../lib/format";
import type { BattleConnection } from "../../lib/useBattleConnection";
import type { Session } from "../../lib/session";

/**
 * The pre-battle room: pick a seat, ready up, and (if host) start once both
 * sides are ready. Start-eligibility mirrors the server's `canStart` exactly,
 * so the button never lies.
 */
export function Lobby({
  conn,
  session,
}: {
  conn: BattleConnection;
  session: Session;
}) {
  const { state, status, selectSeat, setReady, start } = conn;
  const snap = state.snapshot!;
  const me = selectMe(state);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const size = teamSize(snap.config.mode);
  const lobbyPlayers: LobbyPlayer[] = snap.players.map((p) => ({
    userId: p.userId,
    side: p.side,
    slot: p.slot,
    ready: p.ready,
  }));
  const startable = canStart(lobbyPlayers);
  const blockedReason = startBlockedReason(lobbyPlayers);
  const seated = me?.side != null && me?.slot != null;
  const counting = state.countdownMs != null;

  async function withBusy(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed.");
    } finally {
      setBusy(false);
    }
  }

  const takeSeat = (side: Side, slot: number) =>
    withBusy(() => selectSeat(side, slot));

  return (
    <Shell>
      <TopBar session={session} right={<ConnBadge status={status} />} />

      <div className="rise flex flex-1 flex-col gap-6">
        {/* Header row: config + room code */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Lobby</h1>
            <div className="mt-2 flex flex-wrap gap-2">
              <span className="chip">{modeLabel(snap.config.mode)}</span>
              <span className="chip">{titleCase(snap.config.difficulty)}</span>
              <span className="chip">
                {Math.round(snap.config.timeLimitSec / 60)} min
              </span>
            </div>
          </div>
          <RoomCode code={snap.roomCode} />
        </div>

        {/* Teams */}
        <div className="panel flex flex-col gap-6 p-6 sm:flex-row sm:items-stretch">
          <TeamPanel
            side="A"
            players={snap.players}
            teamSize={size}
            myUserId={state.myUserId}
            onTake={(slot) => takeSeat("A", slot)}
            disabled={busy || counting}
          />
          <div
            className="hidden w-px self-stretch sm:block"
            style={{ background: "var(--color-line)" }}
          />
          <div
            className="flex items-center justify-center py-2 text-sm font-semibold sm:px-2"
            style={{ color: "var(--color-ink-faint)" }}
          >
            VS
          </div>
          <div
            className="hidden w-px self-stretch sm:block"
            style={{ background: "var(--color-line)" }}
          />
          <TeamPanel
            side="B"
            players={snap.players}
            teamSize={size}
            myUserId={state.myUserId}
            onTake={(slot) => takeSeat("B", slot)}
            disabled={busy || counting}
          />
        </div>

        {error && <ErrorBanner message={error} />}

        {/* Action bar */}
        <div className="panel flex flex-wrap items-center justify-between gap-4 p-5">
          {counting ? (
            <div className="flex items-center gap-3">
              <Spinner />
              <span className="text-sm font-medium">
                Battle starting — get ready…
              </span>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <button
                  className={`btn ${me?.ready ? "btn-ghost" : "btn-accent"}`}
                  disabled={!seated || busy}
                  onClick={() => withBusy(() => setReady(!me?.ready))}
                >
                  {me?.ready ? "Unready" : "I'm ready"}
                </button>
                <span
                  className="text-sm"
                  style={{ color: "var(--color-ink-faint)" }}
                >
                  {!seated
                    ? "Pick a seat to ready up."
                    : blockedReason ?? "Everyone's ready."}
                </span>
              </div>

              {me?.isHost && (
                <button
                  className="btn btn-primary"
                  disabled={!startable || busy}
                  onClick={() => withBusy(start)}
                  title={blockedReason ?? undefined}
                >
                  {busy ? <Spinner /> : "Start battle"}
                </button>
              )}
            </>
          )}
        </div>

        {!me?.isHost && !counting && (
          <p
            className="text-center text-sm"
            style={{ color: "var(--color-ink-faint)" }}
          >
            Waiting for the host to start.
          </p>
        )}
      </div>
    </Shell>
  );
}
