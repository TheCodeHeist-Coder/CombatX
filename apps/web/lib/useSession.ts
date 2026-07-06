"use client";

import { useCallback, useEffect, useState } from "react";
import { loadSession, type Session } from "./session";

/**
 * React access to the persisted guest session. Reads localStorage on mount
 * (so SSR renders null, then hydrates), and re-reads on cross-tab changes.
 */
export function useSession(): {
  session: Session | null;
  loaded: boolean;
  refresh: () => void;
} {
  const [session, setSession] = useState<Session | null>(null);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(() => setSession(loadSession()), []);

  useEffect(() => {
    refresh();
    setLoaded(true);
    const onStorage = () => refresh();
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [refresh]);

  return { session, loaded, refresh };
}
