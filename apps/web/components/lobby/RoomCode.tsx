"use client";

import { useState } from "react";

/** The shareable room code with a one-click copy. */
export function RoomCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — the code is visible anyway */
    }
  }

  return (
    <button
      onClick={copy}
      className="group flex items-center gap-3 rounded-[10px] border px-4 py-2.5 transition-colors"
      style={{
        borderColor: "var(--color-line)",
        background: "var(--color-surface-2)",
      }}
      title="Copy room code"
    >
      <div className="flex flex-col items-start">
        <span className="label">Room code</span>
        <span className="font-mono text-lg font-semibold tracking-[0.25em]">
          {code}
        </span>
      </div>
      <span
        className="text-xs transition-colors"
        style={{ color: copied ? "var(--color-good)" : "var(--color-ink-faint)" }}
      >
        {copied ? "Copied ✓" : "Copy"}
      </span>
    </button>
  );
}
