"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import { BattleRoom } from "../../../components/BattleRoom.js";
import { Shell, Centered, Spinner } from "../../../components/atoms.js";
import { TopBar } from "../../../components/TopBar.js";
import { useSession } from "../../../lib/useSession.js";

/**
 * The battle route. All it does is gate on a session and mount the room; the
 * room owns the live WebSocket and swaps between lobby / battle / results.
 */
export default function BattlePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { session, loaded } = useSession();
  const router = useRouter();

  if (!loaded) {
    return (
      <Shell>
        <Centered>
          <Spinner />
        </Centered>
      </Shell>
    );
  }

  if (!session) {
    return (
      <Shell>
        <TopBar />
        <Centered>
          <p className="text-lg font-medium">You need a name to join.</p>
          <p className="text-sm" style={{ color: "var(--color-ink-dim)" }}>
            Head back and pick a display name first.
          </p>
          <button
            className="btn btn-primary mt-2"
            onClick={() => router.push("/")}
          >
            Go home
          </button>
        </Centered>
      </Shell>
    );
  }

  return <BattleRoom battleId={id} session={session} />;
}
