"use client";

import type { GuestAuthResponse } from "@repo/protocol";

/**
 * The signed-in guest identity, persisted to localStorage so a refresh keeps
 * you in the same battle. There are no passwords — a guest is just a JWT + name.
 */
export interface Session {
  token: string;
  userId: string;
  displayName: string;
}

const KEY = "combatx.session";

export function loadSession(): Session | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Session>;
    if (!parsed.token || !parsed.userId || !parsed.displayName) return null;
    return parsed as Session;
  } catch {
    return null;
  }
}

export function saveSession(auth: GuestAuthResponse): Session {
  const session: Session = {
    token: auth.token,
    userId: auth.userId,
    displayName: auth.displayName,
  };
  window.localStorage.setItem(KEY, JSON.stringify(session));
  return session;
}

export function clearSession(): void {
  window.localStorage.removeItem(KEY);
}
