"use client";

import { useState } from "react";
import type {
  LeagueStandingsResponse,
  QualificationMode,
  RoundPreview,
} from "@repo/protocol";
import { Spinner } from "../atoms";

/**
 * The knockout controls: set the rule, then draw each round.
 *
 * WHY THE DRAW IS PREVIEWED
 * -------------------------
 * Drawing a round creates matches that real people arrange their evening
 * around, and there is no undo that gets that evening back. So the host is
 * shown exactly who qualified and who would play whom BEFORE anything is
 * written, and presses the button knowing the answer.
 *
 * The panel is host-only. A competitor sees the same information in the
 * standings table — the qualification line and their own position — but
 * cannot act on it.
 */
export function RoundDraw({
  standings,
  onSetRule,
  onDraw,
  onScheduleTiebreak,
  busy,
}: {
  standings: LeagueStandingsResponse;
  onSetRule: (
    rule: { mode: QualificationMode; value: number } | null,
  ) => void | Promise<void>;
  onDraw: () => void | Promise<void>;
  onScheduleTiebreak: () => void | Promise<void>;
  busy: boolean;
}) {
  const [mode, setMode] = useState<QualificationMode>(
    standings.qualifyMode ?? "TOP_N",
  );
  const [value, setValue] = useState(standings.qualifyValue ?? 2);

  const preview = standings.preview;
  const hasRule = standings.qualifyMode !== null;

  return (
    <section className="panel p-5">
      <h2 className="text-[0.95rem] font-bold">Knockout</h2>

      {/* --- the rule --- */}
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="qual-mode" className="label">
            Who advances
          </label>
          <select
            id="qual-mode"
            className="field"
            value={mode}
            onChange={(e) => setMode(e.target.value as QualificationMode)}
          >
            <option value="TOP_N">Top N in the table</option>
            <option value="WIN_COUNT">Everyone with N wins</option>
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="qual-value" className="label">
            {mode === "TOP_N" ? "Places" : "Wins needed"}
          </label>
          <input
            id="qual-value"
            type="number"
            className="field w-24"
            min={1}
            max={64}
            value={value}
            onChange={(e) =>
              setValue(Math.max(1, Math.min(64, Number(e.target.value) || 1)))
            }
          />
        </div>

        <button
          className="btn btn-ghost"
          disabled={busy}
          onClick={() => void onSetRule({ mode, value })}
        >
          {busy ? <Spinner /> : hasRule ? "Update rule" : "Set rule"}
        </button>

        {hasRule && (
          <button
            className="btn btn-ghost"
            style={{ color: "var(--color-ink-faint)" }}
            disabled={busy}
            onClick={() => void onSetRule(null)}
            title="Go back to a plain table with no knockout"
          >
            Clear
          </button>
        )}
      </div>

      {!hasRule && (
        <p
          className="mt-3 font-mono text-[0.7rem] leading-[1.7]"
          style={{ color: "var(--color-ink-faint)" }}
        >
          Without a rule this league is simply a table of matches — which is a
          perfectly good league. Set one to run a knockout on top of it.
        </p>
      )}

      {/* --- the draw --- */}
      {preview && (
        <DrawPreview
          preview={preview}
          onDraw={onDraw}
          onScheduleTiebreak={onScheduleTiebreak}
          busy={busy}
        />
      )}
    </section>
  );
}

