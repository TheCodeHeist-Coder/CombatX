"use client";

import { useEffect, useState } from "react";
import type { AdminBattleRow } from "@repo/protocol";
import { AdminShell } from "../../components/AdminShell";
import { ErrorBanner, Spinner } from "../../components/atoms";
import { fetchBattles, AdminApiError } from "../../lib/api";
import { useAdminSession } from "../../lib/useAdminSession";

const PAGE = 50;

export default function BattlesPage() {
  return (
    <AdminShell>
      <Battles />
    </AdminShell>
  );
}

function Battles() {
  const { session } = useAdminSession();
  const [rows, setRows] = useState<AdminBattleRow[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session) return;
    let alive = true;
    setLoading(true);
    fetchBattles(session.token, { limit: PAGE, offset })
      .then((d) => {
        if (!alive) return;
        setRows(d.rows);
        setTotal(d.total);
        setError(null);
      })
      .catch(
        (err) =>
          alive &&
          setError(
            err instanceof AdminApiError ? err.message : "Could not load battles.",
          ),
      )
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [session, offset]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="label">History</p>
        <h1 className="mt-1 text-2xl font-bold">Battles</h1>
      </div>

      {error && <ErrorBanner message={error} />}

      <div className="panel overflow-x-auto">
        <table className="tbl">
          <thead>
            <tr>
              <th>Room</th>
              <th>Status</th>
              <th>Mode</th>
              <th>Difficulty</th>
              <th>Problem</th>
              <th>Host</th>
              <th className="text-right">Players</th>
              <th>Winner</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((b) => (
              <tr key={b.id}>
                <td style={{ color: "var(--color-ink)" }}>{b.roomCode}</td>
                <td>
                  <StatusChip status={b.status} />
                </td>
                <td>{b.mode.replaceAll("_", " ").toLowerCase()}</td>
                <td>{b.difficulty.toLowerCase()}</td>
                <td className="max-w-56 truncate">
                  {b.problemTitle ?? <Dim>not assigned</Dim>}
                </td>
                <td>{b.hostUsername ?? <Dim>—</Dim>}</td>
                <td className="text-right tabular-nums">{b.playerCount}</td>
                <td>
                  {b.winnerSide ? (
                    <span
                      className="chip"
                      style={{
                        borderColor:
                          b.winnerSide === "A"
                            ? "var(--color-side-a)"
                            : "var(--color-side-b)",
                        color:
                          b.winnerSide === "A"
                            ? "var(--color-side-a)"
                            : "var(--color-side-b)",
                      }}
                    >
                      Team {b.winnerSide}
                    </span>
                  ) : (
                    <Dim>—</Dim>
                  )}
                </td>
                <td>{fmt(b.createdAt)}</td>
              </tr>
            ))}
            {rows.length === 0 && !loading && (
              <tr>
                <td colSpan={9} className="py-8 text-center">
                  <Dim>No battles yet.</Dim>
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

      {total > PAGE && (
        <div className="flex items-center justify-between">
          <span
            className="font-mono text-[0.72rem]"
            style={{ color: "var(--color-ink-faint)" }}
          >
            {offset + 1}–{offset + rows.length} of {total}
          </span>
          <div className="flex gap-2">
            <button
              className="btn btn-ghost"
              disabled={offset === 0}
              onClick={() => setOffset(Math.max(0, offset - PAGE))}
            >
              Previous
            </button>
            <button
              className="btn btn-ghost"
              disabled={offset + rows.length >= total}
              onClick={() => setOffset(offset + PAGE)}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Colour-codes the lifecycle so a stuck battle is visible at a glance. */
function StatusChip({ status }: { status: string }) {
  const colour =
    status === "FINISHED"
      ? "var(--color-good)"
      : status === "ABANDONED"
        ? "var(--color-bad)"
        : status === "IN_PROGRESS"
          ? "var(--color-warn)"
          : "var(--color-ink-faint)";
  return (
    <span className="chip" style={{ borderColor: colour, color: colour }}>
      {status.replaceAll("_", " ").toLowerCase()}
    </span>
  );
}

function Dim({ children }: { children: React.ReactNode }) {
  return <span style={{ color: "var(--color-ink-ghost)" }}>{children}</span>;
}

function fmt(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
