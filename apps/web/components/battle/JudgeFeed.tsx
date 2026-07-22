"use client";

import { useEffect, useRef } from "react";
import type { SubmissionResultView } from "@repo/protocol";

/**
 * The JUDGE-WORKER live feed: a terminal-style log of what the judge actually
 * did with your submissions.
 *
 * Every line is derived from real submission state that arrived over the
 * socket — queue, execution, verdict. Nothing is simulated: if the judge has
 * said nothing, the feed is empty.
 */
export function JudgeFeed({
  submissions,
  totalTests,
}: {
  submissions: SubmissionResultView[];
  totalTests: number;
}) {
  const endRef = useRef<HTMLDivElement>(null);
  const lines = buildLines(submissions, totalTests);

  // Keep the newest line in view, the way `tail -f` behaves.
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [lines.length]);

  return (
    <div className="terminal flex min-h-0 flex-col">
      <div className="terminal-bar">
        <span className="label">▣ Judge-worker // protocol_7</span>
        <span
          className="label ml-auto flex items-center gap-1.5"
          style={{ color: "var(--color-accent)" }}
        >
          <span
            className="pulse-soft inline-block h-1.5 w-1.5 rounded-full"
            style={{ background: "var(--color-accent)" }}
          />
          Live_feed
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2.5">
        {lines.length === 0 ? (
          <p style={{ color: "var(--color-ink-ghost)" }}>
            Awaiting first submission…
          </p>
        ) : (
          lines.map((l, i) => (
            <div key={i} className="flex gap-2 whitespace-pre-wrap">
              <span
                className="shrink-0 tabular-nums"
                style={{ color: "var(--color-ink-ghost)" }}
              >
                {l.tag}
              </span>
              <span style={{ color: l.color }}>{l.text}</span>
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>
    </div>
  );
}

interface FeedLine {
  tag: string;
  text: string;
  color: string;
}

/**
 * Turn submission state into log lines.
 *
 * The protocol carries no per-test breakdown to the client (by design — that
 * would leak which hidden tests exist), so the feed reports queue → execute →
 * verdict per submission rather than inventing per-case rows.
 */
function buildLines(
  subs: SubmissionResultView[],
  totalTests: number,
): FeedLine[] {
  const out: FeedLine[] = [];
  const ink = "var(--color-ink-dim)";

  subs.forEach((s, idx) => {
    const n = String(idx + 1).padStart(2, "0");
    const short = s.submissionId.slice(-6);

    out.push({
      tag: `[${n}]`,
      text: `QUEUED submission ${short}`,
      color: ink,
    });

    if (s.status === "QUEUED") return;

    if (s.status === "RUNNING") {
      out.push({ tag: `[${n}]`, text: "EXECUTING in sandbox…", color: ink });
      return;
    }

    if (s.status === "ERROR") {
      out.push({
        tag: `[${n}]`,
        text: `ERROR: ${s.errorMessage ?? "execution failed"}`,
        color: "var(--color-bad)",
      });
      return;
    }

    // COMPLETED
    const total = s.total || totalTests;
    const all = total > 0 && s.passed === total;
    out.push({
      tag: `[${n}]`,
      text: `RESULT ${s.passed}/${total} passed · ${Math.round(s.timeMs)}ms`,
      color: all ? "var(--color-good)" : "var(--color-warn)",
    });
    if (all) {
      out.push({
        tag: `[${n}]`,
        text: "ALL_PASSED — instant win condition met",
        color: "var(--color-good)",
      });
    }
  });

  return out;
}
