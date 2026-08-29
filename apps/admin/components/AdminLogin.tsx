"use client";

import { useState } from "react";
import { adminLogin, AdminApiError } from "../lib/api";
import { saveAdminSession } from "../lib/session";
import { AdminArtwork } from "./AdminArtwork";
import { ErrorBanner, Spinner } from "./atoms";
import { Wordmark } from "./AdminShell";

/**
 * The console's only unauthenticated screen.
 *
 * A 50/50 split above lg: artwork left, form right — the same shape as the
 * player app's sign-in, and wearing the same orange and display faces via
 * `.auth-theme`. This is the door to CombatX, so it should look like CombatX;
 * everything past it is cyan so nobody confuses the console for the site.
 *
 * Below lg the artwork column drops away entirely rather than stacking above
 * the form. On a phone it would push the fields below the fold, which is the
 * one thing a sign-in screen must never do.
 *
 * Deliberately spare on content: no marketing, no "forgot password" (there is
 * no self-service reset for an admin — the seed script is the reset path), and
 * no link back to the player site.
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
    <div className="auth-theme grid min-h-dvh lg:grid-cols-2">
      {/* Left: the artwork. Hidden below lg — see the component note. */}
      <div
        className="hidden border-r lg:block"
        style={{ borderColor: "var(--color-line)" }}
      >
        <AdminArtwork />
      </div>

      {/* Right: the form, centred in its half. */}
      <div className="flex items-center justify-center px-5 py-12 sm:px-8">
        <form onSubmit={submit} className="rise w-full max-w-sm">
          <Wordmark />

          <h1 className="wordmark grad-text mt-5 text-[clamp(1.9rem,4vw,2.6rem)] leading-none">
            Operations console
          </h1>
          <p
            className="mt-3.5 font-mono text-[0.78rem] leading-relaxed"
            style={{ color: "var(--color-ink-faint)" }}
          >
            Authorised personnel only. Every action here is taken against live
            player data.
          </p>

          <div className="mt-7 flex flex-col gap-4">
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
                placeholder="admin@example.com"
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
                placeholder="••••••••••••"
                required
              />
            </div>

            {error && <ErrorBanner message={error} />}

            <button
              type="submit"
              className="btn btn-primary mt-1 w-full py-3!"
              disabled={busy || !email.trim() || !password}
            >
              {busy ? <Spinner /> : "Sign in"}
            </button>
          </div>

          <p
            className="mt-7 font-mono text-[0.68rem] leading-relaxed"
            style={{ color: "var(--color-ink-ghost)" }}
          >
            Sessions last 8 hours and end when this tab closes.
          </p>
        </form>
      </div>
    </div>
  );
}
