"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  CreateFixtureInput,
  Difficulty,
  LeagueFixtureView,
  LeagueProblemOption,
  LeagueRound,
  LeagueTeamView,
} from "@repo/protocol";
import { ErrorBanner, Spinner } from "../atoms";
import { ApiCallError, fetchLeagueProblemOptions } from "../../lib/api";

/**
 * The host's match-maker: pick two teams, choose the problems, set the clock.
 *
 * WHY PROBLEMS ARE A LIST OF SLOTS RATHER THAN A MULTI-SELECT
 * -----------------------------------------------------------
 * A match is a series played in order, so the ORDER of the problems is
 * meaningful — problem 1 is played first and may decide the tie before
 * problem 3 is reached. A multi-select would throw that ordering away. Each
 * slot is also independently allowed to be "let the system pick", which is a
 * per-slot decision a single control could not express.
 */
export function ScheduleMatch({
  teams,
  token,
  onCreate,
  onCancel,
  busy,
  editing,
}: {
  teams: LeagueTeamView[];
  token: string;
  onCreate: (input: CreateFixtureInput) => void | Promise<void>;
  onCancel: () => void;
  busy: boolean;
  /**
   * An existing fixture, when the host is editing rather than creating.
   *
   * The same form does both because they ask for exactly the same things —
   * a second near-identical component would be two places to fix every time
   * the fields change. Only the teams differ: they are fixed on an edit,
   * because changing who is playing is a different match, not an edit.
   */
  editing?: LeagueFixtureView | null;
}) {
  // Only full teams can be scheduled — the server refuses the rest, and
  // offering them here would just produce a rejection the host has to read.
  const eligible = useMemo(() => teams.filter((t) => t.isFull), [teams]);

  const [homeTeamId, setHome] = useState(
    editing?.homeTeamId ?? eligible[0]?.id ?? "",
  );
  const [awayTeamId, setAway] = useState(
    editing?.awayTeamId ?? eligible[1]?.id ?? "",
  );
  const [round, setRound] = useState<LeagueRound>(editing?.round ?? "GROUP");
  const [minutes, setMinutes] = useState(
    editing ? Math.round(editing.timeLimitSec / 60) : 30,
  );
  const [difficulty, setDifficulty] = useState<Difficulty>(
    editing?.difficulty ?? "MEDIUM",
  );
  /** One entry per leg. "" means let the system choose. */
  const [legs, setLegs] = useState<string[]>(
    editing ? editing.legs.map((l) => l.problemId ?? "") : [""],
  );

  const [options, setOptions] = useState<LeagueProblemOption[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetchLeagueProblemOptions(token)
      .then((res) => alive && setOptions(res.rows))
      .catch((e) =>
        alive &&
        setLoadError(
          e instanceof ApiCallError
            ? e.message
            : "Could not load the problem list.",
        ),
      );
    return () => {
      alive = false;
    };
  }, [token]);

  const valid =
    homeTeamId !== "" && awayTeamId !== "" && homeTeamId !== awayTeamId;

  function submit() {
    if (!valid) return;
    void onCreate({
      homeTeamId,
      awayTeamId,
      round,
      timeLimitSec: minutes * 60,
      difficulty,
      legs: legs.map((id) => ({ problemId: id === "" ? null : id })),
      scheduledAt: null,
    });
  }

  // Editing an existing fixture is always possible: its teams were already
  // full when it was created, so the "need two full teams" guard below is
  // about CREATING one and would wrongly block an edit.
  if (!editing && eligible.length < 2) {
    return (
      <div className="panel p-5">
        <h3 className="text-[0.95rem] font-bold">Schedule a match</h3>
        <p
          className="mt-2 font-mono text-[0.74rem] leading-relaxed"
          style={{ color: "var(--color-ink-dim)" }}
        >
          You need at least two teams with a full roster. Right now{" "}
          {eligible.length === 0 ? "none are" : "only one is"} ready — a match
          cannot start until both sides have every seat filled.
        </p>
        <button className="btn btn-ghost mt-4" onClick={onCancel}>
          Close
        </button>
      </div>
    );
  }

  return (
    <div className="panel p-5">
      <h3 className="text-[0.95rem] font-bold">
        {editing ? "Edit match" : "Schedule a match"}
      </h3>

      {/* --- the pairing --- */}
      {editing ? (
        <p
          className="mt-3 font-mono text-[0.76rem]"
          style={{ color: "var(--color-ink-dim)" }}
        >
          <strong style={{ color: "var(--color-ink)" }}>
            {editing.homeTeamName}
          </strong>{" "}
          vs{" "}
          <strong style={{ color: "var(--color-ink)" }}>
            {editing.awayTeamName}
          </strong>
          <span
            className="ml-2"
            style={{ color: "var(--color-ink-ghost)" }}
          >
            — to change who plays, call this match off and schedule a new one
          </span>
        </p>
      ) : (
      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto_1fr]">
        <TeamPicker
          label="Home team"
          value={homeTeamId}
          onChange={setHome}
          teams={eligible}
          exclude={awayTeamId}
        />
        <span
          className="hidden self-end pb-2.5 font-mono text-[0.72rem] sm:block"
          style={{ color: "var(--color-ink-ghost)" }}
        >
          vs
        </span>
        <TeamPicker
          label="Away team"
          value={awayTeamId}
          onChange={setAway}
          teams={eligible}
          exclude={homeTeamId}
        />
      </div>
      )}

      {/* --- the problems --- */}
      <div className="mt-5">
        <div className="flex items-baseline justify-between gap-3">
          <label className="label">Problems, in playing order</label>
          <span
            className="font-mono text-[0.64rem]"
            style={{ color: "var(--color-ink-ghost)" }}
          >
            best of {legs.length}
          </span>
        </div>

        <div className="mt-2 flex flex-col gap-2">
          {legs.map((value, i) => (
            <div key={i} className="flex items-center gap-2">
              <span
                className="w-4 shrink-0 font-mono text-[0.7rem]"
                style={{ color: "var(--color-ink-ghost)" }}
              >
                {i + 1}
              </span>
              <select
                className="field min-w-0 flex-1"
                value={value}
                onChange={(e) =>
                  setLegs((prev) =>
                    prev.map((v, j) => (j === i ? e.target.value : v)),
                  )
                }
              >
                <option value="">Random problem ({difficulty.toLowerCase()})</option>
                {options.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title} · {p.difficulty.toLowerCase()}
                  </option>
                ))}
              </select>
              {legs.length > 1 && (
                <button
                  className="shrink-0 px-1 font-mono text-[0.9rem]"
                  style={{ color: "var(--color-ink-ghost)" }}
                  title="Remove this problem"
                  onClick={() =>
                    setLegs((prev) => prev.filter((_, j) => j !== i))
                  }
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>

        {legs.length < 5 && (
          <button
            className="btn btn-ghost mt-2 px-3! py-1! text-[0.68rem]!"
            onClick={() => setLegs((prev) => [...prev, ""])}
          >
            + Add another problem
          </button>
        )}

        <p
          className="mt-2 font-mono text-[0.64rem] leading-[1.6]"
          style={{ color: "var(--color-ink-ghost)" }}
        >
          Each problem is one battle. Win the most and you win the match — a
          best of three stops at 2&ndash;0. Leave one on Random and the arena
          picks it at kick-off.
        </p>
      </div>

      {/* --- settings --- */}
      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="fx-minutes" className="label">
            Minutes per problem
          </label>
          <input
            id="fx-minutes"
            type="number"
            className="field"
            min={1}
            max={120}
            value={minutes}
            onChange={(e) =>
              setMinutes(Math.max(1, Math.min(120, Number(e.target.value) || 1)))
            }
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="fx-difficulty" className="label">
            Random difficulty
          </label>
          <select
            id="fx-difficulty"
            className="field"
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value as Difficulty)}
          >
            <option value="EASY">Easy</option>
            <option value="MEDIUM">Medium</option>
            <option value="HARD">Hard</option>
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="fx-round" className="label">
            Stage
          </label>
          <select
            id="fx-round"
            className="field"
            value={round}
            onChange={(e) => setRound(e.target.value as LeagueRound)}
          >
            <option value="GROUP">Group stage</option>
            <option value="QUARTER_FINAL">Quarter-final</option>
            <option value="SEMI_FINAL">Semi-final</option>
            <option value="FINAL">Final</option>
          </select>
        </div>
      </div>

      {loadError && (
        <div className="mt-4">
          <ErrorBanner message={loadError} />
        </div>
      )}

      <div className="mt-5 flex flex-wrap gap-2.5">
        <button
          className="btn btn-primary"
          onClick={submit}
          disabled={!valid || busy}
        >
          {busy ? <Spinner /> : editing ? "Save changes" : "Schedule match"}
        </button>
        <button className="btn btn-ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function TeamPicker({
  label,
  value,
  onChange,
  teams,
  exclude,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  teams: LeagueTeamView[];
  exclude: string;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label className="label">{label}</label>
      <select
        className="field"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Pick a team</option>
        {teams
          // A team cannot play itself, so the other side's choice is gone
          // from this list rather than being accepted and then refused.
          .filter((t) => t.id !== exclude)
          .map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
      </select>
    </div>
  );
}
