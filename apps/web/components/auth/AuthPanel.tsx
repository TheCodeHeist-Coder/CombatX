"use client";

import { useEffect, useRef, useState } from "react";
import {
  AVATAR_COLORS,
  AVATAR_IDS,
  Username,
  type AvatarChoice,
} from "@repo/protocol";
import { checkUsername, login, signup, ApiCallError } from "../../lib/api";
import { saveSession } from "../../lib/session";
import { ErrorBanner, Spinner } from "../atoms";
import { Avatar } from "../avatar/Avatar";
import { AvatarPicker } from "../avatar/AvatarPicker";

type Mode = "signup" | "login";
type Availability = "idle" | "checking" | "free" | "taken";

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
  onReady,
  initialMode = "signup",
}: {
  /**
   * The host page's session refresh. The session lives in localStorage, which
   * no router refresh re-reads, so the page must look again itself.
   */
  onReady: () => void;
  initialMode?: Mode;
}) {
  const [mode, setMode] = useState<Mode>(initialMode);
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
      password.length >= 8 &&
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

  /** Switch tabs without carrying over a stale error from the other form. */
  function switchTo(next: Mode) {
    setMode(next);
    setError(null);
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="flex gap-1.5" role="tablist">
        <Tab active={isSignup} onClick={() => switchTo("signup")}>
          Sign up
        </Tab>
        <Tab active={!isSignup} onClick={() => switchTo("login")}>
          Log in
        </Tab>
      </div>

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

      <Field label="Password" htmlFor="password">
        <input
          id="password"
          className="field"
          type="password"
          placeholder={isSignup ? "At least 8 characters" : "Your password"}
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
          // A failed check must not block signup — the unique index is the
          // real guarantee, so fall back to letting the submit decide.
          if (!controller.signal.aborted) setState("idle");
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
  return undefined;
}

function hintTone(
  value: string,
  valid: boolean,
  availability: Availability,
): "good" | "bad" | "dim" {
  if (!value) return "dim";
  if (!valid || availability === "taken") return "bad";
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

function Tab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className="btn flex-1 py-2 text-[0.8rem]"
      style={{
        background: active ? "var(--color-surface-4)" : "transparent",
        borderColor: active
          ? "var(--color-primary)"
          : "var(--color-line-strong)",
        color: active ? "var(--color-ink)" : "var(--color-ink-dim)",
      }}
    >
      {children}
    </button>
  );
}

/** A random starting character, so nobody has to pick before they can play. */
function randomAvatar(): AvatarChoice {
  const id = AVATAR_IDS[Math.floor(Math.random() * AVATAR_IDS.length)]!;
  const color =
    AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)]!;
  return { avatarId: id, avatarColor: color };
}
