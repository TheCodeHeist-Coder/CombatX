"use client";

import { useState } from "react";
import { canStart, startBlockedReason, teamSize } from "@repo/game";
import type { LobbyPlayer } from "@repo/game";
import type { Side } from "@repo/protocol";
import { ErrorBanner, Spinner } from "../atoms";
import { AppShell } from "../AppShell";
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
    <AppShell
      session={session}
      rail
      right={
        <div className="flex items-center gap-2.5">
          <span className="chip">Code: {snap.roomCode}</span>
          <ConnBadge status={status} />
        </div>
      }
    >
      <div className="rise mx-auto flex w-full max-w-4xl flex-col gap-5 px-5 py-6 sm:px-7">
        {/* Header row: config + room code */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-mono text-xl font-bold uppercase tracking-tight">
              Mission_lobby
            </h1>
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
          <div className="flex items-center justify-center sm:flex-col sm:px-1">
            <span
              className="hidden w-px flex-1 sm:block"
              style={{
                background:
                  "linear-gradient(180deg, transparent, var(--color-line-strong), transparent)",
              }}
            />
            <span
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full font-mono text-[0.7rem] font-bold tracking-wider sm:my-2"
              style={{
                color: "var(--color-ink-dim)",
                background: "var(--color-surface-3)",
                border: "1px solid var(--color-line-strong)",
                boxShadow: "0 6px 18px -8px rgba(0,0,0,0.9)",
              }}
            >
              VS
            </span>
            <span
              className="hidden w-px flex-1 sm:block"
              style={{
                background:
                  "linear-gradient(180deg, transparent, var(--color-line-strong), transparent)",
              }}
            />
          </div>
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
                Deployment imminent — stand by…
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
                  {me?.ready ? "Stand_down" : "Ready_up"}
                </button>
                <span
                  className="font-mono text-[0.72rem]"
                  style={{ color: "var(--color-ink-faint)" }}
                >
                  {!seated
                    ? "Select a slot to ready up."
                    : blockedReason ?? "All operatives ready."}
                </span>
              </div>

              {me?.isHost && (
                <button
                  className="btn btn-primary"
                  disabled={!startable || busy}
                  onClick={() => withBusy(start)}
                  title={blockedReason ?? undefined}
                >
                  {busy ? <Spinner /> : "Deploy"}
                </button>
              )}
            </>
          )}
        </div>

        {!me?.isHost && !counting && (
          <p
            className="text-center font-mono text-[0.7rem] uppercase tracking-wider"
            style={{ color: "var(--color-ink-faint)" }}
          >
            * All operatives must acknowledge mission protocols before deployment *
          </p>
        )}
      </div>
    </AppShell>
  );
}
