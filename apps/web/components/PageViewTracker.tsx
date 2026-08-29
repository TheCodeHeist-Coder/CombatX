"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { API_URL } from "../lib/config";

const VISITOR_KEY = "combatx.visitor";

/**
 * A stable per-browser id, generated on first visit.
 *
 * localStorage rather than a cookie: it never rides along on API requests, so
 * it cannot be correlated server-side with anything the visitor does beyond
 * the explicit ping below. Clearing site data resets it, which is the point.
 */
function visitorId(): string | null {
  try {
    const existing = window.localStorage.getItem(VISITOR_KEY);
    if (existing) return existing;
    const id = crypto.randomUUID();
    window.localStorage.setItem(VISITOR_KEY, id);
    return id;
  } catch {
    // Private mode or blocked storage — skip tracking rather than break.
    return null;
  }
}

/**
 * Reports one page view per route change, for the admin dashboard's traffic
 * numbers.
 *
 * Fire-and-forget: `keepalive` lets the request outlive the navigation, and
 * every failure is swallowed. A hit counter must never delay a page or surface
 * an error to a visitor.
 */
export function PageViewTracker() {
  const pathname = usePathname();

  useEffect(() => {
    const id = visitorId();
    if (!id) return;

    void fetch(`${API_URL}/track`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ path: pathname, visitorId: id }),
      keepalive: true,
    }).catch(() => {
      // Deliberately ignored.
    });
  }, [pathname]);

  return null;
}
