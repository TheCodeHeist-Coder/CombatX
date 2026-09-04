"use client";

import { useEffect, useState } from "react";
import {
  BadgeCategoryEnum,
  BadgeComparatorEnum,
  BadgeMetricEnum,
  BadgeRarityEnum,
  type AdminBadgeCondition,
  type AdminBadgeRow,
} from "@repo/protocol";
import { METRIC_LABELS, type BadgeMetric } from "@repo/game";
import { ErrorBanner, IconPlus, IconTrash, Spinner } from "../atoms";
import { CRESTS } from "./crests";
import { Medal } from "./Medal";
import { RARITY_TONE } from "./tones";

/**
 * The create/edit form for one badge.
 *
 * Everything a badge is made of is editable here except its KEY, which is set
 * once and then permanent: UserBadge rows reference it, so changing it would
 * orphan every award already handed out. Renaming the label is free and is
 * what an operator almost always means by "rename this badge".
 *
 * The conditions editor is a list of rows rather than an expression builder.
 * Rules are ANDed, which covers the whole shipped set and keeps the form
 * something an operator can read at a glance — a boolean tree would be more
 * expressive and much easier to get wrong.
 */
export function BadgeEditor({
  initial,
  busy,
  error,
  onSave,
  onCancel,
  onPreview,
}: {
  /** Null when creating. */
  initial: AdminBadgeRow | null;
  busy: boolean;
  error: string | null;
  onSave: (draft: Draft) => void;
  onCancel: () => void;
  onPreview: (conditions: AdminBadgeCondition[]) => Promise<PreviewResult>;
}) {
  const creating = initial === null;

  const [key, setKey] = useState(initial?.key ?? "");
  const [label, setLabel] = useState(initial?.label ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [category, setCategory] = useState(initial?.category ?? "MILESTONE");
  const [rarity, setRarity] = useState(initial?.rarity ?? "COMMON");
  const [artKey, setArtKey] = useState(initial?.artKey ?? "FIRST_BLOOD");
  // The glyph is only ever drawn when a badge has no artwork, so it is not
  // worth a form field: keep an existing one, or derive it from the name.
  const glyph = initial?.glyph ?? "";
  const [enabled, setEnabled] = useState(initial?.enabled ?? true);
  const [sortOrder, setSortOrder] = useState(initial?.sortOrder ?? 500);
  const [conditions, setConditions] = useState<AdminBadgeCondition[]>(
    initial?.conditions ?? [{ metric: "wins", comparator: "gte", threshold: 10 }],
  );
  const [progressFrom, setProgressFrom] = useState<number | null>(
    initial?.progressFrom ?? 0,
  );
  const [repeatEvery, setRepeatEvery] = useState<number | null>(
    initial?.repeatEvery ?? null,
  );

  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [previewing, setPreviewing] = useState(false);

  // The preview is the answer to "if I set this to 50, who gets it?" — the
  // question an operator actually has. Re-run when the conditions settle,
  // debounced so dragging a number does not fire a request per keystroke.
  useEffect(() => {
    let alive = true;
    setPreviewing(true);
    const t = setTimeout(() => {
      onPreview(conditions)
        .then((r) => alive && setPreview(r))
        .catch(() => alive && setPreview(null))
        .finally(() => alive && setPreviewing(false));
    }, 450);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [conditions, onPreview]);

  const keyValid = /^[A-Z][A-Z0-9_]*$/.test(key);
  const canSave =
    label.trim() !== "" &&
    description.trim() !== "" &&
    conditions.length > 0 &&
    (!creating || keyValid);

  function setCondition(i: number, patch: Partial<AdminBadgeCondition>) {
    setConditions((cs) => cs.map((c, n) => (n === i ? { ...c, ...patch } : c)));
  }

  function removeCondition(i: number) {
    setConditions((cs) => cs.filter((_, n) => n !== i));
    // The progress index points into this list, so it has to move with it —
    // otherwise it would silently start pointing at a different condition.
    setProgressFrom((p) => {
      if (p === null) return null;
      if (p === i) return null;
      return p > i ? p - 1 : p;
    });
  }

  return (
    <div className="flex flex-col gap-5">
      {error && <ErrorBanner message={error} />}

      <div className="grid gap-5 lg:grid-cols-[1fr_260px]">
        <div className="flex flex-col gap-4">
          {/* --- Identity --- */}
          <section className="panel p-5">
            <h3 className="label">Identity</h3>

            <div className="mt-3.5 grid gap-3.5 sm:grid-cols-2">
              <Field label="Name">
                <input
                  className="field"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="Centurion"
                  maxLength={40}
                />
              </Field>

              <Field
                label="Key"
                hint={
                  creating
                    ? "CAPITALS_AND_UNDERSCORES. Permanent once saved."
                    : "Permanent — awards reference it."
                }
              >
                <input
                  className="field"
                  value={key}
                  onChange={(e) => setKey(e.target.value.toUpperCase())}
                  placeholder="HUNDRED_WINS"
                  disabled={!creating}
                  style={{ opacity: creating ? 1 : 0.55 }}
                />
                {creating && key !== "" && !keyValid && (
                  <p className="mt-1 text-[0.66rem]" style={{ color: "var(--color-bad)" }}>
                    Use capitals, digits and underscores, starting with a letter.
                  </p>
                )}
              </Field>
            </div>

            <div className="mt-3.5">
              <Field label="Description" hint="Shown on hover. Past tense.">
                <input
                  className="field"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Won 100 battles."
                  maxLength={200}
                />
              </Field>
            </div>

            <div className="mt-3.5 grid gap-3.5 sm:grid-cols-3">
              <Field label="Category">
                <select
                  className="field"
                  value={category}
                  onChange={(e) => setCategory(e.target.value as typeof category)}
                >
                  {BadgeCategoryEnum.options.map((c) => (
                    <option key={c} value={c}>
                      {c.charAt(0) + c.slice(1).toLowerCase()}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Rarity" hint="Sets the medal's rim colour.">
                <select
                  className="field"
                  value={rarity}
                  onChange={(e) => setRarity(e.target.value as typeof rarity)}
                >
                  {BadgeRarityEnum.options.map((r) => (
                    <option key={r} value={r}>
                      {r.charAt(0) + r.slice(1).toLowerCase()}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Order" hint="Lower sorts first.">
                <input
                  className="field"
                  type="number"
                  value={sortOrder}
                  min={0}
                  onChange={(e) => setSortOrder(Number(e.target.value) || 0)}
                />
              </Field>
            </div>
          </section>

          {/* --- Conditions --- */}
          <section className="panel p-5">
            <div className="flex items-baseline justify-between">
              <h3 className="label">Criteria</h3>
              <span
                className="font-mono text-[0.64rem]"
                style={{ color: "var(--color-ink-ghost)" }}
              >
                all must be true
              </span>
            </div>

            <div className="mt-3.5 flex flex-col gap-2.5">
              {conditions.map((c, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2">
                  <select
                    className="field flex-1"
                    style={{ minWidth: 170 }}
                    value={c.metric}
                    onChange={(e) =>
                      setCondition(i, { metric: e.target.value as typeof c.metric })
                    }
                  >
                    {BadgeMetricEnum.options.map((m) => (
                      <option key={m} value={m}>
                        {METRIC_LABELS[m as BadgeMetric] ?? m}
                      </option>
                    ))}
                  </select>

                  <select
                    className="field"
                    style={{ width: 132 }}
                    value={c.comparator}
                    onChange={(e) =>
                      setCondition(i, {
                        comparator: e.target.value as typeof c.comparator,
                      })
                    }
                  >
                    {BadgeComparatorEnum.options.map((o) => (
                      <option key={o} value={o}>
                        {o === "gte" ? "at least" : "at most"}
                      </option>
                    ))}
                  </select>

                  <input
                    className="field"
                    style={{ width: 112 }}
                    type="number"
                    value={c.threshold}
                    min={0}
                    onChange={(e) =>
                      setCondition(i, { threshold: Number(e.target.value) || 0 })
                    }
                  />

                  <button
                    className="btn btn-ghost px-2! py-1.5!"
                    onClick={() => removeCondition(i)}
                    disabled={conditions.length === 1}
                    title={
                      conditions.length === 1
                        ? "A badge needs at least one condition"
                        : "Remove"
                    }
                  >
                    <IconTrash />
                  </button>
                </div>
              ))}
            </div>

            <button
              className="btn btn-ghost mt-3 text-[0.7rem]!"
              onClick={() =>
                setConditions((cs) => [
                  ...cs,
                  { metric: "wins", comparator: "gte", threshold: 1 },
                ])
              }
              disabled={conditions.length >= 6}
            >
              <IconPlus /> Add condition
            </button>

            <div
              className="mt-4 border-t pt-3.5"
              style={{ borderColor: "var(--color-line)" }}
            >
              <Field
                label="Progress bar"
                hint="Which condition the locked-badge bar tracks."
              >
                <select
                  className="field"
                  value={progressFrom === null ? "none" : String(progressFrom)}
                  onChange={(e) =>
                    setProgressFrom(
                      e.target.value === "none" ? null : Number(e.target.value),
                    )
                  }
                >
                  <option value="none">No progress bar</option>
                  {conditions.map((c, i) => (
                    <option key={i} value={i}>
                      {METRIC_LABELS[c.metric as BadgeMetric] ?? c.metric}
                    </option>
                  ))}
                </select>
              </Field>

              {/*
                Repeatable badges. Only meaningful alongside a progress bar,
                because the multiplier counts the SAME metric the bar tracks —
                so the control is hidden when there is nothing to count.
              */}
              {progressFrom !== null && (
                <div className="mt-3.5">
                  <Field
                    label="Repeatable"
                    hint="Award another copy every N. Shows as x2, x3 on the medal."
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={repeatEvery !== null}
                        onChange={(e) =>
                          setRepeatEvery(e.target.checked ? 1 : null)
                        }
                      />
                      {repeatEvery !== null && (
                        <input
                          className="field max-w-24"
                          type="number"
                          min={1}
                          value={repeatEvery}
                          onChange={(e) =>
                            setRepeatEvery(Math.max(1, Number(e.target.value)))
                          }
                        />
                      )}
                      <span
                        className="font-mono text-[0.68rem]"
                        style={{ color: "var(--color-ink-ghost)" }}
                      >
                        {repeatEvery === null
                          ? "Held once."
                          : `One copy per ${repeatEvery}.`}
                      </span>
                    </div>
                  </Field>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* --- Live preview --- */}
        <div className="flex flex-col gap-4">
          <section className="panel p-5">
            <h3 className="label">Preview</h3>
            <div className="mt-4 flex flex-col items-center gap-2.5">
              <Medal
                crest={CRESTS[artKey] ?? CRESTS.FIRST_BLOOD!}
                tone={RARITY_TONE[rarity] ?? RARITY_TONE.COMMON!}
                size={88}
                uid="preview"
                title={label}
              />
              <p className="text-center font-mono text-[0.72rem] font-bold">
                {label || "Unnamed"}
              </p>
              <p
                className="text-center font-mono text-[0.62rem] leading-snug"
                style={{ color: "var(--color-ink-faint)" }}
              >
                {description || "No description yet"}
              </p>
            </div>
          </section>

          <section className="panel p-5">
            <h3 className="label">Artwork</h3>
            <p
              className="mt-1.5 font-mono text-[0.62rem]"
              style={{ color: "var(--color-ink-ghost)" }}
            >
              {CRESTS[artKey]?.animal ?? "—"}
            </p>
            {/* Height is a whole number of 34px rows plus gaps, so the grid
                never ends with a half-visible row of medals. */}
            <div
              className="mt-3 grid grid-cols-5 gap-1.5 overflow-y-auto pr-1"
              style={{ maxHeight: 216 }}
            >
              {Object.entries(CRESTS).map(([k, crest]) => (
                <button
                  key={k}
                  onClick={() => setArtKey(k)}
                  title={crest.animal}
                  className="rounded-[6px] p-1 transition-colors"
                  style={{
                    background:
                      artKey === k ? "var(--color-surface-4)" : "transparent",
                    outline:
                      artKey === k
                        ? "1px solid var(--color-primary)"
                        : "1px solid transparent",
                  }}
                >
                  <Medal
                    crest={crest}
                    tone={RARITY_TONE[rarity] ?? RARITY_TONE.COMMON!}
                    size={34}
                    uid={`pick-${k}`}
                  />
                </button>
              ))}
            </div>
          </section>

          <section className="panel p-5">
            <h3 className="label">Who qualifies now</h3>
            {previewing ? (
              <div className="mt-3 flex justify-center">
                <Spinner />
              </div>
            ) : preview ? (
              <>
                <p className="mt-2.5 font-mono text-2xl font-bold tabular-nums">
                  {preview.matches}
                  <span
                    className="text-[0.7rem] font-normal"
                    style={{ color: "var(--color-ink-faint)" }}
                  >
                    {" "}
                    / {preview.totalUsers}
                  </span>
                </p>
                <p
                  className="mt-1.5 font-mono text-[0.64rem] leading-snug"
                  style={{ color: "var(--color-ink-faint)" }}
                >
                  {preview.summary}
                </p>
              </>
            ) : (
              <p
                className="mt-2.5 font-mono text-[0.66rem]"
                style={{ color: "var(--color-ink-ghost)" }}
              >
                Could not check.
              </p>
            )}
            <p
              className="mt-3 font-mono text-[0.6rem] leading-relaxed"
              style={{ color: "var(--color-ink-ghost)" }}
            >
              Saving does not award anything retroactively. Use Recalculate on
              the badge list to apply rules to existing players.
            </p>
          </section>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          className="btn btn-primary"
          disabled={busy || !canSave}
          onClick={() =>
            onSave({
              key,
              label: label.trim(),
              description: description.trim(),
              category,
              rarity,
              artKey,
              glyph: glyph || label.charAt(0).toUpperCase() || "X",
              conditions,
              progressFrom,
              repeatEvery,
              enabled,
              sortOrder,
            })
          }
        >
          {busy ? <Spinner /> : creating ? "Create badge" : "Save changes"}
        </button>

        <button className="btn btn-ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </button>

        <label className="ml-auto flex cursor-pointer items-center gap-2 font-mono text-[0.72rem]">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
          />
          Enabled
        </label>
      </div>
    </div>
  );
}

export interface Draft {
  key: string;
  label: string;
  description: string;
  category: AdminBadgeRow["category"];
  rarity: AdminBadgeRow["rarity"];
  artKey: string;
  glyph: string;
  conditions: AdminBadgeCondition[];
  progressFrom: number | null;
  repeatEvery: number | null;
  enabled: boolean;
  sortOrder: number;
}

export interface PreviewResult {
  matches: number;
  totalUsers: number;
  summary: string;
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="label">{label}</span>
      {children}
      {hint && (
        <span
          className="font-mono text-[0.6rem] leading-snug"
          style={{ color: "var(--color-ink-ghost)" }}
        >
          {hint}
        </span>
      )}
    </div>
  );
}
