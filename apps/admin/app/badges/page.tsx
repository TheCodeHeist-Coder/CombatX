"use client";

import { useCallback, useEffect, useState } from "react";
import type { AdminBadgeCondition, AdminBadgeRow } from "@repo/protocol";
import { AdminShell } from "../../components/AdminShell";
import {
  Chip,
  EmptyRow,
  ErrorBanner,
  IconPencil,
  IconPlus,
  IconTrash,
  PageHeader,
  Spinner,
} from "../../components/atoms";
import { BadgeEditor, type Draft } from "../../components/badges/BadgeEditor";
import { CRESTS } from "../../components/badges/crests";
import { Medal } from "../../components/badges/Medal";
import { RARITY_FG, RARITY_TONE } from "../../components/badges/tones";
import {
  AdminApiError,
  createBadge,
  deleteBadge,
  fetchBadges,
  previewBadge,
  recalculateBadges,
  seedBadges,
  updateBadge,
} from "../../lib/api";
import { useAdminSession } from "../../lib/useAdminSession";

export default function BadgesPage() {
  return (
    <AdminShell>
      <Badges />
    </AdminShell>
  );
}

/** Which pane is showing: the table, or the editor for one badge. */
type Mode =
  | { kind: "list" }
  | { kind: "edit"; row: AdminBadgeRow }
  | { kind: "new" };

