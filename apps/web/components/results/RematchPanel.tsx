"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "../atoms";
import type { BattleConnection } from "../../lib/useBattleConnection";

/**
 * The rematch offer on the results screen.
 *
 * WHY IT IS TWO-SIDED
 * -------------------
 * Clicking "rematch" cannot drag someone into another battle. The offer is
 * broadcast, the other player accepts or declines, and only then does anyone
 * move. That also means the button honestly reports what is happening —
 * "waiting for your opponent" rather than a spinner that might mean anything.
 *
 * WHY IT VANISHES WHEN THE OPPONENT LEAVES
 * ----------------------------------------
 * The negotiation lives in the battle room, which is evicted once everyone
 * disconnects. If the opponent has closed the tab there is nobody to accept,
 * so the panel says so rather than offering a button that can never resolve.
 */
export function RematchPanel({
  conn,
  myUserId,
}: {
  conn: BattleConnection;
  myUserId: string;
}) {
  const router = useRouter();
  const { rematch: state } = conn.state;
  const [busy, setBusy] = useState(false);

  const iOffered = state?.offeredBy.includes(myUserId) ?? false;
  const theyOffered = (state?.offeredBy ?? []).some((id) => id !== myUserId);
  const declined = (state?.declinedBy.length ?? 0) > 0;
  const agreedBattleId = state?.battleId ?? null;

  // Everyone said yes — go. A short delay so the "both agreed" line is
  // actually readable rather than a flash before the route changes.
  useEffect(() => {
    if (!agreedBattleId) return;
    const t = setTimeout(() => router.push(`/battle/${agreedBattleId}`), 700);
    return () => clearTimeout(t);
  }, [agreedBattleId, router]);

  async function act(action: "OFFER" | "ACCEPT" | "DECLINE") {
    setBusy(true);
    try {
      await conn.rematch(action);
    } finally {
      setBusy(false);
    }
  }

  if (agreedBattleId) {
    return (
      <Shell tone="var(--color-good)">
        <span className="flex items-center gap-2">
          <Spinner />
          Both in — starting the rematch…
        </span>
      </Shell>
    );
  }

  if (declined) {
    return (
      <Shell tone="var(--color-ink-faint)">
        Rematch declined. Good fight.
      </Shell>
    );
  }

  // They asked first: this side answers.
  if (theyOffered && !iOffered) {
    return (
      <Shell tone="var(--color-primary)">
        <span className="flex flex-wrap items-center gap-3">
          <strong style={{ color: "var(--color-ink)" }}>
            Your opponent wants a rematch.
          </strong>
          <button
            className="btn btn-primary px-4! py-1.5! text-[0.72rem]!"
            onClick={() => act("ACCEPT")}
            disabled={busy}
          >
            {busy ? <Spinner /> : "Accept"}
          </button>
          <button
            className="btn btn-ghost px-4! py-1.5! text-[0.72rem]!"
            onClick={() => act("DECLINE")}
            disabled={busy}
          >
            Decline
          </button>
        </span>
      </Shell>
    );
  }

  // This side asked and is waiting.
  if (iOffered) {
    return (
      <Shell tone="var(--color-warn)">
        <span className="flex flex-wrap items-center gap-3">
          <span className="flex items-center gap-2">
            <Spinner />
            Waiting for your opponent…
          </span>
          <button
            className="btn btn-ghost px-4! py-1.5! text-[0.72rem]!"
            onClick={() => act("DECLINE")}
            disabled={busy}
          >
            Cancel
          </button>
        </span>
      </Shell>
    );
  }

  return (
    <button
      className="btn btn-accent"
      onClick={() => act("OFFER")}
      disabled={busy}
      title="Play the same opponent again, on a new problem"
    >
      {busy ? <Spinner /> : "⟲ Rematch"}
    </button>
  );
}

/** A tinted strip, so every state of the negotiation occupies the same space. */
function Shell({
  tone,
  children,
}: {
  tone: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="flex items-center rounded-[8px] border px-4 py-2.5 font-mono text-[0.74rem]"
      style={{
        borderColor: tone,
        color: "var(--color-ink-dim)",
        background: `color-mix(in srgb, ${tone} 8%, transparent)`,
      }}
    >
      {children}
    </div>
  );
}
