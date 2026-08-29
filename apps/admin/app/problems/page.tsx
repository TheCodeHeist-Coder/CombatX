"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { AdminProblemRow } from "@repo/protocol";
import { AdminShell } from "../../components/AdminShell";
import {
  Chip,
  Dim,
  EmptyRow,
  ErrorBanner,
  IconDoc,
  IconPencil,
  IconPlus,
  IconTrash,
  PageHeader,
  Spinner,
} from "../../components/atoms";
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
          err instanceof AdminApiError
            ? err.message
            : "Could not load problems.",
        ),
      )
      .finally(() => setLoading(false));
  }

  useEffect(load, [session]);

  async function remove(row: AdminProblemRow) {
    if (!session) return;
    // A problem used in a battle is refused by the server; warn first anyway
    // so the destructive click is never a surprise.
    if (!window.confirm(`Delete "${row.title}"? This cannot be undone.`)) {
      return;
    }
    setBusyId(row.id);
    try {
      await deleteProblem(session.token, row.id);
      load();
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "Could not delete.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="flex flex-col gap-7">
      <PageHeader
        eyebrow="Content"
        title="Problems"
        lede="The pool battles draw from. When a battle starts, it picks a problem matching the difficulty its host chose — so every difficulty needs at least one."
        actions={
          <Link href="/problems/new" className="btn btn-primary">
            <IconPlus />
            New problem
          </Link>
        }
      />

      {error && <ErrorBanner message={error} />}

      <div className="panel panel-lit overflow-hidden">
        <div className="overflow-x-auto">
          <table className="tbl">
            <thead>
              <tr>
                <th>Title</th>
                <th>Difficulty</th>
                <th>Languages</th>
                <th className="text-right">Tests</th>
                <th className="text-right">Used in</th>
                <th className="text-right">Time</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id}>
                  <td>
                    <Link
                      href={`/problems/${p.id}`}
                      className="font-medium transition-opacity hover:opacity-75"
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
                    <Dim> ({p.sampleCount} shown)</Dim>
                  </td>
                  <td className="text-right tabular-nums">
                    {p.battleCount > 0 ? (
                      p.battleCount
                    ) : (
                      <Dim>—</Dim>
                    )}
                  </td>
                  <td className="text-right tabular-nums">
                    {Math.round(p.timeLimitDefaultSec / 60)}m
                  </td>
                  <td>
                    <div className="flex justify-end gap-2">
                      <Link
                        href={`/problems/${p.id}`}
                        className="btn btn-ghost px-2.5! py-1! text-[0.66rem]!"
                      >
                        <IconPencil />
                        Edit
                      </Link>
                      <button
                        className="btn btn-danger px-2.5! py-1! text-[0.66rem]!"
                        disabled={busyId === p.id || p.battleCount > 0}
                        title={
                          p.battleCount > 0
                            ? "Used in a battle — cannot be deleted"
                            : "Delete this problem"
                        }
                        onClick={() => remove(p)}
                      >
                        {busyId === p.id ? <Spinner /> : <IconTrash />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && !loading && (
                <EmptyRow colSpan={7}>
                  <span className="flex flex-col items-center gap-3">
                    <span style={{ color: "var(--color-ink-ghost)" }}>
                      <IconDoc />
                    </span>
                    No problems yet — battles cannot start without one.
                    <Link href="/problems/new" className="btn btn-primary mt-1">
                      <IconPlus />
                      Create the first problem
                    </Link>
                  </span>
                </EmptyRow>
              )}
            </tbody>
          </table>
        </div>
        {loading && (
          <div className="flex justify-center py-8">
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
  return <Chip color={colour}>{value.toLowerCase()}</Chip>;
}
