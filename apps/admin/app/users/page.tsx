"use client";

import { useEffect, useState } from "react";
import type { AdminUserRow } from "@repo/protocol";
import { AdminShell } from "../../components/AdminShell";
import { ErrorBanner, Spinner } from "../../components/atoms";
import { fetchUsers, AdminApiError } from "../../lib/api";
import { useAdminSession } from "../../lib/useAdminSession";

const PAGE = 50;

export default function UsersPage() {
  return (
    <AdminShell>
      <Users />
    </AdminShell>
  );
}

function Users() {
  const { session } = useAdminSession();
  const [rows, setRows] = useState<AdminUserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Debounced so typing a name does not fire a request per keystroke.
  useEffect(() => {
    if (!session) return;
    let alive = true;
    setLoading(true);
    const timer = setTimeout(() => {
      fetchUsers(session.token, { q: query, limit: PAGE, offset })
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
              err instanceof AdminApiError ? err.message : "Could not load users.",
            ),
        )
        .finally(() => alive && setLoading(false));
    }, 250);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [session, query, offset]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label">Directory</p>
          <h1 className="mt-1 text-2xl font-bold">Users</h1>
        </div>
        <input
          className="field max-w-xs"
          placeholder="Search username, email or name…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOffset(0);
          }}
        />
      </div>

      {error && <ErrorBanner message={error} />}

      <div className="panel overflow-x-auto">
        <table className="tbl">
          <thead>
            <tr>
              <th>User</th>
              <th>Email</th>
              <th>Role</th>
              <th className="text-right">XP</th>
              <th className="text-right">W / L</th>
              <th>Joined</th>
              <th>Last battle</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.id}>
                <td>
                  <span style={{ color: "var(--color-ink)" }}>{u.username}</span>
                  {u.name && (
                    <span
                      className="ml-2"
                      style={{ color: "var(--color-ink-ghost)" }}
                    >
                      {u.name}
                    </span>
                  )}
                </td>
                <td>{u.email ?? <Dim>—</Dim>}</td>
                <td>
                  {u.role === "SUPER_ADMIN" ? (
                    <span
                      className="chip"
                      style={{
                        borderColor: "var(--color-primary)",
                        color: "var(--color-primary)",
                      }}
                    >
                      admin
                    </span>
                  ) : u.isGuest ? (
                    <span className="chip">guest</span>
                  ) : (
                    <span className="chip">player</span>
                  )}
                </td>
                <td className="text-right tabular-nums">{u.xp}</td>
                <td className="text-right tabular-nums">
                  {u.wins} / {u.losses}
                </td>
                <td>{fmt(u.createdAt)}</td>
                <td>{u.lastBattleAt ? fmt(u.lastBattleAt) : <Dim>never</Dim>}</td>
              </tr>
            ))}
            {rows.length === 0 && !loading && (
              <tr>
                <td colSpan={7} className="py-8 text-center">
                  <Dim>{query ? "No users match that search." : "No users yet."}</Dim>
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

      <Pager
        offset={offset}
        count={rows.length}
        total={total}
        onPage={setOffset}
      />
    </div>
  );
}

function Dim({ children }: { children: React.ReactNode }) {
  return <span style={{ color: "var(--color-ink-ghost)" }}>{children}</span>;
}

function fmt(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function Pager({
  offset,
  count,
  total,
  onPage,
}: {
  offset: number;
  count: number;
  total: number;
  onPage: (next: number) => void;
}) {
  if (total <= PAGE) return null;
  return (
    <div className="flex items-center justify-between">
      <span
        className="font-mono text-[0.72rem]"
        style={{ color: "var(--color-ink-faint)" }}
      >
        {offset + 1}–{offset + count} of {total}
      </span>
      <div className="flex gap-2">
        <button
          className="btn btn-ghost"
          disabled={offset === 0}
          onClick={() => onPage(Math.max(0, offset - PAGE))}
        >
          Previous
        </button>
        <button
          className="btn btn-ghost"
          disabled={offset + count >= total}
          onClick={() => onPage(offset + PAGE)}
        >
          Next
        </button>
      </div>
    </div>
  );
}
