"use client";

import { useEffect, useMemo, useState } from "react";
import type { Language, PlayerView, Side } from "@repo/protocol";
import { ErrorBanner, Spinner, Centered } from "../atoms";
import { AppShell } from "../AppShell";
import { ConnBadge } from "../ConnBadge";
import { Avatar } from "../avatar/Avatar";
import { Markdown } from "./Markdown";
import { Samples } from "./Samples";
import { CodeEditor } from "./CodeEditor";
import { BattleTimer } from "./BattleTimer";
import { TestChevrons } from "./TestChevrons";
import { SubmissionList } from "./SubmissionList";
import { JudgeFeed } from "./JudgeFeed";
import { CountdownOverlay } from "./CountdownOverlay";
import { selectMe, selectSideProgress } from "../../lib/battleState";
import { useCosmeticClock } from "../../lib/useCosmeticClock";
import { languageLabel } from "../../lib/format";
import type { BattleConnection } from "../../lib/useBattleConnection";
import type { Session } from "../../lib/session";

/**
 * The live battle.
 *
 * Top: the problem statement (with a test-cases tab) beside the judge feed.
 * Bottom: your editor and the opponent's progress panel, side by side, each
 * badged with its owner's character and test-case meter.
 */
export function Arena({
  conn,
  session,
}: {
  conn: BattleConnection;
  session: Session;
}) {
  const { state, status, submit } = conn;
  const snap = state.snapshot!;
  const problem = state.problem;
  const me = selectMe(state);
  const mySide: Side | null = me?.side ?? null;

  const remainingMs = useCosmeticClock(state.endAtMs, state.serverClockSkewMs);

  const languages = useMemo<Language[]>(
    () => problem?.allowedLanguages ?? ["PYTHON"],
    [problem],
  );
  const [language, setLanguage] = useState<Language>(languages[0] ?? "PYTHON");
  const [source, setSource] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const [tab, setTab] = useState<"task" | "tests">("task");

  // Seed the editor from starter code whenever the language (or problem)
  // changes — but never clobber edits the player has already made.
  useEffect(() => {
    if (!problem) return;
    if (touched) return;
    setSource(problem.starterCode[language] ?? "");
  }, [problem, language, touched]);

  async function onSubmit() {
    if (busy || !source.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await submit(language, source);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submit failed.");
    } finally {
      setBusy(false);
    }
  }

  const counting = snap.status === "COUNTDOWN" || state.countdownMs != null;

  if (!problem) {
    return (
      <AppShell session={session} right={<ConnBadge status={status} />}>
        {counting && state.countdownMs != null && (
          <CountdownOverlay startsInMs={state.countdownMs} />
        )}
        <Centered>
          <Spinner />
          <p className="text-sm" style={{ color: "var(--color-ink-dim)" }}>
            Revealing the problem…
          </p>
        </Centered>
      </AppShell>
    );
  }

  const oppSide: Side = mySide === "B" ? "A" : "B";
  const myProgress = mySide ? selectSideProgress(state, mySide) : null;
  const oppProgress = selectSideProgress(state, oppSide);
  const totalTests = problem.totalTests;

  // Opponents are everyone seated on the other side.
  const opponents = snap.players.filter((p) => p.side === oppSide);

  return (
    <AppShell
      session={session}
      right={
        <div className="flex items-center gap-3">
          <BattleTimer remainingMs={remainingMs} />
          <ConnBadge status={status} />
        </div>
      }
    >
      {counting && state.countdownMs != null && (
        <CountdownOverlay startsInMs={state.countdownMs} />
      )}

      <div className="mx-auto flex w-full max-w-[100rem] flex-col gap-4 p-4">
        {/* --- Top row: problem + judge feed --------------------------- */}
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
          {/* Problem, with the task / test-cases tabs from the reference. */}
          <section className="panel flex min-h-0 flex-col overflow-hidden">
            <div
              className="flex items-center gap-1 border-b px-2 py-1.5"
              style={{
                borderColor: "var(--color-line)",
                background: "var(--color-surface-2)",
              }}
            >
              <Tab active={tab === "task"} onClick={() => setTab("task")}>
                Task
              </Tab>
              <Tab active={tab === "tests"} onClick={() => setTab("tests")}>
                Test-cases
              </Tab>
              <span
                className="ml-auto px-2 font-mono text-[0.72rem] tabular-nums"
                style={{ color: "var(--color-ink-faint)" }}
              >
                {problem.difficulty} · {totalTests} tests
              </span>
            </div>

            <div className="max-h-[26rem] min-h-[16rem] overflow-y-auto px-5 py-4">
              {tab === "task" ? (
                <>
                  <h1 className="text-lg font-bold leading-tight">
                    {problem.title}
                  </h1>
                  <div className="mt-3">
                    <Markdown source={problem.statementMarkdown} />
                  </div>
                  {problem.constraints && (
                    <div className="mt-4">
                      <span className="label">Constraints</span>
                      <div className="mt-2">
                        <Markdown source={problem.constraints} />
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <Samples tests={problem.sampleTests} />
                  <p
                    className="mt-4 font-mono text-[0.72rem] leading-relaxed"
                    style={{ color: "var(--color-ink-faint)" }}
                  >
                    {totalTests - problem.sampleTests.length} further tests are
                    hidden. You see how many pass — never which, never their
                    inputs.
                  </p>
                </>
              )}
            </div>
          </section>

          {/* Judge feed sits where the reference puts battle chat: this is
              the real event stream the server actually sends. */}
          <section className="flex min-h-[16rem] flex-col">
            <JudgeFeed
              submissions={state.ownSubmissions}
              totalTests={totalTests}
            />
          </section>
        </div>

        {/* --- Bottom row: your editor vs the opponent ------------------ */}
        <div className="grid gap-4 lg:grid-cols-2">
          {/* You */}
          <section
            className="panel-side flex min-h-0 flex-col overflow-hidden"
            style={{ ["--side-color" as string]: "var(--color-side-a)" }}
          >
            <div
              className="flex flex-wrap items-center gap-2 px-3 py-2"
              style={{ background: "var(--color-surface-2)" }}
            >
              <button
                className="btn btn-side-a px-3! py-1.5! text-[0.68rem]!"
                onClick={onSubmit}
                disabled={busy || !source.trim() || remainingMs <= 0}
              >
                {busy ? <Spinner /> : "▶ Run code"}
              </button>

              <div className="flex gap-1">
                {languages.map((l) => (
                  <button
                    key={l}
                    onClick={() => setLanguage(l)}
                    className="rounded-[5px] border px-2 py-1 font-mono text-[0.62rem] uppercase transition-colors"
                    style={
                      l === language
                        ? {
                            borderColor: "var(--color-side-a)",
                            background: "rgba(59,130,246,0.14)",
                            color: "var(--color-side-a)",
                          }
                        : {
                            borderColor: "var(--color-line-strong)",
                            color: "var(--color-ink-faint)",
                          }
                    }
                  >
                    {languageLabel(l)}
                  </button>
                ))}
              </div>

              <div className="ml-auto">
                <TestChevrons
                  side="A"
                  passed={myProgress?.bestPassed ?? 0}
                  total={myProgress?.total || totalTests}
                />
              </div>
            </div>

            <div className="flex min-h-[20rem] flex-1 flex-col p-3">
              <CodeEditor
                value={source}
                onChange={(v) => {
                  setSource(v);
                  setTouched(true);
                }}
                disabled={busy || remainingMs <= 0}
              />
              {error && (
                <div className="mt-3">
                  <ErrorBanner message={error} />
                </div>
              )}
            </div>

            <div
              className="flex items-center gap-3 px-3 py-1.5 font-mono text-[0.6rem]"
              style={{
                background: "var(--color-surface-2)",
                color: "var(--color-ink-faint)",
              }}
            >
              <span>{languageLabel(language)}</span>
              <button
                className="transition-colors hover:opacity-70"
                onClick={() => {
                  setTouched(false);
                  setSource(problem.starterCode[language] ?? "");
                }}
              >
                Reset starter
              </button>
              <span
                className="ml-auto rounded-[4px] px-2 py-0.5 font-bold uppercase"
                style={{ background: "var(--color-side-a)", color: "#fff" }}
              >
                You
              </span>
            </div>
          </section>

          {/* Opponent */}
          <OpponentPanel
            side={oppSide}
            players={opponents}
            bestPassed={oppProgress.bestPassed}
            total={oppProgress.total || totalTests}
          />
        </div>

        {/* Your own submission history. */}
        <section className="panel p-4">
          <h2 className="label mb-3">Your submissions</h2>
          <SubmissionList submissions={state.ownSubmissions} />
        </section>
      </div>
    </AppShell>
  );
}

function Tab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="rounded-[6px] px-3 py-1.5 text-[0.78rem] font-medium transition-colors"
      style={
        active
          ? { background: "var(--color-surface-4)", color: "var(--color-ink)" }
          : { color: "var(--color-ink-faint)" }
      }
    >
      {children}
    </button>
  );
}

