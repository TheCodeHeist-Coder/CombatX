"use client";

import { useEffect, useMemo, useState } from "react";
import type { Language, Side } from "@repo/protocol";
import { ErrorBanner, Spinner, Centered } from "../atoms";
import { AppShell } from "../AppShell";
import { ConnBadge } from "../ConnBadge";
import { Markdown } from "./Markdown";
import { Samples } from "./Samples";
import { CodeEditor } from "./CodeEditor";
import { BattleTimer } from "./BattleTimer";
import { ScoreBar } from "./ScoreBar";
import { SubmissionList } from "./SubmissionList";
import { JudgeFeed } from "./JudgeFeed";
import { CountdownOverlay } from "./CountdownOverlay";
import { selectMe, selectSideProgress } from "../../lib/battleState";
import { useCosmeticClock } from "../../lib/useCosmeticClock";
import { languageLabel } from "../../lib/format";
import type { BattleConnection } from "../../lib/useBattleConnection";
import type { Session } from "../../lib/session";

/**
 * The live battle. Left: the problem + samples. Right: the editor, language
 * picker, submit, the match clock, and both sides' live scores. A submit sends
 * source to the server, which enqueues a judge job; results stream back over
 * the socket as submission:result / opponent:progress events.
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

  // Seed the editor from starter code whenever the language (or problem)
  // changes — but never clobber edits the player has already made.
  useEffect(() => {
    if (!problem) return;
    if (touched) return;
    const starter = problem.starterCode[language] ?? "";
    setSource(starter);
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

  // COUNTDOWN phase, or IN_PROGRESS but the problem hasn't arrived yet.
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

  const myProgress = mySide ? selectSideProgress(state, mySide) : null;
  const oppSide: Side = mySide === "A" ? "B" : "A";

  return (
    <AppShell
      session={session}
      right={
        <div className="flex items-center gap-2.5">
          <BattleTimer remainingMs={remainingMs} />
          <ConnBadge status={status} />
        </div>
      }
    >
      {counting && state.countdownMs != null && (
        <CountdownOverlay startsInMs={state.countdownMs} />
      )}

      <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
        {/* Left: live scoreboard + problem */}
        <section
          className="flex min-h-0 flex-col overflow-hidden border-r"
          style={{ borderColor: "var(--color-line)" }}
        >
          {/* Live scoreboard */}
          <div
            className="border-b px-5 py-4"
            style={{ borderColor: "var(--color-line)" }}
          >
            <span className="label">Live scoreboard</span>
            <div className="mt-3 grid grid-cols-2 gap-3">
              {myProgress && (
                <ScoreBar
                  side={mySide!}
                  label={`Team ${mySide === "A" ? "Alpha" : "Bravo"}`}
                  bestPassed={myProgress.bestPassed}
                  total={myProgress.total || problem.totalTests}
                  isMine
                />
              )}
              <ScoreBar
                side={oppSide}
                label={`Team ${oppSide === "A" ? "Alpha" : "Bravo"}`}
                bestPassed={selectSideProgress(state, oppSide).bestPassed}
                total={
                  selectSideProgress(state, oppSide).total || problem.totalTests
                }
                isMine={false}
              />
            </div>
          </div>

          <div
            className="border-b px-5 py-4"
            style={{ borderColor: "var(--color-line)" }}
          >
            <div className="flex flex-wrap gap-2">
              <span className="chip">
                Difficulty: {problem.difficulty}
              </span>
              <span className="chip">Verification: protocol-7</span>
            </div>
            <h1 className="mt-4 text-2xl font-semibold leading-tight">
              {problem.title}
            </h1>
            <p className="label mt-2">{problem.totalTests} hidden tests</p>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-5">
            <Markdown source={problem.statementMarkdown} />
            {problem.constraints && (
              <div className="mt-4">
                <span className="label">Constraints</span>
                <div className="mt-2">
                  <Markdown source={problem.constraints} />
                </div>
              </div>
            )}
            <div className="mt-5">
              <Samples tests={problem.sampleTests} />
            </div>
          </div>
        </section>

        {/* Right: editor + controls + scores */}
        <section className="flex min-h-0 flex-col">
          {/* Editor */}
          <div className="flex min-h-0 flex-1 flex-col">
            <div
              className="flex flex-wrap items-center gap-3 border-b px-4 py-2.5"
              style={{
                borderColor: "var(--color-line)",
                background: "var(--color-surface-2)",
              }}
            >
              <span className="font-mono text-[0.8rem] font-semibold">
                ▤ solution.{extensionFor(language)}
              </span>
              <span
                className="h-4 w-px"
                style={{ background: "var(--color-line-strong)" }}
              />
              <div className="flex gap-1.5">
                {languages.map((l) => (
                  <button
                    key={l}
                    onClick={() => setLanguage(l)}
                    className="rounded-[8px] border px-2.5 py-1.5 text-xs font-medium transition-colors"
                    style={
                      l === language
                        ? {
                            borderColor:
                              "color-mix(in srgb, var(--color-accent) 45%, transparent)",
                            background:
                              "color-mix(in srgb, var(--color-accent) 12%, transparent)",
                            color: "var(--color-accent)",
                          }
                        : {
                            borderColor: "var(--color-line)",
                            color: "var(--color-ink-faint)",
                          }
                    }
                  >
                    {languageLabel(l)}
                  </button>
                ))}
              </div>
              <span
                className="chip ml-auto"
                style={{
                  background: "var(--color-primary)",
                  borderColor: "var(--color-primary)",
                  color: "var(--color-sand)",
                }}
              >
                Active combat
              </span>
              <button
                className="font-mono text-[0.66rem] uppercase tracking-wider transition-colors hover:opacity-70"
                style={{ color: "var(--color-ink-faint)" }}
                onClick={() => {
                  setTouched(false);
                  setSource(problem.starterCode[language] ?? "");
                }}
              >
                Reset_starter
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-hidden p-4">

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
              className="flex flex-wrap items-center gap-3 border-t px-4 py-3"
              style={{
                borderColor: "var(--color-line)",
                background: "var(--color-surface-2)",
              }}
            >
              <SubmissionList submissions={state.ownSubmissions} />
              <button
                className="btn btn-ghost ml-auto"
                onClick={() => {
                  setTouched(false);
                  setSource(problem.starterCode[language] ?? "");
                }}
                disabled={busy}
              >
                ▷ Run_local
              </button>
              <button
                className="btn btn-primary"
                onClick={onSubmit}
                disabled={busy || !source.trim() || remainingMs <= 0}
              >
                {busy ? <Spinner /> : "⇧ Submit_intel"}
              </button>
            </div>
          </div>

          {/* Judge feed */}
          <div
            className="h-56 shrink-0 border-t"
            style={{ borderColor: "var(--color-line)" }}
          >
            <JudgeFeed
              submissions={state.ownSubmissions}
              totalTests={problem.totalTests}
            />
          </div>
        </section>
      </div>
    </AppShell>
  );
}

/** File extension for the editor tab label. */
function extensionFor(language: Language): string {
  switch (language) {
    case "PYTHON":
      return "py";
    case "JAVASCRIPT":
      return "js";
    case "CPP":
      return "cpp";
    case "JAVA":
      return "java";
  }
}
