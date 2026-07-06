"use client";

import { useEffect, useMemo, useState } from "react";
import type { Language, Side } from "@repo/protocol";
import { Shell, ErrorBanner, Spinner, Centered } from "../atoms";
import { TopBar } from "../TopBar";
import { ConnBadge } from "../ConnBadge";
import { Markdown } from "./Markdown";
import { Samples } from "./Samples";
import { CodeEditor } from "./CodeEditor";
import { BattleTimer } from "./BattleTimer";
import { ScoreBar } from "./ScoreBar";
import { SubmissionList } from "./SubmissionList";
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
      <Shell>
        <TopBar session={session} right={<ConnBadge status={status} />} />
        {counting && state.countdownMs != null && (
          <CountdownOverlay startsInMs={state.countdownMs} />
        )}
        <Centered>
          <Spinner />
          <p className="text-sm" style={{ color: "var(--color-ink-dim)" }}>
            Revealing the problem…
          </p>
        </Centered>
      </Shell>
    );
  }

  const myProgress = mySide ? selectSideProgress(state, mySide) : null;
  const oppSide: Side = mySide === "A" ? "B" : "A";

  return (
    <Shell>
      {counting && state.countdownMs != null && (
        <CountdownOverlay startsInMs={state.countdownMs} />
      )}

      <TopBar session={session} right={<ConnBadge status={status} />} />

      <div className="grid flex-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
        {/* Left: problem */}
        <section className="panel flex min-h-0 flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b px-5 py-4" style={{ borderColor: "var(--color-line)" }}>
            <div>
              <h1 className="text-lg font-semibold tracking-tight">
                {problem.title}
              </h1>
              <span className="chip mt-1.5">
                {problem.difficulty.charAt(0) +
                  problem.difficulty.slice(1).toLowerCase()}
              </span>
            </div>
            <span className="text-sm" style={{ color: "var(--color-ink-faint)" }}>
              {problem.totalTests} tests
            </span>
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
        <section className="flex min-h-0 flex-col gap-4">
          {/* Clock + scores */}
          <div className="panel flex flex-col gap-4 p-4">
            <div className="flex items-start justify-between">
              <div className="flex flex-col gap-3">
                {myProgress && (
                  <ScoreBar
                    side={mySide!}
                    label={`Team ${mySide}`}
                    bestPassed={myProgress.bestPassed}
                    total={myProgress.total || problem.totalTests}
                    isMine
                  />
                )}
                <ScoreBar
                  side={oppSide}
                  label={`Team ${oppSide}`}
                  bestPassed={selectSideProgress(state, oppSide).bestPassed}
                  total={
                    selectSideProgress(state, oppSide).total || problem.totalTests
                  }
                  isMine={false}
                />
              </div>
              <BattleTimer remainingMs={remainingMs} />
            </div>
          </div>

          {/* Editor */}
          <div className="panel flex min-h-0 flex-1 flex-col gap-3 p-4">
            <div className="flex items-center justify-between">
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
              <button
                className="text-xs transition-colors hover:opacity-80"
                style={{ color: "var(--color-ink-faint)" }}
                onClick={() => {
                  setTouched(false);
                  setSource(problem.starterCode[language] ?? "");
                }}
              >
                Reset to starter
              </button>
            </div>

            <CodeEditor
              value={source}
              onChange={(v) => {
                setSource(v);
                setTouched(true);
              }}
              disabled={busy || remainingMs <= 0}
            />

            {error && <ErrorBanner message={error} />}

            <button
              className="btn btn-primary"
              onClick={onSubmit}
              disabled={busy || !source.trim() || remainingMs <= 0}
            >
              {busy ? <Spinner /> : "Submit solution"}
            </button>
          </div>

          {/* Own submissions */}
          <div className="panel flex flex-col gap-3 p-4">
            <span className="label">Your submissions</span>
            <SubmissionList submissions={state.ownSubmissions} />
          </div>
        </section>
      </div>
    </Shell>
  );
}
