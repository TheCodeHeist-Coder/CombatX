"use client";

import { useEffect, useState } from "react";
import type { AdminUserRow } from "@repo/protocol";
import { AdminShell } from "../../components/AdminShell";
import {
  Chip,
  Dim,
  EmptyRow,
  ErrorBanner,
  IconSearch,
  PageHeader,
  Spinner,
} from "../../components/atoms";
import { Pager } from "../../components/Pager";
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
              err instanceof AdminApiError
                ? err.message
                : "Could not load users.",
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
    <div className="flex flex-col gap-7">
      <PageHeader
        eyebrow="Directory"
        title="Users"
        lede={`${total.toLocaleString()} account${total === 1 ? "" : "s"}, newest first. Emails are shown here and nowhere else in the product.`}
        actions={
          <div className="relative">
            <span
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
              style={{ color: "var(--color-ink-ghost)" }}
            >
              <IconSearch />
            </span>
            <input
              className="field w-64 pl-9"
              placeholder="Search name, handle or email…"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setOffset(0);
              }}
            />
          </div>
        }
      />

      {error && <ErrorBanner message={error} />}

      <div className="panel panel-lit overflow-hidden">
        <div className="overflow-x-auto">
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
                    <div className="flex flex-col leading-tight">
                      <span style={{ color: "var(--color-ink)" }}>
                        {u.username}
                      </span>
                      {u.name && (
                        <span className="text-[0.68rem]">
                          <Dim>{u.name}</Dim>
                        </span>
                      )}
                    </div>
                  </td>
                  <td>{u.email ?? <Dim>—</Dim>}</td>
                  <td>
                    <RoleChip row={u} />
                  </td>
                  <td className="text-right tabular-nums">{u.xp}</td>
                  <td className="text-right tabular-nums">
                    <span style={{ color: "var(--color-good)" }}>{u.wins}</span>
                    <Dim> / </Dim>
                    <span style={{ color: "var(--color-bad)" }}>{u.losses}</span>
                  </td>
                  <td>{fmtDate(u.createdAt)}</td>
                  <td>
                    {u.lastBattleAt ? fmtDate(u.lastBattleAt) : <Dim>never</Dim>}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && !loading && (
                <EmptyRow colSpan={7}>
                  {query
                    ? `No users match “${query}”.`
                    : "No users yet."}
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
      />
    </div>
  );
}

function RoleChip({ row }: { row: AdminUserRow }) {
  if (row.role === "SUPER_ADMIN") {
    return <Chip color="var(--color-primary)">admin</Chip>;
  }
  if (row.isGuest) return <Chip>guest</Chip>;
  return <Chip color="var(--color-violet)">player</Chip>;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
