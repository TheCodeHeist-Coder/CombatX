"use client";

import { useEffect, useState } from "react";

/**
 * Full-screen countdown shown between "start" and the problem reveal. Counts
 * down locally from the server-provided `startsInMs`; the actual reveal is
 * driven by the server's battle:start event, so this is purely cosmetic.
 */
export function CountdownOverlay({ startsInMs }: { startsInMs: number }) {
  const [n, setN] = useState(Math.max(1, Math.ceil(startsInMs / 1000)));

  useEffect(() => {
    setN(Math.max(1, Math.ceil(startsInMs / 1000)));
    const id = setInterval(() => {
      setN((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [startsInMs]);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4"
      style={{ background: "color-mix(in srgb, var(--color-void) 82%, transparent)" }}
    >
      <p className="label">Battle begins in</p>
      <div
        key={n}
        className="text-8xl font-semibold tabular-nums"
        style={{ color: "var(--color-accent)", animation: "rise 0.4s ease both" }}
      >
        {n > 0 ? n : "Go"}
      </div>
      <p className="text-sm" style={{ color: "var(--color-ink-dim)" }}>
        Same problem for both sides. First to pass every test wins.
      </p>
    </div>
  );
}
