"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "../../components/AppShell";
import { ErrorBanner, Spinner } from "../../components/atoms";
import { updateProfile, ApiCallError } from "../../lib/api";
import { useSession } from "../../lib/useSession";
import { useProfile } from "../../lib/useProfile";
import { clearSession, saveSession } from "../../lib/session";

/** Account settings: rename, and clear the local session. */
export default function SettingsPage() {
  const { session, loaded, refresh } = useSession();
  const { profile, refresh: refreshProfile } = useProfile(session);
  const router = useRouter();

  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Seed the field once the profile arrives.
  useEffect(() => {
    if (profile) setName(profile.displayName);
  }, [profile]);

  const trimmed = name.trim();
  const valid = trimmed.length >= 1 && trimmed.length <= 24;
  const changed = !!profile && trimmed !== profile.displayName;

  async function save() {
    if (!session || !valid || !changed || busy) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const res = await updateProfile(session.token, trimmed);
      // The token embeds the display name, so swap the stored session for the
      // freshly-minted one or battles would still show the old name.
      saveSession({
        token: res.token,
        userId: res.profile.userId,
        displayName: res.profile.displayName,
      });
      refresh();
      await refreshProfile();
      setSaved(true);
    } catch (err) {
      setError(
        err instanceof ApiCallError ? err.message : "Could not save changes.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell session={session} profile={profile} rail>
      <div className="mx-auto w-full max-w-2xl px-5 py-8 sm:px-7">
        <p className="eyebrow">Module // settings</p>
        <h1 className="mt-2 font-mono text-2xl font-bold uppercase tracking-tight">
          Settings
        </h1>

        {loaded && !session ? (
          <p
            className="panel mt-6 p-5 font-mono text-[0.8rem]"
            style={{ color: "var(--color-ink-faint)" }}
          >
            Sign in from Mission Control to manage your identity.
          </p>
        ) : (
          <>
            <section className="panel mt-6 p-5">
              <h2 className="font-mono text-sm font-bold uppercase tracking-wide">
                Callsign
              </h2>
              <p
                className="mt-1.5 font-mono text-[0.75rem]"
                style={{ color: "var(--color-ink-faint)" }}
              >
                How opponents see you. Changing it issues a new session token.
              </p>

              <div className="mt-4 flex flex-wrap items-start gap-3">
                <input
                  className="field max-w-xs flex-1"
                  value={name}
                  maxLength={24}
                  onChange={(e) => {
                    setName(e.target.value);
                    setSaved(false);
                  }}
                  onKeyDown={(e) => e.key === "Enter" && save()}
                  disabled={!profile || busy}
                  autoComplete="off"
                />
                <button
                  className="btn btn-primary"
                  onClick={save}
                  disabled={!valid || !changed || busy}
                >
                  {busy ? <Spinner /> : "Save"}
                </button>
              </div>

              {saved && (
                <p
                  className="mt-3 font-mono text-[0.75rem]"
                  style={{ color: "var(--color-good)" }}
                >
                  Callsign updated.
                </p>
              )}
              {error && (
                <div className="mt-3">
                  <ErrorBanner message={error} />
                </div>
              )}
            </section>

            <section className="panel mt-4 p-5">
              <h2 className="font-mono text-sm font-bold uppercase tracking-wide">
                Progression
              </h2>
              <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
                <Stat label="XP" value={profile?.xp} />
                <Stat label="Wins" value={profile?.wins} />
                <Stat label="Losses" value={profile?.losses} />
                <Stat label="Best streak" value={profile?.bestStreak} />
              </div>
            </section>

            <section className="panel mt-4 p-5">
              <h2 className="font-mono text-sm font-bold uppercase tracking-wide">
                Local session
              </h2>
              <p
                className="mt-1.5 font-mono text-[0.75rem]"
                style={{ color: "var(--color-ink-faint)" }}
              >
                Clears the token stored in this browser. Your progression stays
                on the server, but without the token you cannot sign back into
                this identity — guests have no password.
              </p>
              <button
                className="btn btn-ghost mt-4"
                style={{ borderColor: "var(--color-bad)", color: "var(--color-bad)" }}
                onClick={() => {
                  clearSession();
                  refresh();
                  router.push("/");
                }}
              >
                Clear_session
              </button>
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value?: number }) {
  return (
    <div
      className="border-l-2 px-3 py-2"
      style={{
        borderColor: "var(--color-line-strong)",
        background: "var(--color-surface-3)",
      }}
    >
      <p className="label">{label}</p>
      <p className="mt-1 font-mono text-lg font-bold tabular-nums">
        {value ?? "—"}
      </p>
    </div>
  );
}
