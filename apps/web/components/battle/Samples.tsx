"use client";

import type { SampleTest } from "@repo/protocol";

/** The visible sample tests. Hidden tests are never sent to the client. */
export function Samples({ tests }: { tests: SampleTest[] }) {
  if (tests.length === 0) return null;
  return (
    <div className="flex flex-col gap-3">
      <span className="label">Examples</span>
      {tests.map((t) => (
        <div
          key={t.ordinal}
          className="grid grid-cols-1 gap-3 rounded-[10px] border p-3 sm:grid-cols-2"
          style={{ borderColor: "var(--color-line)", background: "var(--color-surface-2)" }}
        >
          <IoBlock label="Input" value={t.input} />
          <IoBlock label="Expected output" value={t.expectedOutput} />
        </div>
      ))}
    </div>
  );
}

function IoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs" style={{ color: "var(--color-ink-faint)" }}>
        {label}
      </span>
      <pre
        className="overflow-x-auto rounded-[8px] p-2 font-mono text-[0.82rem]"
        style={{ background: "var(--color-void)", color: "var(--color-ink)" }}
      >
        {value || "(empty)"}
      </pre>
    </div>
  );
}
