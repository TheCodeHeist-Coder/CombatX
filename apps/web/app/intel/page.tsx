"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Difficulty, IntelProblemRow } from "@repo/protocol";
import { AppShell } from "../../components/AppShell";
import { ErrorBanner, Spinner } from "../../components/atoms";
import { fetchCatalogue, ApiCallError } from "../../lib/api";
import { useSession } from "../../lib/useSession";
import { useProfile } from "../../lib/useProfile";

/**
 * Intel — the problem catalogue.
 *
 * WHAT THIS PAGE DELIBERATELY DOES NOT SHOW
 * -----------------------------------------
 * Titles, difficulties and usage counts. No statements, no constraints, not
 * even the sample tests. A player who can read a problem before meeting it in
 * a ranked battle can memorise the answer, and the rating that follows means
 * nothing. The server enforces this too — the catalogue endpoint never selects
 * a statement — so this is not merely a UI decision that a curl could bypass.
 *
 * The usage count is the interesting column. It is the one honest signal about
 * a problem that does not spoil it: how often the arena has actually used it.
 */
export default function IntelPage() {
  const { session, loaded } = useSession();
  const { profile } = useProfile(session);

  const [rows, setRows] = useState<IntelProblemRow[]>([]);
  const [totals, setTotals] = useState({ easy: 0, medium: 0, hard: 0 });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);

  const [filter, setFilter] = useState<Difficulty | "ALL">("ALL");
  const [sort, setSort] = useState<"USED" | "TITLE">("USED");

  useEffect(() => {
    let alive = true;
    fetchCatalogue()
      .then((res) => {
        if (!alive) return;
        setRows(res.rows);
        setTotals({ easy: res.easy, medium: res.medium, hard: res.hard });
      })
      .catch((e) => {
        if (!alive) return;
        setError(
          e instanceof ApiCallError ? e.message : "Could not load the catalogue.",
        );
      })
      .finally(() => alive && setBusy(false));
    return () => {
      alive = false;
    };
  }, []);

  const shown = useMemo(() => {
    const list = rows.filter((r) => filter === "ALL" || r.difficulty === filter);
    return [...list].sort((a, b) =>
      sort === "TITLE"
        ? a.title.localeCompare(b.title)
        : b.battleCount - a.battleCount || a.title.localeCompare(b.title),
    );
  }, [rows, filter, sort]);

  const community = rows.filter((r) => r.authorName !== null).length;

  return (
    <AppShell session={session} profile={profile}>
      <div className="mx-auto w-full max-w-5xl px-5 py-8 sm:px-7">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Module // intel</p>
            <h1 className="mt-2 text-2xl font-bold">Problem catalogue</h1>
            <p
              className="mt-2 max-w-xl font-mono text-[0.76rem] leading-relaxed"
              style={{ color: "var(--color-ink-dim)" }}
            >
              Every problem the arena can deal you. Statements stay sealed —
              you meet them in battle, not here.
            </p>
          </div>

          {/* Only a real account can author, so a guest is not offered it. */}
          {loaded && session && !session.isGuest && (
            <div className="flex gap-2">
              <Link href="/intel/mine" className="btn btn-ghost">
                My submissions
              </Link>
              <Link href="/intel/submit" className="btn btn-primary">
                Submit a problem
              </Link>
            </div>
          )}
        </div>

        {/* Totals. The community figure is the point of the whole feature. */}
        <div className="mt-6 grid gap-3 sm:grid-cols-4">
          <Tally label="Total" value={rows.length} />
          <Tally label="Easy" value={totals.easy} color="var(--color-good)" />
          <Tally label="Medium" value={totals.medium} color="var(--color-warn)" />
          <Tally label="Hard" value={totals.hard} color="var(--color-bad)" />
        </div>

        {community > 0 && (
          <p
            className="mt-3 font-mono text-[0.72rem]"
            style={{ color: "var(--color-ink-faint)" }}
          >
            {community} of these were written by players.
          </p>
        )}

        {error && (
          <div className="mt-5">
            <ErrorBanner message={error} />
          </div>
        )}

        {/* Controls */}
        <div className="mt-6 flex flex-wrap items-center gap-2">
          {(["ALL", "EASY", "MEDIUM", "HARD"] as const).map((d) => (
            <button
              key={d}
              onClick={() => setFilter(d)}
              className="lang-pill font-mono"
              style={{
                borderColor:
                  filter === d ? "var(--color-accent)" : "var(--color-line)",
                color: filter === d ? "var(--color-accent)" : undefined,
              }}
            >
              {d.toLowerCase()}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-2">
            <label
              className="font-mono text-[0.7rem]"
              style={{ color: "var(--color-ink-faint)" }}
              htmlFor="sort"
            >
              sort
            </label>
            <select
              id="sort"
              className="field max-w-40 py-1!"
              value={sort}
              onChange={(e) => setSort(e.target.value as "USED" | "TITLE")}
            >
              <option value="USED">Most used</option>
              <option value="TITLE">A – Z</option>
            </select>
          </div>
        </div>

        {/* The catalogue */}
        <div className="panel mt-4 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr
                  className="font-mono text-[0.66rem] uppercase tracking-wider"
                  style={{ color: "var(--color-ink-faint)" }}
                >
                  <th className="px-4 py-3 font-normal">Problem</th>
                  <th className="px-4 py-3 font-normal">Difficulty</th>
                  <th className="px-4 py-3 font-normal">Author</th>
                  <th className="px-4 py-3 text-right font-normal">
                    Used in battles
                  </th>
                </tr>
              </thead>
              <tbody>
                {busy ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-12 text-center">
                      <Spinner />
                    </td>
                  </tr>
                ) : shown.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-12 text-center font-mono text-[0.78rem]"
                      style={{ color: "var(--color-ink-ghost)" }}
                    >
                      Nothing at this difficulty yet.
                    </td>
                  </tr>
                ) : (
                  shown.map((p) => (
                    <tr
                      key={p.id}
                      style={{ borderTop: "1px solid var(--color-line)" }}
                    >
                      <td className="px-4 py-3 text-[0.85rem] font-semibold">
                        {p.title}
                      </td>
                      <td className="px-4 py-3">
                        <DifficultyChip value={p.difficulty} />
                      </td>
                      <td
                        className="px-4 py-3 font-mono text-[0.72rem]"
                        style={{ color: "var(--color-ink-dim)" }}
                      >
                        {p.authorName ? (
                          <Link
                            href={`/u/${p.authorName}`}
                            className="underline underline-offset-2"
                            style={{ color: "var(--color-accent)" }}
                          >
                            {p.authorName}
                          </Link>
                        ) : (
                          <span style={{ color: "var(--color-ink-ghost)" }}>
                            arena
                          </span>
                        )}
                      </td>
                      <td
                        className="px-4 py-3 text-right font-mono text-[0.8rem] tabular-nums"
                        style={{
                          color:
                            p.battleCount === 0
                              ? "var(--color-ink-ghost)"
                              : "var(--color-ink)",
                        }}
                      >
                        {p.battleCount}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {loaded && (!session || session.isGuest) && (
          <p
            className="mt-5 text-center font-mono text-[0.74rem]"
            style={{ color: "var(--color-ink-faint)" }}
          >
            <Link
              href="/signup?next=%2Fintel"
              className="underline underline-offset-2"
              style={{ color: "var(--color-accent)" }}
            >
              Create an account
            </Link>{" "}
            to write problems of your own.
          </p>
        )}
      </div>
    </AppShell>
  );
}

function Tally({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color?: string;
}) {
  return (
    <div className="panel px-4 py-3">
      <p className="label">{label}</p>
      <p
        className="mt-1 font-mono text-[1.4rem] font-bold tabular-nums"
        style={{ color: color ?? "var(--color-ink)" }}
      >
        {value}
      </p>
    </div>
  );
}

/** Difficulty as a coloured chip, matching the arena's own colouring. */
export function DifficultyChip({ value }: { value: Difficulty }) {
  const color =
    value === "EASY"
      ? "var(--color-good)"
      : value === "HARD"
        ? "var(--color-bad)"
        : "var(--color-warn)";
  return (
    <span
      className="chip font-mono"
      style={{ borderColor: color, color, fontSize: "0.64rem" }}
    >
      {value.toLowerCase()}
    </span>
  );
}
