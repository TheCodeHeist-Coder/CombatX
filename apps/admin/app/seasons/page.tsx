"use client";

import { useEffect, useState } from "react";
import type {
  AdminSeasonRow,
  AdminSeasonStanding,
} from "@repo/protocol";
import { AdminShell } from "../../components/AdminShell";
import {
  Chip,
  Dim,
  EmptyRow,
  ErrorBanner,
  PageHeader,
  Spinner,
} from "../../components/atoms";
import {
  fetchSeasons,
  fetchSeasonStandings,
  startSeason,
  endSeason,
  AdminApiError,
} from "../../lib/api";
import { useAdminSession } from "../../lib/useAdminSession";

export default function SeasonsPage() {
  return (
    <AdminShell>
      <Seasons />
    </AdminShell>
  );
}

/**
 * Season management.
 *
 * Ending a season is the most destructive action in this console: it writes a
 * permanent archive and rewrites every player's rating in one transaction.
 * So it is gated behind typing the season's name, the same way a repository
 * deletion is — a confirm dialog is too easy to click through, and there is no
 * undo on the other side.
 */
function Seasons() {
  const { session } = useAdminSession();
  const [rows, setRows] = useState<AdminSeasonRow[]>([]);
  const [active, setActive] = useState<AdminSeasonRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [newName, setNewName] = useState("");
  const [confirm, setConfirm] = useState("");
  const [nextName, setNextName] = useState("");

  const [openId, setOpenId] = useState<string | null>(null);
  const [standings, setStandings] = useState<AdminSeasonStanding[]>([]);

  function load() {
    if (!session) return;
    setLoading(true);
    fetchSeasons(session.token)
      .then((r) => {
        setRows(r.rows);
        setActive(r.active);
      })
      .catch((e) =>
        setError(
          e instanceof AdminApiError ? e.message : "Could not load seasons.",
        ),
      )
      .finally(() => setLoading(false));
  }

  useEffect(load, [session]);

  async function open() {
    if (!session || !newName.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await startSeason(session.token, newName.trim());
      setNotice(`Started "${newName.trim()}".`);
      setNewName("");
      load();
    } catch (e) {
      setError(
        e instanceof AdminApiError ? e.message : "Could not start the season.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function close() {
    if (!session || !active) return;
    setBusy(true);
    setError(null);
    try {
      const res = await endSeason(
        session.token,
        active.id,
        nextName.trim() || undefined,
      );
      const podium = res.podium
        .map((p) => `#${p.rank} ${p.username} (${p.rating})`)
        .join(", ");
      setNotice(
        `Closed "${res.closed.name}" — ${res.ranked} ranked, ${res.softened} ratings softened.` +
          (podium ? ` Podium: ${podium}.` : "") +
          (res.opened ? ` Started "${res.opened.name}".` : ""),
      );
      setConfirm("");
      setNextName("");
      load();
    } catch (e) {
      setError(
        e instanceof AdminApiError ? e.message : "Could not end the season.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function showStandings(id: string) {
    if (!session) return;
    if (openId === id) {
      setOpenId(null);
      return;
    }
    setOpenId(id);
    setStandings([]);
    try {
      const r = await fetchSeasonStandings(session.token, id);
      setStandings(r.rows);
    } catch {
      setStandings([]);
    }
  }

  return (
    <div className="flex flex-col gap-7">
      <PageHeader
        eyebrow="Competition"
        title="Seasons"
        lede="A season closes the ladder, archives the final table, and softens every rating toward 1500 so the next one is worth climbing. Career XP, badges and win totals are never touched."
      />

      {error && <ErrorBanner message={error} />}
      {notice && (
        <p
          className="font-mono text-[0.76rem]"
          style={{ color: "var(--color-good)" }}
        >
          {notice}
        </p>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : (
        <>
          {/* --- The running season, or the invitation to start one --- */}
          <section className="panel panel-lit p-6">
            {active ? (
              <>
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-[1.1rem] font-bold">{active.name}</h2>
                  <Chip color="var(--color-good)">running</Chip>
                  <Dim>
                    since {new Date(active.startedAt).toLocaleDateString()}
                  </Dim>
                </div>

                <p
                  className="mt-4 font-mono text-[0.76rem] leading-relaxed"
                  style={{ color: "var(--color-ink-dim)" }}
                >
                  Ending this season is <strong>permanent</strong>. It records
                  the final standings and rewrites every rating. Type the
                  season&apos;s name to confirm.
                </p>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <label className="label" htmlFor="confirm">
                      Type &ldquo;{active.name}&rdquo; to confirm
                    </label>
                    <input
                      id="confirm"
                      className="field"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      placeholder={active.name}
                      autoComplete="off"
                      disabled={busy}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="label" htmlFor="next">
                      Next season name (optional)
                    </label>
                    <input
                      id="next"
                      className="field"
                      value={nextName}
                      onChange={(e) => setNextName(e.target.value)}
                      placeholder="Season 2"
                      autoComplete="off"
                      disabled={busy}
                    />
                  </div>
                </div>

                <button
                  className="btn btn-danger mt-4"
                  onClick={close}
                  disabled={busy || confirm.trim() !== active.name}
                  title={
                    confirm.trim() !== active.name
                      ? "Type the season name first"
                      : "End this season"
                  }
                >
                  {busy ? <Spinner /> : "End season and soften ratings"}
                </button>
              </>
            ) : (
              <>
                <h2 className="text-[1.1rem] font-bold">No season running</h2>
                <p
                  className="mt-2 font-mono text-[0.76rem] leading-relaxed"
                  style={{ color: "var(--color-ink-dim)" }}
                >
                  Battles still work without one — they simply are not stamped
                  with a season, and no standings will be archived.
                </p>
                <div className="mt-4 flex flex-wrap items-end gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="label" htmlFor="name">
                      Season name
                    </label>
                    <input
                      id="name"
                      className="field"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="Season 1"
                      autoComplete="off"
                      disabled={busy}
                    />
                  </div>
                  <button
                    className="btn btn-primary"
                    onClick={open}
                    disabled={busy || newName.trim().length < 2}
                  >
                    {busy ? <Spinner /> : "Start season"}
                  </button>
                </div>
              </>
            )}
          </section>

          {/* --- The archive --- */}
          <div className="panel panel-lit overflow-hidden">
            <div className="overflow-x-auto">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Season</th>
                    <th>Status</th>
                    <th>Started</th>
                    <th>Ended</th>
                    <th className="text-right">Ranked</th>
                    <th className="text-right">Standings</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <EmptyRow colSpan={6}>
                      No seasons yet — start one above.
                    </EmptyRow>
                  ) : (
                    rows.map((s) => (
                      <tr key={s.id}>
                        <td className="font-medium">{s.name}</td>
                        <td>
                          {s.isActive ? (
                            <Chip color="var(--color-good)">running</Chip>
                          ) : (
                            <Chip color="var(--color-ink-ghost)">closed</Chip>
                          )}
                        </td>
                        <td>{new Date(s.startedAt).toLocaleDateString()}</td>
                        <td>
                          {s.endedAt ? (
                            new Date(s.endedAt).toLocaleDateString()
                          ) : (
                            <Dim>—</Dim>
                          )}
                        </td>
                        <td className="text-right tabular-nums">
                          {s.standings > 0 ? s.standings : <Dim>—</Dim>}
                        </td>
                        <td className="text-right">
                          {s.standings > 0 ? (
                            <button
                              className="btn btn-ghost px-2.5! py-1! text-[0.66rem]!"
                              onClick={() => showStandings(s.id)}
                            >
                              {openId === s.id ? "Hide" : "View"}
                            </button>
                          ) : (
                            <Dim>—</Dim>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* --- One season's final table --- */}
          {openId && standings.length > 0 && (
            <div className="panel panel-lit overflow-hidden">
              <div className="overflow-x-auto">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th className="text-right">#</th>
                      <th>Player</th>
                      <th>Tier</th>
                      <th className="text-right">Rating</th>
                      <th className="text-right">W / L</th>
                      <th className="text-right">Battles</th>
                    </tr>
                  </thead>
                  <tbody>
                    {standings.map((r) => (
                      <tr key={r.userId}>
                        <td className="text-right tabular-nums">{r.rank}</td>
                        <td className="font-medium">{r.username}</td>
                        <td>
                          <Chip>{r.tier.toLowerCase()}</Chip>
                        </td>
                        <td className="text-right tabular-nums">{r.rating}</td>
                        <td className="text-right tabular-nums">
                          {r.wins} / {r.losses}
                        </td>
                        <td className="text-right tabular-nums">
                          {r.rankedBattles}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
