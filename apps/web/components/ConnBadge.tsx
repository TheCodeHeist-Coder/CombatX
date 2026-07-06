"use client";

import type { ConnStatus } from "../lib/useBattleConnection";

const META: Record<ConnStatus, { label: string; color: string }> = {
  connecting: { label: "Connecting", color: "var(--color-warn)" },
  handshaking: { label: "Connecting", color: "var(--color-warn)" },
  open: { label: "Live", color: "var(--color-good)" },
  reconnecting: { label: "Reconnecting", color: "var(--color-warn)" },
  closed: { label: "Offline", color: "var(--color-bad)" },
};

/** Tiny live-connection indicator for the top bar. */
export function ConnBadge({ status }: { status: ConnStatus }) {
  const m = META[status];
  return (
    <span className="chip">
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          status === "open" ? "" : "pulse-soft"
        }`}
        style={{ background: m.color }}
      />
      {m.label}
    </span>
  );
}
