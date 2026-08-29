"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { AdminProblemRow } from "@repo/protocol";
import { AdminShell } from "../../components/AdminShell";
import { ErrorBanner, Spinner } from "../../components/atoms";
import { fetchProblems, deleteProblem, AdminApiError } from "../../lib/api";
import { useAdminSession } from "../../lib/useAdminSession";

export default function ProblemsPage() {
  return (
    <AdminShell>
      <Problems />
    </AdminShell>
  );
}

function Problems() {
  const { session } = useAdminSession();
  const [rows, setRows] = useState<AdminProblemRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  function load() {
    if (!session) return;
    setLoading(true);
    fetchProblems(session.token)
      .then((d) => {
        setRows(d.rows);
        setError(null);
      })
      .catch((err) =>
        setError(
          err instanceof AdminApiError ? err.message : "Could not load problems.",
        ),
      )
      .finally(() => setLoading(false));
  }

  useEffect(load, [session]);

  async function remove(row: AdminProblemRow) {
    if (!session) return;
    // A problem used in a battle is refused by the server; warn first anyway
    // so the destructive click is never a surprise.
    if (
      !window.confirm(
        `Delete "${row.title}"? This cannot be undone.`,
      )
    ) {
      return;
    }
    setBusyId(row.id);
    try {
      await deleteProblem(session.token, row.id);
      load();
    } catch (err) {
      setError(
        err instanceof AdminApiError ? err.message : "Could not delete.",
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label">Content</p>
          <h1 className="mt-1 text-2xl font-bold">Problems</h1>
          <p
            className="mt-1.5 font-mono text-[0.75rem]"
            style={{ color: "var(--color-ink-faint)" }}
          >
            The pool battles draw from. A battle picks a problem matching its
            chosen difficulty.
          </p>
        </div>
        <Link href="/problems/new" className="btn btn-primary">
          New problem
        </Link>
      </div>

      {error && <ErrorBanner message={error} />}

      <div className="panel overflow-x-auto">
        <table className="tbl">
          <thead>
            <tr>
              <th>Title</th>
              <th>Difficulty</th>
              <th>Languages</th>
              <th className="text-right">Tests</th>
              <th className="text-right">Used in</th>
              <th className="text-right">Time</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id}>
                <td>
                  <Link
                    href={`/problems/${p.id}`}
                    className="hover:underline"
                    style={{ color: "var(--color-accent)" }}
                  >
                    {p.title}
                  </Link>
                </td>
                <td>
                  <DifficultyChip value={p.difficulty} />
                </td>
                <td className="max-w-48 truncate">
                  {p.allowedLanguages.join(", ").toLowerCase()}
                </td>
                <td className="text-right tabular-nums">
                  {p.testCount}
                  <span style={{ color: "var(--color-ink-ghost)" }}>
                    {" "}
                    ({p.sampleCount} shown)
                  </span>
                </td>
                <td className="text-right tabular-nums">{p.battleCount}</td>
                <td className="text-right tabular-nums">
                  {Math.round(p.timeLimitDefaultSec / 60)}m
                </td>
                <td className="text-right">
                  <button
                    className="btn btn-danger px-2.5! py-1! text-[0.68rem]!"
                    disabled={busyId === p.id || p.battleCount > 0}
                    title={
                      p.battleCount > 0
                        ? "Used in a battle — cannot be deleted"
                        : "Delete this problem"
                    }
                    onClick={() => remove(p)}
                  >
                    {busyId === p.id ? <Spinner /> : "Delete"}
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && !loading && (
              <tr>
                <td colSpan={7} className="py-8 text-center">
                  <span style={{ color: "var(--color-ink-ghost)" }}>
                    No problems yet. Battles cannot start without one.
                  </span>
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {loading && (
          <div className="flex justify-center py-6">
            <Spinner />
          </div>
        )}
      </div>
    </div>
  );
}

function DifficultyChip({ value }: { value: string }) {
  const colour =
    value === "EASY"
      ? "var(--color-good)"
      : value === "HARD"
        ? "var(--color-bad)"
        : "var(--color-warn)";
  return (
    <span className="chip" style={{ borderColor: colour, color: colour }}>
      {value.toLowerCase()}
    </span>
  );
}
