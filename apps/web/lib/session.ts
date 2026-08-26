"use client";

import {
  normalizeAvatar,
  type AuthResponse,
  type AvatarColor,
  type AvatarId,
} from "@repo/protocol";

/**
 * The signed-in identity, persisted to localStorage so a refresh keeps you
 * logged in and in the same battle.
 *
 * This mirrors just enough of the profile to render the chrome before GET /me
 * lands. It holds no password — only the bearer token the server issued.
 */
export interface Session {
  token: string;
  userId: string;
  /** Battle-facing handle. */
  username: string;
  /** Real name, shown smaller beneath the username. Optional. */
  name: string | null;
  email: string;
  avatarId: AvatarId;
  avatarColor: AvatarColor;
  /** Uploaded photo; takes precedence over the pixel avatar when set. */
  imageUrl: string | null;
}

const KEY = "combatx.session";

export function loadSession(): Session | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Session>;
    // A session saved by the old guest build has displayName instead of
    // username and no credentials behind it, so it cannot be revived — drop it
    // and make the user sign in properly.
    if (!parsed.token || !parsed.userId || !parsed.username) return null;
    // Sessions saved before avatars existed have no character; seed a stable
    // one from the user id rather than discarding an otherwise valid login.
    const avatar = normalizeAvatar(
      parsed.avatarId,
      parsed.avatarColor,
      parsed.userId,
    );
    return { ...(parsed as Session), ...avatar };
  } catch {
    return null;
  }
}

export function saveSession(auth: AuthResponse): Session {
  const session: Session = {
    token: auth.token,
    userId: auth.userId,
    username: auth.username,
    name: auth.name,
    email: auth.email,
    avatarId: auth.avatarId,
    avatarColor: auth.avatarColor,
    imageUrl: auth.imageUrl,
  };
  window.localStorage.setItem(KEY, JSON.stringify(session));
  return session;
}

export function clearSession(): void {
  window.localStorage.removeItem(KEY);
}
