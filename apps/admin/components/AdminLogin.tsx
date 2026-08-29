"use client";

import { useState } from "react";
import { adminLogin, AdminApiError } from "../lib/api";
import { saveAdminSession } from "../lib/session";
import { ErrorBanner, Spinner } from "./atoms";

/**
 * The console's only unauthenticated screen.
 *
 * Deliberately spare: no product marketing, no "forgot password" (there is no
 * self-service reset for an admin — the seed script is the reset path), and no
 * link back to the player site. It says as little as possible about what is
 * behind it.
 */
export function AdminLogin({ onReady }: { onReady: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !email.trim() || !password) return;
    setBusy(true);
    setError(null);
    try {
      saveAdminSession(await adminLogin(email.trim(), password));
      onReady();
    } catch (err) {
      setError(
        err instanceof AdminApiError ? err.message : "Could not sign in.",
      );
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center px-5">
      <form onSubmit={submit} className="panel w-full max-w-sm p-7">
        <div className="flex items-baseline gap-2">
          <span
            className="font-mono text-[1.05rem] font-bold tracking-tight"
            style={{ color: "var(--color-primary)" }}
          >
            COMBATX
          </span>
          <span className="label" style={{ letterSpacing: "0.18em" }}>
            Admin
          </span>
        </div>
        <p
          className="mt-2 font-mono text-[0.75rem]"
          style={{ color: "var(--color-ink-faint)" }}
        >
          Operations console. Authorised personnel only.
        </p>

        <div className="mt-6 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="admin-email" className="label">
              Email
            </label>
            <input
              id="admin-email"
              className="field"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="admin-password" className="label">
              Password
            </label>
            <input
              id="admin-password"
              className="field"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>

          {error && <ErrorBanner message={error} />}

          <button
            type="submit"
            className="btn btn-primary"
            disabled={busy || !email.trim() || !password}
          >
            {busy ? <Spinner /> : "Sign in"}
          </button>
        </div>
      </form>
    </div>
  );
}
