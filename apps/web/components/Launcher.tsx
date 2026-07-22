"use client";

import { useState } from "react";
import type { Difficulty, Mode } from "@repo/protocol";
import { createBattle, joinBattle, ApiCallError } from "../lib/api";
import type { Session } from "../lib/session";
import { modeLabel } from "../lib/format";
import { ErrorBanner, Spinner } from "./atoms";

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
  onDark = false,
}: {
  session: Session;
  onEnterBattle: (battleId: string) => void;
  /** Re-tint for the maroon deploy panel. */
  onDark?: boolean;
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

  const sand = "var(--color-sand)";
  const dimOnDark = "color-mix(in srgb, var(--color-sand) 60%, transparent)";

  return (
    <div className="flex flex-col gap-5">
      {/* Segmented tabs */}
      <div
        className="grid grid-cols-2 gap-1 p-1"
        style={{
          background: onDark
            ? "color-mix(in srgb, #000 20%, transparent)"
            : "var(--color-surface-3)",
        }}
      >
        {(["create", "join"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => {
              setTab(t);
              setError(null);
            }}
            className="py-2 font-mono text-[0.7rem] font-semibold uppercase tracking-wider transition-colors"
            style={
              tab === t
                ? onDark
                  ? { background: sand, color: "var(--color-primary)" }
                  : { background: "var(--color-primary)", color: sand }
                : { color: onDark ? dimOnDark : "var(--color-ink-faint)" }
            }
          >
            {t === "create" ? "Create_op" : "Join_op"}
          </button>
        ))}
      </div>

      {tab === "create" ? (
        <div className="flex flex-col gap-4">
          <Field label="Mode" onDark={onDark}>
            <OptionRow
              options={MODES.map((m) => ({
                value: m,
                label: modeLabel(m),
                disabled: m !== "ONE_V_ONE",
              }))}
              value={mode}
              onChange={(v) => setMode(v as Mode)}
              onDark={onDark}
            />
            <p
              className="mt-1.5 font-mono text-[0.66rem]"
              style={{ color: onDark ? dimOnDark : "var(--color-ink-faint)" }}
            >
              Team modes are modelled but gated — 1v1 is live.
            </p>
          </Field>

          <Field label="Difficulty" onDark={onDark}>
            <OptionRow
              options={DIFFICULTIES.map((d) => ({
                value: d,
                label: d.charAt(0) + d.slice(1).toLowerCase(),
              }))}
              value={difficulty}
              onChange={(v) => setDifficulty(v as Difficulty)}
              onDark={onDark}
            />
          </Field>

          <Field label="Time limit" onDark={onDark}>
            <OptionRow
              options={TIMES.map((t) => ({ value: String(t.sec), label: t.label }))}
              value={String(timeSec)}
              onChange={(v) => setTimeSec(Number(v))}
              onDark={onDark}
            />
          </Field>

          {error && <ErrorBanner message={error} />}

          <button
            className="btn btn-primary"
            onClick={onCreate}
            disabled={busy}
            style={onDark ? { background: sand, color: "var(--color-primary)" } : undefined}
          >
            {busy ? <Spinner /> : "Deploy_battle"}
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <Field label="Room code" onDark={onDark}>
            <input
              className="field text-center text-lg tracking-[0.3em] uppercase"
              style={
                onDark
                  ? {
                      background: "color-mix(in srgb, #000 22%, transparent)",
                      borderColor:
                        "color-mix(in srgb, var(--color-sand) 35%, transparent)",
                      color: sand,
                    }
                  : undefined
              }
              placeholder="X99-TA"
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
            style={onDark ? { background: sand, color: "var(--color-primary)" } : undefined}
          >
            {busy ? <Spinner /> : "Infiltrate_room"}
          </button>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  children,
  onDark = false,
}: {
  label: string;
  children: React.ReactNode;
  onDark?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span
        className="label"
        style={
          onDark
            ? { color: "color-mix(in srgb, var(--color-sand) 60%, transparent)" }
            : undefined
        }
      >
        {label}
      </span>
      {children}
    </div>
  );
}

/** A row of mutually-exclusive segmented options. */
function OptionRow({
  options,
  value,
  onChange,
  onDark = false,
}: {
  options: { value: string; label: string; disabled?: boolean }[];
  value: string;
  onChange: (value: string) => void;
  onDark?: boolean;
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
            className="border px-3 py-1.5 font-mono text-[0.7rem] uppercase tracking-wide transition-colors disabled:cursor-not-allowed disabled:opacity-35"
            style={
              active
                ? onDark
                  ? {
                      borderColor: "var(--color-sand)",
                      background: "var(--color-sand)",
                      color: "var(--color-primary)",
                    }
                  : {
                      borderColor: "var(--color-accent)",
                      background: "var(--color-blush)",
                      color: "var(--color-accent)",
                    }
                : onDark
                  ? {
                      borderColor:
                        "color-mix(in srgb, var(--color-sand) 28%, transparent)",
                      color: "color-mix(in srgb, var(--color-sand) 65%, transparent)",
                    }
                  : {
                      borderColor: "var(--color-line)",
                      background: "var(--color-surface)",
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
