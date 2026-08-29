"use client";

import { useEffect, useState } from "react";
import type { AdminBattleRow } from "@repo/protocol";
import { AdminShell } from "../../components/AdminShell";
import {
  Chip,
  Dim,
  EmptyRow,
  ErrorBanner,
  PageHeader,
  Spinner,
} from "../../components/atoms";
import { Pager } from "../../components/Pager";
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
            err instanceof AdminApiError
              ? err.message
              : "Could not load battles.",
          ),
      )
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [session, offset]);

  return (
    <div className="flex flex-col gap-7">
      <PageHeader
        eyebrow="History"
        title="Battles"
        lede={`${total.toLocaleString()} battle${total === 1 ? "" : "s"} on record, newest first.`}
      />

      {error && <ErrorBanner message={error} />}

      <div className="panel panel-lit overflow-hidden">
        <div className="overflow-x-auto">
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
                  <td
                    className="font-medium tracking-wider"
                    style={{ color: "var(--color-ink)" }}
                  >
                    {b.roomCode}
                  </td>
                  <td>
                    <StatusChip status={b.status} />
                  </td>
                  <td>{b.mode.replaceAll("_", " ").toLowerCase()}</td>
                  <td>
                    <DifficultyChip value={b.difficulty} />
                  </td>
                  <td className="max-w-56 truncate">
                    {b.problemTitle ?? <Dim>not assigned</Dim>}
                  </td>
                  <td>{b.hostUsername ?? <Dim>—</Dim>}</td>
                  <td className="text-right tabular-nums">{b.playerCount}</td>
                  <td>
                    {b.winnerSide ? (
                      <Chip
                        color={
                          b.winnerSide === "A"
                            ? "var(--color-side-a)"
                            : "var(--color-side-b)"
                        }
                      >
                        Team {b.winnerSide}
                      </Chip>
                    ) : (
                      <Dim>—</Dim>
                    )}
                  </td>
                  <td>{fmtDateTime(b.createdAt)}</td>
                </tr>
              ))}
              {rows.length === 0 && !loading && (
                <EmptyRow colSpan={9}>
                  No battles yet. They appear here the moment one is created.
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

      <Pager
        offset={offset}
        count={rows.length}
        total={total}
        onPage={setOffset}
        pageSize={PAGE}
      />
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
          : "var(--color-primary)";
  return <Chip color={colour}>{status.replaceAll("_", " ").toLowerCase()}</Chip>;
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

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
