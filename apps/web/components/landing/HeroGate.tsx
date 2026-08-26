"use client";

import { useState } from "react";
import {
  AVATAR_COLORS,
  AVATAR_IDS,
  type AvatarChoice,
} from "@repo/protocol";
import { guestJoin, ApiCallError } from "../../lib/api";
import { saveSession } from "../../lib/session";
import { ErrorBanner, Spinner } from "../atoms";
import { Avatar } from "../avatar/Avatar";

/**
 * What a signed-out visitor sees in the hero.
 *
 * Deliberately just a name and a room code. The credential form lives on
 * /signup, reachable from the nav — putting it here made the card read as
 * paperwork rather than as a way into a battle.
 *
 * Someone holding a room code plays immediately as a guest: the friend who
 * sent the code did not send an invitation to register. Everything else
 * (hosting, rankings, a profile) needs a real account.
 */
export function HeroGate({ onReady }: { onReady: (battleId: string) => void }) {
  const [displayName, setDisplayName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [avatar] = useState<AvatarChoice>(() => randomAvatar());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const name = displayName.trim();
  const code = roomCode.trim().toUpperCase();
  const canJoin = name.length > 0 && code.length >= 4;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canJoin || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await guestJoin({
        roomCode: code,
        displayName: name,
        ...avatar,
      });
      saveSession(res.auth);
      onReady(res.battleId);
    } catch (err) {
      setError(
        err instanceof ApiCallError ? err.message : "Couldn't join that room.",
      );
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="hero-name" className="label">
          Your name
        </label>
        <div className="flex items-center gap-2.5">
          <span
            className="shrink-0 rounded-[8px] p-1"
            style={{
              border: "1px solid var(--color-line-strong)",
              background: "var(--color-surface-3)",
            }}
          >
            <Avatar
              avatarId={avatar.avatarId}
              color={avatar.avatarColor}
              size={34}
              rounded={5}
            />
          </span>
          <input
            id="hero-name"
            className="field"
            placeholder="e.g. shadowbyte"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={20}
            autoComplete="off"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="hero-code" className="label">
          Room code
        </label>
        <input
          id="hero-code"
          className="field text-center text-lg uppercase tracking-[0.3em]"
          placeholder="X99-TA"
          value={roomCode}
          onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
          maxLength={12}
          autoComplete="off"
        />
      </div>

      {error && <ErrorBanner message={error} />}

      <button
        type="submit"
        className="btn btn-primary"
        disabled={!canJoin || busy}
      >
        {busy ? <Spinner /> : "Join battle"}
      </button>
    </form>
  );
}

/** A random starting character, so nobody has to pick before they can play. */
function randomAvatar(): AvatarChoice {
  const id = AVATAR_IDS[Math.floor(Math.random() * AVATAR_IDS.length)]!;
  const color =
    AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)]!;
  return { avatarId: id, avatarColor: color };
}
