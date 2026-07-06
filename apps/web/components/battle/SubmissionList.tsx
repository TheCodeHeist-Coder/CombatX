"use client";

import type { SubmissionResultView } from "@repo/protocol";

/** Your own submission history for this battle, newest first. */
export function SubmissionList({
  submissions,
}: {
  submissions: SubmissionResultView[];
}) {
  if (submissions.length === 0) {
    return (
      <p className="text-sm" style={{ color: "var(--color-ink-faint)" }}>
        No submissions yet. Solve the samples, then submit to run the hidden
        tests.
      </p>
    );
  }

  const ordered = [...submissions].reverse();

  return (
    <div className="flex flex-col gap-2">
      {ordered.map((s, idx) => (
        <SubmissionRow
          key={s.submissionId}
          sub={s}
          attempt={submissions.length - idx}
        />
      ))}
    </div>
  );
}

function SubmissionRow({
  sub,
  attempt,
}: {
  sub: SubmissionResultView;
  attempt: number;
}) {
  const pending = sub.status === "QUEUED" || sub.status === "RUNNING";
  const errored = sub.status === "ERROR";
  const allPassed = !errored && sub.total > 0 && sub.passed === sub.total;

  const color = pending
    ? "var(--color-warn)"
    : errored
      ? "var(--color-bad)"
      : allPassed
        ? "var(--color-good)"
        : "var(--color-ink-dim)";

  return (
    <div
      className="flex items-center justify-between rounded-[9px] border px-3 py-2.5"
      style={{ borderColor: "var(--color-line)", background: "var(--color-surface-2)" }}
    >
      <div className="flex items-center gap-3 min-w-0">
        <span
          className="text-xs font-mono"
          style={{ color: "var(--color-ink-faint)" }}
        >
          #{attempt}
        </span>
        <span className="text-sm font-medium" style={{ color }}>
          {pending
            ? sub.status === "QUEUED"
              ? "Queued…"
              : "Running…"
            : errored
              ? "Error"
              : allPassed
                ? "All tests passed"
                : "Partial"}
        </span>
        {errored && sub.errorMessage && (
          <span
            className="truncate text-xs font-mono"
            style={{ color: "var(--color-ink-faint)" }}
            title={sub.errorMessage}
          >
            {sub.errorMessage}
          </span>
        )}
      </div>
      <span className="font-mono text-sm tabular-nums" style={{ color }}>
        {sub.passed}/{sub.total}
      </span>
    </div>
  );
}
