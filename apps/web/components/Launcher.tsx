"use client";

import { useState } from "react";
import type { Difficulty, Mode } from "@repo/protocol";
import { createBattle, joinBattle, ApiCallError } from "../lib/api.js";
import type { Session } from "../lib/session.js";
import { modeLabel } from "../lib/format.js";
import { ErrorBanner, Spinner } from "./atoms.js";

type Tab = "create" | "join";

const MODES: Mode[] = ["ONE_V_ONE", "TWO_V_TWO", "THREE_V_THREE", "FOUR_V_FOUR"];
const DIFFICULTIES: Difficulty[] = ["EASY", "MEDIUM", "HARD"];
const TIMES = [
  { label: "5 min", sec: 300 },
  { label: "10 min", sec: 600 },
  { label: "20 min", sec: 1200 },
];

/**
 * The signed-in launcher: create a new battle (host) or join one by room code.
 * On success it hands the battleId up so the page can route into the lobby.
 */
export function Launcher({
  session,
  onEnterBattle,
}: {
  session: Session;
  onEnterBattle: (battleId: string) => void;
}) {
  const [tab, setTab] = useState<Tab>("create");
  const [mode, setMode] = useState<Mode>("ONE_V_ONE");
  const [difficulty, setDifficulty] = useState<Difficulty>("EASY");
  const [timeSec, setTimeSec] = useState(600);
  const [roomCode, setRoomCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onCreate() {
    setBusy(true);
    setError(null);
    try {
      const res = await createBattle(session.token, {
        mode,
        difficulty,
        timeLimitSec: timeSec,
      });
      onEnterBattle(res.battleId);
    } catch (err) {
      setError(err instanceof ApiCallError ? err.message : "Couldn't create.");
      setBusy(false);
    }
  }

  async function onJoin() {
    const code = roomCode.trim().toUpperCase();
    if (code.length < 4) return;
    setBusy(true);
    setError(null);
    try {
      const res = await joinBattle(session.token, code);
      onEnterBattle(res.battleId);
    } catch (err) {
      setError(
        err instanceof ApiCallError ? err.message : "Couldn't join room.",
      );
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Segmented tabs */}
      <div
        className="grid grid-cols-2 gap-1 rounded-[10px] p-1"
        style={{ background: "var(--color-surface-3)" }}
      >
        {(["create", "join"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => {
              setTab(t);
              setError(null);
            }}
            className="rounded-[7px] py-2 text-sm font-medium capitalize transition-colors"
            style={
              tab === t
                ? { background: "var(--color-surface)", color: "var(--color-ink)" }
                : { color: "var(--color-ink-faint)" }
            }
          >
            {t === "create" ? "Create battle" : "Join battle"}
          </button>
        ))}
      </div>

      {tab === "create" ? (
        <div className="flex flex-col gap-4">
          <Field label="Mode">
            <OptionRow
              options={MODES.map((m) => ({
                value: m,
                label: modeLabel(m),
                disabled: m !== "ONE_V_ONE",
              }))}
              value={mode}
              onChange={(v) => setMode(v as Mode)}
            />
            <p className="mt-1.5 text-xs" style={{ color: "var(--color-ink-faint)" }}>
              Team modes are coming soon — 1v1 is live.
            </p>
          </Field>

          <Field label="Difficulty">
            <OptionRow
              options={DIFFICULTIES.map((d) => ({
                value: d,
                label: d.charAt(0) + d.slice(1).toLowerCase(),
              }))}
              value={difficulty}
              onChange={(v) => setDifficulty(v as Difficulty)}
            />
          </Field>

          <Field label="Time limit">
            <OptionRow
              options={TIMES.map((t) => ({ value: String(t.sec), label: t.label }))}
              value={String(timeSec)}
              onChange={(v) => setTimeSec(Number(v))}
            />
          </Field>

          {error && <ErrorBanner message={error} />}

          <button className="btn btn-primary" onClick={onCreate} disabled={busy}>
            {busy ? <Spinner /> : "Create & host"}
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <Field label="Room code">
            <input
              className="field text-center text-lg font-mono tracking-[0.3em] uppercase"
              placeholder="ABCD"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              maxLength={12}
              autoComplete="off"
              onKeyDown={(e) => e.key === "Enter" && onJoin()}
            />
          </Field>

          {error && <ErrorBanner message={error} />}

          <button
            className="btn btn-primary"
            onClick={onJoin}
            disabled={busy || roomCode.trim().length < 4}
          >
            {busy ? <Spinner /> : "Join room"}
          </button>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="label">{label}</span>
      {children}
    </div>
  );
}

/** A row of mutually-exclusive segmented options. */
function OptionRow({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string; disabled?: boolean }[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            disabled={o.disabled}
            onClick={() => onChange(o.value)}
            className="rounded-[9px] border px-3.5 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-35"
            style={
              active
                ? {
                    borderColor:
                      "color-mix(in srgb, var(--color-accent) 45%, transparent)",
                    background:
                      "color-mix(in srgb, var(--color-accent) 14%, transparent)",
                    color: "var(--color-accent)",
                  }
                : {
                    borderColor: "var(--color-line)",
                    background: "var(--color-surface-2)",
                    color: "var(--color-ink-dim)",
                  }
            }
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
