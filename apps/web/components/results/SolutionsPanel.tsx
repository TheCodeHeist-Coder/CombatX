"use client";

import { useEffect, useState } from "react";
import type { SolutionEntry, Side } from "@repo/protocol";
import { getBattleSolutions, ApiCallError } from "../../lib/api";
import { languageLabel } from "../../lib/format";
import { UserAvatar } from "../identity/UserIdentity";
import { Spinner } from "../atoms";

/**
 * The post-battle solution reveal.
 *
 * Source code is withheld for the whole match — the arena only ever shows an
 * opponent's pass-count — and becomes readable here, once the battle is over.
 * That is the point of the debrief: seeing how the other side actually solved
 * it is the part you learn from, and by now the code is worthless to copy.
 *
 * The server enforces this, not the client: /solutions answers 409 until the
 * battle is FINISHED.
 */
export function SolutionsPanel({
  battleId,
  myUserId,
  mySide,
}: {
  battleId: string;
  myUserId: string;
  mySide: Side | null;
}) {
  const [entries, setEntries] = useState<SolutionEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getBattleSolutions(battleId)
      .then((r) => {
        if (!active) return;
        setEntries(r.entries);
        // Open the opponent's solution first — it's the one you came to read.
        const opponent = r.entries.find((e) => e.userId !== myUserId);
        setOpenId((opponent ?? r.entries[0])?.submissionId ?? null);
      })
      .catch((err) => {
        if (!active) return;
        setError(
          err instanceof ApiCallError
            ? err.message
            : "Could not load solutions.",
        );
      });
    return () => {
      active = false;
    };
  }, [battleId, myUserId]);

  if (error) {
    return (
      <section className="panel p-5">
        <h2 className="label">Solutions</h2>
        <p
          className="mt-2 font-mono text-[0.78rem]"
          style={{ color: "var(--color-ink-faint)" }}
        >
          {error}
        </p>
      </section>
    );
  }

  if (!entries) {
    return (
      <section className="panel flex items-center justify-center p-8">
        <Spinner />
      </section>
    );
  }

  if (entries.length === 0) {
    return (
      <section className="panel p-5">
        <h2 className="label">Solutions</h2>
        <p
          className="mt-2 font-mono text-[0.78rem]"
          style={{ color: "var(--color-ink-faint)" }}
        >
          Nobody completed a submission in this battle, so there is nothing to
          compare.
        </p>
      </section>
    );
  }

  return (
    <section className="panel overflow-hidden">
      <div
        className="flex flex-wrap items-center gap-3 border-b px-5 py-3.5"
        style={{ borderColor: "var(--color-line)" }}
      >
        <h2 className="text-base font-bold">Solutions revealed</h2>
        <span
          className="font-mono text-[0.7rem]"
          style={{ color: "var(--color-ink-faint)" }}
        >
          Hidden during the battle — readable now that it&apos;s over.
        </span>
      </div>

      <div className="flex flex-col">
        {entries.map((e) => (
          <SolutionRow
            key={e.submissionId}
            entry={e}
            isMine={e.userId === myUserId}
            isOpponent={mySide != null && e.side !== mySide}
            open={openId === e.submissionId}
            onToggle={() =>
              setOpenId(openId === e.submissionId ? null : e.submissionId)
            }
          />
        ))}
      </div>
    </section>
  );
}

function SolutionRow({
  entry,
  isMine,
  isOpponent,
  open,
  onToggle,
}: {
  entry: SolutionEntry;
  isMine: boolean;
  isOpponent: boolean;
  open: boolean;
  onToggle: () => void;
}) {
  const color =
    entry.side === "A" ? "var(--color-side-a)" : "var(--color-side-b)";
  const pct =
    entry.total > 0 ? Math.round((entry.passed / entry.total) * 100) : 0;

  return (
    <div className="border-b last:border-b-0" style={{ borderColor: "var(--color-line)" }}>
      <button
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-5 py-3 text-left transition-colors"
        style={{ background: open ? "var(--color-surface-2)" : undefined }}
      >
        <UserAvatar identity={entry} size={32} rounded={7} ring={color} />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate font-mono text-[0.85rem] font-bold">
              {entry.username}
            </span>
            {isMine && <span className="label">you</span>}
            {isOpponent && !isMine && (
              <span className="chip" style={{ borderColor: color, color }}>
                Opponent
              </span>
            )}
            {entry.isDeciding && (
              <span className="chip chip-good">Deciding submission</span>
            )}
          </div>
          <div
            className="mt-0.5 font-mono text-[0.68rem]"
            style={{ color: "var(--color-ink-faint)" }}
          >
            {languageLabel(entry.language)} · {Math.round(entry.timeMs)}ms
          </div>
        </div>

        <div className="shrink-0 text-right">
          <div
            className="font-mono text-[0.95rem] font-bold tabular-nums"
            style={{ color }}
          >
            {entry.passed}/{entry.total}
          </div>
          <div className="label">{pct}%</div>
        </div>

        <span
          className="shrink-0 transition-transform"
          style={{
            color: "var(--color-ink-faint)",
            transform: open ? "rotate(90deg)" : undefined,
          }}
          aria-hidden
        >
          ▸
        </span>
      </button>

      {open && (
        <div
          className="overflow-x-auto px-5 pb-4"
          style={{ background: "var(--color-surface-2)" }}
        >
          <pre
            className="overflow-x-auto rounded-[8px] p-4 font-mono text-[0.74rem] leading-[1.7]"
            style={{ background: "#14161c", color: "var(--color-ink-dim)" }}
          >
            <code>{entry.sourceCode}</code>
          </pre>
        </div>
      )}
    </div>
  );
}
