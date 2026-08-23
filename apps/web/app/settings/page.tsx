"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { AvatarChoice } from "@repo/protocol";
import { AppShell } from "../../components/AppShell";
import { ErrorBanner, Spinner } from "../../components/atoms";
import { Avatar } from "../../components/avatar/Avatar";
import { AvatarPicker } from "../../components/avatar/AvatarPicker";
import { updateProfile, ApiCallError } from "../../lib/api";
import { useSession } from "../../lib/useSession";
import { useProfile } from "../../lib/useProfile";
import { clearSession, saveSession } from "../../lib/session";
import { SignInGate } from "../../components/SignInGate";

/** Account settings: character, callsign, and clearing the local session. */
export default function SettingsPage() {
  const { session, loaded, refresh } = useSession();
  const { profile, refresh: refreshProfile } = useProfile(session);
  const router = useRouter();

  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState<AvatarChoice | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Seed the editable fields once the profile arrives.
  useEffect(() => {
    if (!profile) return;
    setName(profile.displayName);
    setAvatar({
      avatarId: profile.avatarId,
      avatarColor: profile.avatarColor,
    });
  }, [profile]);

  const trimmed = name.trim();
  const nameValid = trimmed.length >= 1 && trimmed.length <= 24;
  const nameChanged = !!profile && trimmed !== profile.displayName;
  const avatarChanged =
    !!profile &&
    !!avatar &&
    (avatar.avatarId !== profile.avatarId ||
      avatar.avatarColor !== profile.avatarColor);
  const dirty = nameChanged || avatarChanged;

  async function save() {
    if (!session || !nameValid || !dirty || busy) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      // Send only what actually changed — PATCH leaves omitted fields alone.
      const res = await updateProfile(session.token, {
        ...(nameChanged ? { displayName: trimmed } : {}),
        ...(avatarChanged && avatar ? avatar : {}),
      });
      // The token embeds the display name, so swap the stored session for the
      // freshly-minted one or battles would still show the old name.
      saveSession({
        token: res.token,
        userId: res.profile.userId,
        displayName: res.profile.displayName,
        avatarId: res.profile.avatarId,
        avatarColor: res.profile.avatarColor,
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
        <p className="eyebrow">Profile</p>
        <h1 className="mt-2 text-2xl font-bold">Settings</h1>

        {loaded && !session ? (
          <SignInGate what="manage your character and callsign" onReady={refresh} />
        ) : (
          <>
            <section className="panel mt-6 p-5">
              <h2 className="text-base font-bold">Your character</h2>
              <p
                className="mt-1.5 font-mono text-[0.75rem]"
                style={{ color: "var(--color-ink-faint)" }}
              >
                Opponents see this in the lobby and beside your code during a
                battle.
              </p>

              {avatar && (
                <>
                  <div className="mt-4 flex items-center gap-4">
                    <Avatar
                      avatarId={avatar.avatarId}
                      color={avatar.avatarColor}
                      size={64}
                      rounded={10}
                    />
                    <div className="min-w-0 flex-1">
                      <label htmlFor="callsign" className="label">
                        Callsign
                      </label>
                      <input
                        id="callsign"
                        className="field mt-1.5"
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
                    </div>
                  </div>

                  <div
                    className="mt-5 rounded-[10px] border p-4"
                    style={{
                      borderColor: "var(--color-line)",
                      background: "var(--color-surface-2)",
                    }}
                  >
                    <AvatarPicker
                      avatarId={avatar.avatarId}
                      color={avatar.avatarColor}
                      onChange={(next) => {
                        setAvatar(next);
                        setSaved(false);
                      }}
                    />
                  </div>
                </>
              )}

              <div className="mt-5 flex items-center gap-3">
                <button
                  className="btn btn-primary"
                  onClick={save}
                  disabled={!nameValid || !dirty || busy}
                >
                  {busy ? <Spinner /> : "Save changes"}
                </button>
                {saved && (
                  <span
                    className="font-mono text-[0.75rem]"
                    style={{ color: "var(--color-good)" }}
                  >
                    Profile updated.
                  </span>
                )}
              </div>

              {error && (
                <div className="mt-3">
                  <ErrorBanner message={error} />
                </div>
              )}
            </section>

            <section className="panel mt-4 p-5">
              <h2 className="text-base font-bold">Progression</h2>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Stat label="XP" value={profile?.xp} />
                <Stat label="Wins" value={profile?.wins} />
                <Stat label="Losses" value={profile?.losses} />
                <Stat label="Best streak" value={profile?.bestStreak} />
              </div>
            </section>

            <section className="panel mt-4 p-5">
              <h2 className="text-base font-bold">Local session</h2>
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
                style={{
                  borderColor: "var(--color-bad)",
                  color: "var(--color-bad)",
                }}
                onClick={() => {
                  clearSession();
                  refresh();
                  router.push("/");
                }}
              >
                Clear session
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
      className="rounded-[8px] border-l-2 px-3 py-2.5"
      style={{
        borderColor: "var(--color-primary)",
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
