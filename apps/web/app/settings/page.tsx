"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PROFILE_LINKS, Username, type AvatarChoice } from "@repo/protocol";
import { AppShell } from "../../components/AppShell";
import { ErrorBanner, Spinner } from "../../components/atoms";
import { AvatarPicker } from "../../components/avatar/AvatarPicker";
import { UserAvatar } from "../../components/identity/UserIdentity";
import { checkUsername, updateProfile, ApiCallError } from "../../lib/api";
import { fileToAvatarDataUrl, ImageError } from "../../lib/image";
import { useSession } from "../../lib/useSession";
import { useProfile } from "../../lib/useProfile";
import { clearSession, saveSession } from "../../lib/session";
import { SignInGate } from "../../components/SignInGate";

/** Account settings: identity, character, photo, and signing out. */
export default function SettingsPage() {
  const { session, loaded, refresh } = useSession();
  const { profile, refresh: refreshProfile } = useProfile(session);
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState<AvatarChoice | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  // Seeded true to match the column default, so the radio does not flash
  // "Private" on a public account during the moment before /me arrives.
  const [isPublic, setIsPublic] = useState(true);
  const [bio, setBio] = useState("");
  const [website, setWebsite] = useState("");
  // One entry per PROFILE_LINKS row, so adding a site needs no new state.
  const [links, setLinks] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [taken, setTaken] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Seed the editable fields once the profile arrives.
  useEffect(() => {
    if (!profile) return;
    setUsername(profile.username);
    setName(profile.name ?? "");
    setAvatar({
      avatarId: profile.avatarId,
      avatarColor: profile.avatarColor,
    });
    setImageUrl(profile.imageUrl);
    setIsPublic(profile.isPublic);
    setBio(profile.bio ?? "");
    setWebsite(profile.website ?? "");
    setLinks(
      Object.fromEntries(
        PROFILE_LINKS.map((l) => [l.key, profile[l.key] ?? ""]),
      ),
    );
  }, [profile]);

  const usernameChanged = !!profile && username !== profile.username;
  const usernameValid = Username.safeParse(username).success;

  // Only check the server when the handle actually changed — re-checking your
  // own current username would always come back "taken".
  useEffect(() => {
    if (!usernameChanged || !usernameValid) {
      setTaken(false);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      checkUsername(username, controller.signal)
        .then((r) => !controller.signal.aborted && setTaken(!r.available))
        .catch(() => !controller.signal.aborted && setTaken(false));
    }, 400);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [username, usernameChanged, usernameValid]);

  const trimmedName = name.trim();
  const nameChanged = !!profile && trimmedName !== (profile.name ?? "");
  const avatarChanged =
    !!profile &&
    !!avatar &&
    (avatar.avatarId !== profile.avatarId ||
      avatar.avatarColor !== profile.avatarColor);
  const imageChanged = !!profile && imageUrl !== profile.imageUrl;
  const publicChanged = !!profile && isPublic !== profile.isPublic;
  const bioChanged = !!profile && bio.trim() !== (profile.bio ?? "");
  const websiteChanged = !!profile && website.trim() !== (profile.website ?? "");
  const changedLinks = PROFILE_LINKS.filter(
    (l) => !!profile && (links[l.key] ?? "").trim() !== (profile[l.key] ?? ""),
  );
  const dirty =
    usernameChanged ||
    nameChanged ||
    avatarChanged ||
    imageChanged ||
    publicChanged ||
    bioChanged ||
    websiteChanged ||
    changedLinks.length > 0;
  const canSave = dirty && (!usernameChanged || (usernameValid && !taken));

  async function pickPhoto(file: File | undefined) {
    if (!file) return;
    setError(null);
    setSaved(false);
    try {
      setImageUrl(await fileToAvatarDataUrl(file));
    } catch (err) {
      setError(
        err instanceof ImageError ? err.message : "Could not read that image.",
      );
    } finally {
      // Clear the input so re-picking the same file fires change again.
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function save() {
    if (!session || !canSave || busy) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      // Send only what actually changed — PATCH leaves omitted fields alone.
      const res = await updateProfile(session.token, {
        ...(usernameChanged ? { username } : {}),
        ...(nameChanged ? { name: trimmedName } : {}),
        ...(avatarChanged && avatar ? avatar : {}),
        ...(imageChanged ? { imageUrl } : {}),
        ...(publicChanged ? { isPublic } : {}),
        ...(bioChanged ? { bio: bio.trim() || null } : {}),
        ...(websiteChanged ? { website: website.trim() || null } : {}),
        // Blank clears a handle, which is why these send null rather than "".
        ...Object.fromEntries(
          changedLinks.map((l) => [l.key, links[l.key]?.trim() || null]),
        ),
      });
      // The token embeds the username, so swap the stored session for the
      // freshly-minted one or battles would still show the old handle.
      saveSession({
        token: res.token,
        userId: res.profile.userId,
        username: res.profile.username,
        name: res.profile.name,
        isGuest: res.profile.isGuest,
        email: res.profile.email,
        avatarId: res.profile.avatarId,
        avatarColor: res.profile.avatarColor,
        imageUrl: res.profile.imageUrl,
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

  const usernameHint = !usernameChanged
    ? undefined
    : !usernameValid
      ? "3–20 characters. Letters, numbers, _ and - only."
      : taken
        ? "That username is taken."
        : "Available.";

  return (
    <AppShell session={session} profile={profile}>
      <div className="mx-auto w-full max-w-2xl px-5 py-8 sm:px-7">
        <p className="eyebrow">Profile</p>
        <h1 className="mt-2 text-2xl font-bold">Settings</h1>

        {loaded && (!session || session.isGuest) ? (
          <SignInGate what="manage your profile" guest={!!session?.isGuest} />
        ) : (
          <>
            <section className="panel mt-6 p-5">
              <h2 className="text-base font-bold">Your identity</h2>
              <p
                className="mt-1.5 font-mono text-[0.75rem]"
                style={{ color: "var(--color-ink-faint)" }}
              >
                Opponents see your username in the lobby and beside your code
                during a battle. Your name, if you set one, shows beneath it.
              </p>

              <div className="mt-4 flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="username" className="label">
                    Username
                  </label>
                  <input
                    id="username"
                    className="field"
                    value={username}
                    maxLength={20}
                    onChange={(e) => {
                      setUsername(e.target.value);
                      setSaved(false);
                    }}
                    disabled={!profile || busy}
                    autoComplete="off"
                    autoCapitalize="none"
                    spellCheck={false}
                  />
                  {usernameHint && (
                    <p
                      className="font-mono text-[0.68rem]"
                      style={{
                        color:
                          !usernameValid || taken
                            ? "var(--color-bad)"
                            : "var(--color-good)",
                      }}
                    >
                      {usernameHint}
                    </p>
                  )}
                </div>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="name" className="label">
                    Name
                  </label>
                  <input
                    id="name"
                    className="field"
                    placeholder="Optional"
                    value={name}
                    maxLength={60}
                    onChange={(e) => {
                      setName(e.target.value);
                      setSaved(false);
                    }}
                    disabled={!profile || busy}
                    autoComplete="name"
                  />
                  <p
                    className="font-mono text-[0.68rem]"
                    style={{ color: "var(--color-ink-faint)" }}
                  >
                    Leave blank to show only your username.
                  </p>
                </div>

                <div className="flex flex-col gap-1.5">
                  <span className="label">Email</span>
                  <p className="font-mono text-[0.8rem]">
                    {profile?.email ?? "—"}
                  </p>
                  <p
                    className="font-mono text-[0.68rem]"
                    style={{ color: "var(--color-ink-faint)" }}
                  >
                    Used to log in. Changing it is not supported yet.
                  </p>
                </div>
              </div>
            </section>

            <section className="panel mt-4 p-5">
              <h2 className="text-base font-bold">Your look</h2>
              <p
                className="mt-1.5 font-mono text-[0.75rem]"
                style={{ color: "var(--color-ink-faint)" }}
              >
                Upload a photo, or pick one of the characters below. A photo
                takes precedence while you have one.
              </p>

              {avatar && (
                <>
                  <div className="mt-4 flex items-center gap-4">
                    <UserAvatar
                      identity={{
                        username,
                        avatarId: avatar.avatarId,
                        avatarColor: avatar.avatarColor,
                        imageUrl,
                      }}
                      size={64}
                      rounded={10}
                    />
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => fileRef.current?.click()}
                        disabled={busy}
                      >
                        {imageUrl ? "Change photo" : "Upload photo"}
                      </button>
                      {imageUrl && (
                        <button
                          type="button"
                          className="btn btn-ghost"
                          onClick={() => {
                            setImageUrl(null);
                            setSaved(false);
                          }}
                          disabled={busy}
                        >
                          Remove photo
                        </button>
                      )}
                      <input
                        ref={fileRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => pickPhoto(e.target.files?.[0])}
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
                    {imageUrl && (
                      <p
                        className="mb-3 font-mono text-[0.68rem]"
                        style={{ color: "var(--color-ink-faint)" }}
                      >
                        Your photo is shown instead of this character. Remove it
                        to go back to the pixel art.
                      </p>
                    )}
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

            </section>

            <section className="panel mt-4 p-5">
              <h2 className="text-base font-bold">Profile visibility</h2>
              <p
                className="mt-1.5 font-mono text-[0.75rem]"
                style={{ color: "var(--color-ink-faint)" }}
              >
                A public profile can be opened by anyone who clicks your avatar
                or username. A private one is visible only to you.
              </p>

              <div className="mt-4 flex flex-col gap-2">
                <Choice
                  checked={isPublic}
                  onSelect={() => {
                    setIsPublic(true);
                    setSaved(false);
                  }}
                  title="Public"
                  detail="Anyone can open your profile and see your about, links and record."
                />
                <Choice
                  checked={!isPublic}
                  onSelect={() => {
                    setIsPublic(false);
                    setSaved(false);
                  }}
                  title="Private"
                  detail="Only you can open your profile. Your username and character still appear in battles and on the leaderboard."
                />
              </div>

              {profile?.isPublic && (
                <Link
                  href={`/u/${profile.username}`}
                  className="btn btn-ghost mt-4"
                >
                  View my public profile
                </Link>
              )}
            </section>

            <section className="panel mt-4 p-5">
              <h2 className="text-base font-bold">About you</h2>
              <p
                className="mt-1.5 font-mono text-[0.75rem]"
                style={{ color: "var(--color-ink-faint)" }}
              >
                Shown on your profile.{" "}
                {isPublic
                  ? "Your profile is public, so anyone can read this."
                  : "Your profile is private, so only you can see this for now."}
              </p>

              <div className="mt-4 flex flex-col gap-1.5">
                <label htmlFor="bio" className="label">
                  Bio
                </label>
                <textarea
                  id="bio"
                  className="field min-h-24 py-2"
                  placeholder="A few lines about you — what you build, what you are learning."
                  value={bio}
                  maxLength={500}
                  onChange={(e) => {
                    setBio(e.target.value);
                    setSaved(false);
                  }}
                  disabled={!profile || busy}
                />
                <p
                  className="self-end font-mono text-[0.68rem]"
                  style={{ color: "var(--color-ink-faint)" }}
                >
                  {bio.length}/500
                </p>
              </div>

              <h3 className="mt-4 text-[0.9rem] font-bold">Links</h3>
              <p
                className="mt-1 font-mono text-[0.7rem]"
                style={{ color: "var(--color-ink-faint)" }}
              >
                Handles only, not full URLs.
              </p>

              <div className="mt-3 flex flex-col gap-3">
                {PROFILE_LINKS.map((l) => (
                  <div key={l.key} className="flex flex-col gap-1.5">
                    <label htmlFor={l.key} className="label">
                      {l.label}
                    </label>
                    <input
                      id={l.key}
                      className="field"
                      placeholder={l.placeholder}
                      value={links[l.key] ?? ""}
                      maxLength={l.max}
                      onChange={(e) => {
                        setLinks((prev) => ({
                          ...prev,
                          [l.key]: e.target.value,
                        }));
                        setSaved(false);
                      }}
                      disabled={!profile || busy}
                      autoComplete="off"
                      autoCapitalize="none"
                      spellCheck={false}
                    />
                  </div>
                ))}

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="website" className="label">
                    Website
                  </label>
                  <input
                    id="website"
                    className="field"
                    placeholder="https://example.com"
                    value={website}
                    maxLength={200}
                    onChange={(e) => {
                      setWebsite(e.target.value);
                      setSaved(false);
                    }}
                    disabled={!profile || busy}
                    autoComplete="url"
                    spellCheck={false}
                  />
                </div>
              </div>
            </section>

            {/*
              One save bar for every editable section above it. It sticks to
              the bottom because the form is now taller than a viewport — a
              button pinned inside one section would be off-screen while you
              edit another, and the page would look like it had no way to save.
            */}
            <div
              className="sticky bottom-4 z-10 mt-4 flex items-center gap-3 rounded-[10px] border p-3"
              style={{
                borderColor: "var(--color-line-strong)",
                background: "color-mix(in srgb, var(--color-surface-2) 92%, transparent)",
                backdropFilter: "blur(8px)",
              }}
            >
              <button
                className="btn btn-primary"
                onClick={save}
                disabled={!canSave || busy}
              >
                {busy ? <Spinner /> : "Save changes"}
              </button>
              {saved ? (
                <span
                  className="font-mono text-[0.75rem]"
                  style={{ color: "var(--color-good)" }}
                >
                  Profile updated.
                </span>
              ) : dirty ? (
                <span
                  className="font-mono text-[0.75rem]"
                  style={{ color: "var(--color-ink-faint)" }}
                >
                  Unsaved changes.
                </span>
              ) : null}
            </div>

            {error && (
              <div className="mt-3">
                <ErrorBanner message={error} />
              </div>
            )}

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
              <h2 className="text-base font-bold">Sign out</h2>
              <p
                className="mt-1.5 font-mono text-[0.75rem]"
                style={{ color: "var(--color-ink-faint)" }}
              >
                Clears the token stored in this browser. Your account and
                progression stay on the server — log back in with your email and
                password any time.
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
                Sign out
              </button>
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}

/** A radio-style option row for the visibility choice. */
function Choice({
  checked,
  onSelect,
  title,
  detail,
}: {
  checked: boolean;
  onSelect: () => void;
  title: string;
  detail: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      onClick={onSelect}
      className="flex items-start gap-3 rounded-[10px] border p-3 text-left transition-colors"
      style={{
        borderColor: checked
          ? "var(--color-primary)"
          : "var(--color-line-strong)",
        background: checked
          ? "var(--color-surface-3)"
          : "var(--color-surface-2)",
      }}
    >
      <span
        className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border"
        style={{
          borderColor: checked
            ? "var(--color-primary)"
            : "var(--color-line-strong)",
        }}
      >
        {checked && (
          <span
            className="h-2 w-2 rounded-full"
            style={{ background: "var(--color-primary)" }}
          />
        )}
      </span>
      <span className="min-w-0">
        <span className="block text-[0.85rem] font-semibold">{title}</span>
        <span
          className="mt-0.5 block font-mono text-[0.7rem] leading-relaxed"
          style={{ color: "var(--color-ink-faint)" }}
        >
          {detail}
        </span>
      </span>
    </button>
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
