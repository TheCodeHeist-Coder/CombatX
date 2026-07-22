"use client";

import { useCallback, useEffect, useState } from "react";
import type { ProfileResponse } from "@repo/protocol";
import { fetchProfile } from "./api";
import type { Session } from "./session";

/**
 * The caller's live progression (XP, streak, W/L).
 *
 * Deliberately NOT stored in the session: progression changes every time a
 * battle finishes, so a cached copy in localStorage would show stale numbers.
 * Call `refresh()` after a battle ends to pull the new totals.
 */
export function useProfile(session: Session | null) {
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!session) {
      setProfile(null);
      return;
    }
    setLoading(true);
    try {
      setProfile(await fetchProfile(session.token));
    } catch {
      // A failed profile fetch is non-fatal — the app works without it, so
      // leave whatever we had rather than blanking the UI.
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { profile, loading, refresh };
}
