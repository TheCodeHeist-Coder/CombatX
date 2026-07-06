"use client";

import { useState } from "react";
import { createGuest, ApiCallError } from "../lib/api";
import { saveSession } from "../lib/session";
import { ErrorBanner, Spinner } from "./atoms";

/**
 * The one-field guest sign-in. No accounts, no passwords — pick a name and
 * you're in. On success it persists the session and calls onReady.
 */
export function GuestGate({ onReady }: { onReady: () => void }) {
  const [name, setName] = useState("");
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
      const auth = await createGuest(trimmed);
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
          Choose a display name
        </label>
        <input
          id="name"
          className="field"
          placeholder="e.g. nightowl"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={24}
          autoFocus
          autoComplete="off"
        />
        <p className="text-xs" style={{ color: "var(--color-ink-faint)" }}>
          No account needed — this is how opponents will see you.
        </p>
      </div>

      {error && <ErrorBanner message={error} />}

      <button
        type="submit"
        className="btn btn-primary"
        disabled={!valid || busy}
      >
        {busy ? <Spinner /> : "Enter"}
      </button>
    </form>
  );
}
