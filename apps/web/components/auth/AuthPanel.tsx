"use client";

import { useEffect, useRef, useState } from "react";
import {
  AVATAR_COLORS,
  AVATAR_IDS,
  PASSWORD_MIN_LENGTH,
  Username,
  type AvatarChoice,
} from "@repo/protocol";
import { checkUsername, login, signup, ApiCallError } from "../../lib/api";
import { saveSession } from "../../lib/session";
import { ErrorBanner, Spinner } from "../atoms";
import { Avatar } from "../avatar/Avatar";
import { AvatarPicker } from "../avatar/AvatarPicker";

type Mode = "signup" | "login";
type Availability = "idle" | "checking" | "free" | "taken" | "error";

/** How long to wait after the last keystroke before asking if a name is free. */
const CHECK_DEBOUNCE_MS = 400;

/**
 * Sign up or log in. Email and password are the credentials; the username is
 * the battle-facing handle and the (optional) name is for recognition.
 *
 * A character is assigned before the form is even submitted — signup seeds a
 * random one so nobody can land in a battle without an avatar, and the picker
 * is collapsed behind the tile so the form still reads as a short field list.
 */
export function AuthPanel({
  mode,
  onReady,
}: {
  /** Which form this is. The page owns it; there is no in-panel switcher. */
  mode: Mode;
  /**
   * Called once a session exists. The session lives in localStorage, which no
   * router refresh re-reads, so the caller must act on this itself.
   */
  onReady: () => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState<AvatarChoice>(() => randomAvatar());
  const [pickerOpen, setPickerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSignup = mode === "signup";
  const usernameOk = Username.safeParse(username).success;
  const availability = useUsernameAvailability(
    isSignup && usernameOk ? username : "",
  );

  const canSubmit = isSignup
    ? email.trim() !== "" &&
      password.length >= PASSWORD_MIN_LENGTH &&
      usernameOk &&
      availability !== "taken"
    : email.trim() !== "" && password !== "";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || busy) return;
    setBusy(true);
    setError(null);
    try {
      const auth = isSignup
        ? await signup({
            email: email.trim(),
            password,
            username,
            name: name.trim() || undefined,
            ...avatar,
          })
        : await login(email.trim(), password);
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
      <Field label="Email" htmlFor="email">
        <input
          id="email"
          className="field"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
        />
      </Field>

      <Field
        label="Password"
        htmlFor="password"
        // Only once they have started typing: an unmet requirement shown
        // against an empty field reads as an error before any mistake.
        hint={
          isSignup &&
          password.length > 0 &&
          password.length < PASSWORD_MIN_LENGTH
            ? `${PASSWORD_MIN_LENGTH - password.length} more character${
                PASSWORD_MIN_LENGTH - password.length === 1 ? "" : "s"
              } needed`
            : undefined
        }
        hintTone="bad"
      >
        <input
          id="password"
          className="field"
          type="password"
          placeholder={
            isSignup
              ? `At least ${PASSWORD_MIN_LENGTH} characters`
              : "Your password"
          }
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={isSignup ? "new-password" : "current-password"}
          required
        />
      </Field>

      {isSignup && (
        <>
          <Field
            label="Username"
            htmlFor="username"
            hint={usernameHint(username, usernameOk, availability)}
            hintTone={hintTone(username, usernameOk, availability)}
          >
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
                id="username"
                className="field"
                placeholder="e.g. shadowbyte"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                maxLength={20}
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                required
              />
            </div>
          </Field>

          {pickerOpen && (
            <div
              className="rise -mt-1 rounded-[10px] border p-4"
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
              <p
                className="mt-3 font-mono text-[0.68rem]"
                style={{ color: "var(--color-ink-faint)" }}
              >
                You can upload a real photo later from Settings.
              </p>
            </div>
          )}

          <Field label="Name" htmlFor="name" hint="Optional">
            <input
              id="name"
              className="field"
              placeholder="e.g. Rajkumar"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
              autoComplete="name"
            />
          </Field>
        </>
      )}

      {error && <ErrorBanner message={error} />}

      <button
        type="submit"
        className="btn btn-primary"
        disabled={!canSubmit || busy}
      >
        {busy ? <Spinner /> : isSignup ? "Create account" : "Log in"}
      </button>
    </form>
  );
}

/**
 * Ask the server whether a username is free, debounced.
 *
 * Each keystroke aborts the previous request so a slow early response cannot
 * land after a faster later one and report on a name no longer in the box.
 */
function useUsernameAvailability(username: string): Availability {
  const [state, setState] = useState<Availability>("idle");
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    abortRef.current?.abort();
    if (!username) {
      setState("idle");
      return;
    }
    setState("checking");
    const controller = new AbortController();
    abortRef.current = controller;

    const timer = setTimeout(() => {
      checkUsername(username, controller.signal)
        .then((r) => {
          if (!controller.signal.aborted) {
            setState(r.available ? "free" : "taken");
          }
        })
        .catch(() => {
          // A failed check must not BLOCK signup — the unique index is the
          // real guarantee — but it must not be silent either: swallowing it
          // left the form looking merely unresponsive when the API was down.
          if (!controller.signal.aborted) setState("error");
        });
    }, CHECK_DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [username]);

  return state;
}

const USERNAME_RULE = "3–20 characters. Letters, numbers, _ and - only.";

function usernameHint(
  value: string,
  valid: boolean,
  availability: Availability,
): string | undefined {
  if (!value || !valid) return USERNAME_RULE;
  if (availability === "checking") return "Checking…";
  if (availability === "taken") return "That username is taken.";
  if (availability === "free") return "Available.";
  // Deliberately vague: whether the API is down, the database is unreachable,
  // or the query failed is operational detail the person signing up cannot act
  // on and should not be shown.
  if (availability === "error") return "Couldn't check this username.";
  return undefined;
}

function hintTone(
  value: string,
  valid: boolean,
  availability: Availability,
): "good" | "bad" | "dim" {
  if (!value) return "dim";
  if (!valid || availability === "taken" || availability === "error") {
    return "bad";
  }
  if (availability === "free") return "good";
  return "dim";
}

function Field({
  label,
  htmlFor,
  hint,
  hintTone = "dim",
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  hintTone?: "good" | "bad" | "dim";
  children: React.ReactNode;
}) {
  const color =
    hintTone === "good"
      ? "var(--color-good)"
      : hintTone === "bad"
        ? "var(--color-bad)"
        : "var(--color-ink-faint)";
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="label">
        {label}
      </label>
      {children}
      {hint && (
        <p className="font-mono text-[0.68rem]" style={{ color }}>
          {hint}
        </p>
      )}
    </div>
  );
}

/** A random starting character, so nobody has to pick before they can play. */
function randomAvatar(): AvatarChoice {
  const id = AVATAR_IDS[Math.floor(Math.random() * AVATAR_IDS.length)]!;
  const color =
    AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)]!;
  return { avatarId: id, avatarColor: color };
}
