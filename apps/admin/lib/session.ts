"use client";

import type { AdminLoginResponse } from "@repo/protocol";

/**
 * The admin session, held in sessionStorage rather than localStorage.
 *
 * sessionStorage is scoped to the tab and cleared when it closes, so an admin
 * token does not sit on disk after the window is gone. The token is short-
 * lived server-side too (8h), so the two limits reinforce each other.
 */
export interface AdminSession {
  token: string;
  userId: string;
  username: string;
  email: string;
}

const KEY = "combatx.admin";

export function loadAdminSession(): AdminSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AdminSession>;
    if (!parsed.token || !parsed.userId) return null;
    return parsed as AdminSession;
  } catch {
    return null;
  }
}

export function saveAdminSession(auth: AdminLoginResponse): AdminSession {
  const session: AdminSession = {
    token: auth.token,
    userId: auth.userId,
    username: auth.username,
    email: auth.email,
  };
  window.sessionStorage.setItem(KEY, JSON.stringify(session));
  return session;
}

export function clearAdminSession(): void {
  window.sessionStorage.removeItem(KEY);
}