function DrawPreview({
  preview,
  onDraw,
  onScheduleTiebreak,
  busy,
}: {
  preview: RoundPreview;
  onDraw: () => void | Promise<void>;
  onScheduleTiebreak: () => void | Promise<void>;
  busy: boolean;
}) {
  // An ambiguous cut is a blocker, not a note: the server refuses the draw,
  // so offering the button would promise something that cannot happen.
  const ready =
    preview.blockedReason === null &&
    !preview.ambiguousCut &&
    preview.pairings.length > 0;

  return (
    <div
      className="mt-5 border-t pt-4"
      style={{ borderColor: "var(--color-line)" }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-[0.85rem] font-bold">
          {ROUND_LABEL[preview.round]}
        </h3>
        {ready && (
          <button className="btn btn-primary" onClick={() => void onDraw()} disabled={busy}>
            {busy ? <Spinner /> : `Draw the ${ROUND_LABEL[preview.round].toLowerCase()}`}
          </button>
        )}
      </div>

      {/*
        The blocker is stated plainly, because every one of them is something
        the host has to go and do — play a match, or settle a level tie.
      */}
      {preview.blockedReason && (
        <p
          className="mt-2 font-mono text-[0.72rem]"
          style={{ color: "var(--color-warn)" }}
        >
          {preview.blockedReason}
        </p>
      )}

      {/*
        An unbreakable tie is resolved by PLAYING, not by guessing.

        Neither the server nor the host should pick between teams that are
        level on every measure — one would be inventing a result, the other
        would be eliminating a team that was never beaten. So the tied teams
        are offered a decider, which is how real tournaments settle this.
      */}
      {preview.tiebreak && (
        <div
          className="mt-3 rounded-[8px] border p-3"
          style={{
            borderColor: "var(--color-warn)",
            background: "color-mix(in srgb, var(--color-warn) 8%, transparent)",
          }}
        >
          <p
            className="font-mono text-[0.72rem] leading-[1.7]"
            style={{ color: "var(--color-warn)" }}
          >
            {preview.tiebreak.teams.map((t) => t.teamName).join(" and ")} are
            level on every tie-break, with{" "}
            {preview.tiebreak.places === 1
              ? "one place"
              : `${preview.tiebreak.places} places`}{" "}
            between them.
          </p>

          {preview.tiebreak.scheduled ? (
            <p
              className="mt-1.5 font-mono text-[0.7rem]"
              style={{ color: "var(--color-ink-dim)" }}
            >
              A decider is scheduled — play it and the winner takes the place.
            </p>
          ) : (
            <>
              <p
                className="mt-1.5 font-mono text-[0.7rem]"
                style={{ color: "var(--color-ink-dim)" }}
              >
                Let them play for it. The winner goes through.
              </p>
              <button
                className="btn btn-accent mt-3 px-4! py-1.5! text-[0.72rem]!"
                onClick={() => void onScheduleTiebreak()}
                disabled={busy}
              >
                {busy ? <Spinner /> : "Schedule a decider"}
              </button>
            </>
          )}
        </div>
      )}

      {/*
        While a tie is unresolved the pairings below are a FICTION — they are
        what the seeding would produce from an over-full field, which is
        exactly the unfair bracket the decider exists to prevent. Showing them
        under a box that says "this cannot be drawn yet" contradicts it, so
        they are withheld until the field is settled.
      */}
      {preview.pairings.length > 0 && !preview.tiebreak && (
        <div className="mt-3 flex flex-col gap-1.5">
          {preview.pairings.map((p) => (
            <div
              key={`${p.homeTeamId}-${p.awayTeamId}`}
              className="flex items-center gap-3 rounded-[6px] px-3 py-2"
              style={{ background: "var(--color-surface-2)" }}
            >
              <span className="min-w-0 flex-1 truncate text-right text-[0.8rem] font-bold">
                {p.homeTeamName}
              </span>
              <span
                className="shrink-0 font-mono text-[0.66rem]"
                style={{ color: "var(--color-ink-ghost)" }}
              >
                vs
              </span>
              <span className="min-w-0 flex-1 truncate text-[0.8rem] font-bold">
                {p.awayTeamName}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* A bye is easy to miss and unfair if it goes unnoticed, so it is
          stated rather than being left implicit in a short pairing list. */}
      {preview.byeTeamName && !preview.tiebreak && (
        <p
          className="mt-2 font-mono text-[0.7rem]"
          style={{ color: "var(--color-ink-dim)" }}
        >
          <strong style={{ color: "var(--color-accent)" }}>
            {preview.byeTeamName}
          </strong>{" "}
          advances unopposed — the field is an odd number, so the top seed gets
          a bye.
        </p>
      )}

      {!ready && preview.pairings.length === 0 && !preview.blockedReason && (
        <p
          className="mt-2 font-mono text-[0.72rem]"
          style={{ color: "var(--color-ink-faint)" }}
        >
          Nothing to draw yet.
        </p>
      )}
    </div>
  );
}

const ROUND_LABEL: Record<RoundPreview["round"], string> = {
  GROUP: "Group stage",
  TIEBREAK: "Decider",
  QUARTER_FINAL: "Quarter-finals",
  SEMI_FINAL: "Semi-finals",
  FINAL: "Final",
};