/**
 * The opponent's side of the arena.
 *
 * The reference shows the rival's live source here. This build does not stream
 * opponent code — the protocol deliberately never sends it, since that would
 * be trivially copyable — so the panel shows who you're facing and how far
 * they've got, which is the signal the server actually provides.
 */
function OpponentPanel({
  side,
  players,
  bestPassed,
  total,
}: {
  side: Side;
  players: PlayerView[];
  bestPassed: number;
  total: number;
}) {
  const color = side === "A" ? "var(--color-side-a)" : "var(--color-side-b)";
  const pct = total > 0 ? Math.round((bestPassed / total) * 100) : 0;

  return (
    <section
      className="panel-side flex min-h-0 flex-col overflow-hidden"
      style={{ ["--side-color" as string]: color }}
    >
      <div
        className="flex items-center gap-3 px-3 py-2"
        style={{ background: "var(--color-surface-2)" }}
      >
        <TestChevrons side={side} passed={bestPassed} total={total} reverse />
        <span
          className="ml-auto truncate font-mono text-[0.85rem] font-bold"
          style={{ color }}
        >
          {players.length === 0
            ? "Waiting…"
            : players.map((p) => p.displayName).join(", ")}
        </span>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-5 p-8 text-center">
        {players.length > 0 && (
          <div className="flex flex-wrap justify-center gap-3">
            {players.map((p) => (
              <div key={p.userId} className="flex flex-col items-center gap-1.5">
                <Avatar
                  avatarId={p.avatarId}
                  color={p.avatarColor}
                  size={56}
                  rounded={10}
                  ring={p.presence === "ONLINE" ? color : undefined}
                />
                <span
                  className="max-w-24 truncate font-mono text-[0.66rem]"
                  style={{
                    color:
                      p.presence === "ONLINE"
                        ? "var(--color-ink-dim)"
                        : "var(--color-ink-ghost)",
                  }}
                >
                  {p.displayName}
                </span>
              </div>
            ))}
          </div>
        )}

        <div>
          <div
            className="display text-[3rem] tabular-nums leading-none"
            style={{ color }}
          >
            {pct}%
          </div>
          <div className="label mt-2">
            {bestPassed} / {total} tests cleared
          </div>
        </div>

        <p
          className="max-w-xs font-mono text-[0.7rem] leading-relaxed"
          style={{ color: "var(--color-ink-ghost)" }}
        >
          Their source stays hidden — you only ever see how many tests they
          have passed.
        </p>
      </div>

      <div
        className="flex px-3 py-1.5"
        style={{ background: "var(--color-surface-2)" }}
      >
        <span
          className="ml-auto rounded-[4px] px-2 py-0.5 font-mono text-[0.6rem] font-bold uppercase"
          style={{ background: color, color: "#fff" }}
        >
          Competitor
        </span>
      </div>
    </section>
  );
}