function Badges() {
  const { session } = useAdminSession();
  const [rows, setRows] = useState<AdminBadgeRow[] | null>(null);
  const [mode, setMode] = useState<Mode>({ kind: "list" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const token = session?.token;

  const load = useCallback(() => {
    if (!token) return;
    fetchBadges(token)
      .then((d) => setRows(d.rows))
      .catch((e) =>
        setError(
          e instanceof AdminApiError ? e.message : "Could not load badges.",
        ),
      );
  }, [token]);

  useEffect(load, [load]);

  const preview = useCallback(
    async (conditions: AdminBadgeCondition[]) => {
      if (!token) return { matches: 0, totalUsers: 0, summary: "" };
      return previewBadge(token, conditions);
    },
    [token],
  );

  async function save(draft: Draft) {
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      const { key, ...rest } = draft;
      const res =
        mode.kind === "new"
          ? await createBadge(token, { ...rest, key })
          : await updateBadge(token, key, rest);
      setRows(res.rows);
      setMode({ kind: "list" });
      setNotice(
        mode.kind === "new"
          ? `Created ${draft.label}.`
          : `Saved ${draft.label}. Existing holders keep it — use Recalculate to re-apply.`,
      );
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(row: AdminBadgeRow) {
    if (!token) return;
    if (!confirm(`Delete "${row.label}"? This cannot be undone.`)) return;
    setBusy(true);
    setError(null);
    try {
      setRows((await deleteBadge(token, row.key)).rows);
      setNotice(`Deleted ${row.label}.`);
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : "Could not delete.");
    } finally {
      setBusy(false);
    }
  }

  async function recalc() {
    if (!token) return;
    if (
      !confirm(
        "Re-apply every rule to every player?\n\nThis awards newly-qualifying badges AND revokes badges whose rule no longer holds.",
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const r = await recalculateBadges(token);
      setNotice(
        `Scanned ${r.usersScanned} players — awarded ${r.awarded}, revoked ${r.revoked}.`,
      );
      load();
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : "Could not recalculate.");
    } finally {
      setBusy(false);
    }
  }

  async function restore() {
    if (!token) return;
    setBusy(true);
    try {
      setRows((await seedBadges(token)).rows);
      setNotice("Restored any missing default badges.");
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : "Could not restore.");
    } finally {
      setBusy(false);
    }
  }

  if (mode.kind !== "list") {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          eyebrow="Badges"
          title={mode.kind === "new" ? "New badge" : mode.row.label}
          lede={
            mode.kind === "new"
              ? "Define what players earn and what it takes to earn it."
              : "Everything except the key can be changed."
          }
        />
        <BadgeEditor
          initial={mode.kind === "edit" ? mode.row : null}
          busy={busy}
          error={error}
          onSave={save}
          onCancel={() => {
            setError(null);
            setMode({ kind: "list" });
          }}
          onPreview={preview}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Badges"
        title="Badges"
        lede="What players earn, and what it takes. Editing a rule changes who qualifies from now on; existing awards are kept."
        actions={
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-ghost" onClick={restore} disabled={busy}>
              Restore defaults
            </button>
            <button className="btn btn-ghost" onClick={recalc} disabled={busy}>
              Recalculate
            </button>
            <button
              className="btn btn-primary"
              onClick={() => setMode({ kind: "new" })}
            >
              <IconPlus /> New badge
            </button>
          </div>
        }
      />

      {error && <ErrorBanner message={error} />}

      {notice && (
        <div
          className="panel flex items-center gap-3 px-4 py-3"
          style={{ borderColor: "var(--color-line-strong)" }}
        >
          <p className="font-mono text-[0.74rem]">{notice}</p>
          <button
            className="btn btn-ghost ml-auto px-2! py-1! text-[0.64rem]!"
            onClick={() => setNotice(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="panel panel-lit overflow-hidden">
        <table className="tbl">
          <thead>
            <tr>
              <th style={{ width: 56 }}></th>
              <th>Badge</th>
              <th>Criteria</th>
              <th>Rarity</th>
              <th className="text-right">Holders</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows?.map((r) => (
              <tr key={r.key} style={{ opacity: r.enabled ? 1 : 0.5 }}>
                <td>
                  <Medal
                    crest={CRESTS[r.artKey] ?? CRESTS.FIRST_BLOOD!}
                    tone={RARITY_TONE[r.rarity] ?? RARITY_TONE.COMMON!}
                    size={38}
                    uid={`row-${r.key}`}
                    muted={!r.enabled}
                  />
                </td>
                <td>
                  <div className="flex flex-col leading-tight">
                    <span style={{ color: "var(--color-ink)" }}>{r.label}</span>
                    <span className="text-[0.66rem]">
                      <span style={{ color: "var(--color-ink-ghost)" }}>
                        {r.key}
                      </span>
                    </span>
                  </div>
                </td>
                <td style={{ maxWidth: 320 }}>
                  <span className="text-[0.72rem]">{r.summary}</span>
                  {!r.enabled && (
                    <span
                      className="ml-2 text-[0.62rem] uppercase"
                      style={{ color: "var(--color-warn)" }}
                    >
                      disabled
                    </span>
                  )}
                </td>
                <td>
                  <Chip color={RARITY_FG[r.rarity]}>
                    {r.rarity.charAt(0) + r.rarity.slice(1).toLowerCase()}
                  </Chip>
                </td>
                <td className="text-right tabular-nums">{r.holders}</td>
                <td>
                  <div className="flex justify-end gap-1.5">
                    <button
                      className="btn btn-ghost px-2.5! py-1! text-[0.66rem]!"
                      onClick={() => setMode({ kind: "edit", row: r })}
                    >
                      <IconPencil /> Edit
                    </button>
                    <button
                      className="btn btn-danger px-2.5! py-1! text-[0.66rem]!"
                      onClick={() => remove(r)}
                      disabled={busy}
                      title={
                        r.holders > 0
                          ? "Players hold this badge — disable it instead"
                          : "Delete"
                      }
                    >
                      <IconTrash />
                    </button>
                  </div>
                </td>
              </tr>
            ))}

            {rows?.length === 0 && (
              <EmptyRow colSpan={6}>
                No badges defined.
                <button className="btn btn-primary mt-1" onClick={restore}>
                  Restore the defaults
                </button>
              </EmptyRow>
            )}
          </tbody>
        </table>

        {!rows && (
          <div className="flex h-40 items-center justify-center">
            <Spinner />
          </div>
        )}
      </div>
    </div>
  );
}
