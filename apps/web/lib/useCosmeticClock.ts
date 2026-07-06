"use client";

import { useEffect, useState } from "react";

/**
 * A smooth, once-per-second cosmetic countdown to an authoritative server
 * deadline. `endAtMs` is server-epoch; `skewMs` is (clientClock - serverClock)
 * so we render against the server's clock, not the browser's. The server's
 * `timer:tick` re-seeds both, so drift never accumulates.
 *
 * Returns remaining milliseconds, clamped at zero.
 */
export function useCosmeticClock(
  endAtMs: number | null,
  skewMs: number,
): number {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (endAtMs == null) {
      setRemaining(0);
      return;
    }
    const compute = () => {
      const serverNow = Date.now() - skewMs;
      setRemaining(Math.max(0, endAtMs - serverNow));
    };
    compute();
    const id = setInterval(compute, 250);
    return () => clearInterval(id);
  }, [endAtMs, skewMs]);

  return remaining;
}
