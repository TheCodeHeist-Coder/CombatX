"use client";

import { useCallback, useEffect, useState } from "react";
import { loadAdminSession, type AdminSession } from "./session";

/** React access to the tab-scoped admin session. */
export function useAdminSession(): {
  session: AdminSession | null;
  loaded: boolean;
  refresh: () => void;
} {
  const [session, setSession] = useState<AdminSession | null>(null);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(() => setSession(loadAdminSession()), []);

  useEffect(() => {
    refresh();
    setLoaded(true);
  }, [refresh]);

  return { session, loaded, refresh };
}
