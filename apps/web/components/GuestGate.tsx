"use client";

import { useState } from "react";
import {
  AVATAR_COLORS,
  AVATAR_IDS,
  type AvatarChoice,
} from "@repo/protocol";
import { createGuest, ApiCallError } from "../lib/api";
import { saveSession } from "../lib/session";
import { ErrorBanner, Spinner } from "./atoms";
import { Avatar } from "./avatar/Avatar";
import { AvatarPicker } from "./avatar/AvatarPicker";

/**
 * Guest sign-in: pick a character and a callsign, and you're in. No accounts,
 * no passwords.
 *
 * The picker is collapsed behind the avatar button so the form reads as one
 * short field by default — the same disclosure the reference design uses.
 */
export function GuestGate({ onReady }: { onReady: () => void }) {
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState<AvatarChoice>(() => randomAvatar());
  const [pickerOpen, setPickerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = name.trim();
  const valid = trimmed.length >= 1 && trimmed.length <= 24;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    try {
      const auth = await createGuest(trimmed, avatar);
      saveSession(auth);
      onReady();
    } catch (err) {
      setError(
        err instanceof ApiCallError ? err.message : "Something went wrong.",
      );
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <label htmlFor="name" className="label">
          Avatar and nickname
        </label>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setPickerOpen((v) => !v)}
            aria-expanded={pickerOpen}
            title="Choose your character"
            className="shrink-0 rounded-[8px] p-1 transition-colors"
            style={{
              border: `1px solid ${pickerOpen ? "var(--color-primary)" : "var(--color-line-strong)"}`,
              background: "var(--color-surface-3)",
            }}
          >
            <Avatar
              avatarId={avatar.avatarId}
              color={avatar.avatarColor}
              size={34}
              rounded={5}
            />
          </button>

          <input
            id="name"
            className="field"
            placeholder="e.g. Elliot Alderson"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={24}
            autoComplete="off"
          />
        </div>

        {pickerOpen && (
          <div
            className="rise mt-1 rounded-[10px] border p-4"
            style={{
              borderColor: "var(--color-line-strong)",
              background: "var(--color-surface-2)",
            }}
          >
            <AvatarPicker
              avatarId={avatar.avatarId}
              color={avatar.avatarColor}
              onChange={setAvatar}
              onShuffle={() => setAvatar(randomAvatar())}
            />
          </div>
        )}

        <p
          className="font-mono text-[0.68rem]"
          style={{ color: "var(--color-ink-faint)" }}
        >
          No account needed — this is how opponents will see you.
        </p>
      </div>

      {error && <ErrorBanner message={error} />}

      <button type="submit" className="btn btn-primary" disabled={!valid || busy}>
        {busy ? <Spinner /> : "Enter the arena"}
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
