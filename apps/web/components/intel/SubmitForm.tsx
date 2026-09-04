"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Difficulty,
  Language,
  type CommunityProblemInput,
  type DuplicateMatch,
  type MyProblemDetail,
} from "@repo/protocol";
import { ErrorBanner, Spinner } from "../atoms";
import {
  ApiCallError,
  checkDuplicate,
  submitProblem,
  updateMyProblem,
} from "../../lib/api";
import type { Session } from "../../lib/session";

const DIFFICULTIES = Difficulty.options;
const LANGUAGES = Language.options;

interface TestDraft {
  kind: "SAMPLE" | "HIDDEN";
  input: string;
  expectedOutput: string;
  weight: number;
}

/**
 * The problem authoring form.
 *
 * WHY THE DUPLICATE CHECK RUNS WHILE TYPING
 * -----------------------------------------
 * Finding out your title collides only after you have written a statement, six
 * test cases and pressed submit is the worst possible moment — all the work is
 * done and the answer is "start again". Debounced checking puts that answer in
 * front of the author while the title is still the only thing they have typed.
 *
 * The check WARNS. Only an exact title match is refused, and that refusal comes
 * from the server, not here — a client-side block would be both bypassable and
 * wrong, since similarity is a guess and the author knows their problem better
 * than a token overlap does.
 */
export function SubmitForm({
  session,
  existing,
}: {
  session: Session;
  /** Present when editing a pending or rejected submission. */
  existing?: MyProblemDetail;
}) {
  const router = useRouter();

  const [title, setTitle] = useState(existing?.title ?? "");
  const [statement, setStatement] = useState(existing?.statementMarkdown ?? "");
  const [constraints, setConstraints] = useState(existing?.constraints ?? "");
  const [difficulty, setDifficulty] = useState<(typeof DIFFICULTIES)[number]>(
    (existing?.difficulty as (typeof DIFFICULTIES)[number]) ?? "MEDIUM",
  );
  const [timeLimit, setTimeLimit] = useState(
    existing?.timeLimitDefaultSec ?? 600,
  );
  const [languages, setLanguages] = useState<string[]>(
    existing?.allowedLanguages ?? ["PYTHON"],
  );
  const [starter, setStarter] = useState<Record<string, string>>(
    existing?.starterCode ?? { PYTHON: "def solve():\n    pass\n" },
  );
  const [tests, setTests] = useState<TestDraft[]>(
    existing?.testCases.length
      ? existing.testCases.map((t) => ({
          kind: t.kind,
          input: t.input,
          expectedOutput: t.expectedOutput,
          weight: t.weight,
        }))
      : [
          { kind: "SAMPLE", input: "", expectedOutput: "", weight: 1 },
          { kind: "HIDDEN", input: "", expectedOutput: "", weight: 1 },
        ],
  );

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [matches, setMatches] = useState<DuplicateMatch[]>([]);
  const [checking, setChecking] = useState(false);
  /** Set once the author has seen the near-matches and chosen to proceed. */
  const [acknowledged, setAcknowledged] = useState(false);

  // Debounced duplicate check. Aborted on each keystroke so a slow response
  // for an old title cannot overwrite the answer for the current one.
  const abortRef = useRef<AbortController | null>(null);
  useEffect(() => {
    if (title.trim().length < 4) {
      setMatches([]);
      return;
    }
    const timer = setTimeout(() => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setChecking(true);
      checkDuplicate(session.token, {
        title,
        statementMarkdown: statement,
        excludeId: existing?.id,
      })
        .then((res) => {
          if (ctrl.signal.aborted) return;
          setMatches(res.matches);
          // A changed title is a new claim, so a previous acknowledgement
          // should not carry over to it.
          setAcknowledged(false);
        })
        .catch(() => {
          /* A failed check must never block authoring. */
        })
        .finally(() => !ctrl.signal.aborted && setChecking(false));
    }, 450);
    return () => clearTimeout(timer);
  }, [title, statement, session.token, existing?.id]);

  const toggleLanguage = useCallback((lang: string) => {
    setLanguages((prev) => {
      const next = prev.includes(lang)
        ? prev.filter((l) => l !== lang)
        : [...prev, lang];
      // Drop the starter snippet for a language no longer allowed — the
      // server rejects the mismatch, so leaving it would be a failed submit.
      setStarter((s) => {
        if (next.includes(lang)) return s;
        const copy = { ...s };
        delete copy[lang];
        return copy;
      });
      return next;
    });
  }, []);

  const canSubmit =
    title.trim().length >= 6 &&
    statement.trim().length >= 40 &&
    languages.length > 0 &&
    tests.length >= 2 &&
    !busy;

  async function save() {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);

    const input: CommunityProblemInput = {
      title: title.trim(),
      statementMarkdown: statement,
      constraints,
      difficulty,
      allowedLanguages: languages as CommunityProblemInput["allowedLanguages"],
      starterCode: starter as CommunityProblemInput["starterCode"],
      timeLimitDefaultSec: timeLimit,
      testCases: tests,
    };

    try {
      if (existing) {
        await updateMyProblem(session.token, existing.id, input, acknowledged);
      } else {
        await submitProblem(session.token, input, acknowledged);
      }
      router.push("/intel/mine");
    } catch (e) {
      if (e instanceof ApiCallError && e.code === "POSSIBLE_DUPLICATE") {
        setError(
          "This looks close to a problem the arena already has — check the list above, then submit again to confirm it is different.",
        );
        setAcknowledged(true);
      } else {
        setError(
          e instanceof ApiCallError ? e.message : "Could not submit the problem.",
        );
      }
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* --- 01 Statement --- */}
      <section className="panel p-5">
        <SectionTitle n="01" title="The problem" />

        <div className="mt-4 flex flex-col gap-4">
          <Field
            label="Title"
            hint="What a player will see in the catalogue."
          >
            <input
              className="field"
              value={title}
              maxLength={120}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Longest Common Prefix"
              disabled={busy}
            />
          </Field>

          {/* Near-matches, shown the moment they are known. */}
          {checking && (
            <p
              className="font-mono text-[0.68rem]"
              style={{ color: "var(--color-ink-ghost)" }}
            >
              Checking for duplicates…
            </p>
          )}
          {matches.length > 0 && (
            <div
              className="rounded-[8px] border p-3"
              style={{
                borderColor: "var(--color-warn)",
                background: "color-mix(in srgb, var(--color-warn) 8%, transparent)",
              }}
            >
              <p
                className="font-mono text-[0.72rem] font-bold"
                style={{ color: "var(--color-warn)" }}
              >
                The arena may already have this
              </p>
              <ul className="mt-2 flex flex-col gap-1">
                {matches.map((m) => (
                  <li
                    key={m.id}
                    className="font-mono text-[0.72rem]"
                    style={{ color: "var(--color-ink-dim)" }}
                  >
                    <strong style={{ color: "var(--color-ink)" }}>
                      {m.title}
                    </strong>{" "}
                    — {Math.round(m.similarity * 100)}% similar{" "}
                    {m.reason === "STATEMENT" ? "(statement)" : "(title)"}
                  </li>
                ))}
              </ul>
              <p
                className="mt-2 font-mono text-[0.68rem]"
                style={{ color: "var(--color-ink-faint)" }}
              >
                If yours is genuinely different, submit anyway — a reviewer will
                see the same list.
              </p>
            </div>
          )}

          <Field
            label="Statement"
            hint="Markdown. Say exactly what goes in and what must come out."
          >
            <textarea
              className="field min-h-48"
              value={statement}
              onChange={(e) => setStatement(e.target.value)}
              placeholder={
                "Given n integers on stdin, print the largest.\n\nThe first line holds n; the second holds the values."
              }
              disabled={busy}
            />
          </Field>

          <Field label="Constraints" hint="Bounds on the input.">
            <textarea
              className="field min-h-16"
              value={constraints}
              maxLength={2000}
              onChange={(e) => setConstraints(e.target.value)}
              placeholder="1 <= n <= 10^5"
              disabled={busy}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Difficulty" hint="Be honest — reviewers check.">
              <select
                className="field"
                value={difficulty}
                onChange={(e) =>
                  setDifficulty(e.target.value as typeof difficulty)
                }
                disabled={busy}
              >
                {DIFFICULTIES.map((d) => (
                  <option key={d} value={d}>
                    {d.toLowerCase()}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Time limit" hint="Minutes a battle gets.">
              <input
                className="field"
                type="number"
                min={1}
                max={120}
                value={Math.round(timeLimit / 60)}
                onChange={(e) =>
                  setTimeLimit(Math.max(60, Number(e.target.value) * 60))
                }
                disabled={busy}
              />
            </Field>
          </div>
        </div>
      </section>

      {/* --- 02 Languages --- */}
      <section className="panel p-5">
        <SectionTitle n="02" title="Languages" />
        <div className="mt-4 flex flex-wrap gap-2">
          {LANGUAGES.map((l) => {
            const on = languages.includes(l);
            return (
              <button
                key={l}
                onClick={() => toggleLanguage(l)}
                className="lang-pill font-mono"
                style={{
                  borderColor: on ? "var(--color-accent)" : "var(--color-line)",
                  color: on ? "var(--color-accent)" : undefined,
                }}
                disabled={busy}
              >
                {l.toLowerCase()}
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex flex-col gap-3">
          {languages.map((l) => (
            <Field key={l} label={`${l.toLowerCase()} starter`} hint="">
              <textarea
                className="field min-h-20"
                value={starter[l] ?? ""}
                onChange={(e) =>
                  setStarter((s) => ({ ...s, [l]: e.target.value }))
                }
                disabled={busy}
              />
            </Field>
          ))}
        </div>
      </section>

      {/* --- 03 Tests --- */}
      <section className="panel p-5">
        <div className="flex items-center justify-between">
          <SectionTitle n="03" title="Test cases" />
          <button
            className="btn btn-ghost px-3! py-1.5! text-[0.7rem]!"
            onClick={() =>
              setTests((t) => [
                ...t,
                { kind: "HIDDEN", input: "", expectedOutput: "", weight: 1 },
              ])
            }
            disabled={busy}
          >
            Add case
          </button>
        </div>

        <p
          className="mt-2 font-mono text-[0.7rem] leading-relaxed"
          style={{ color: "var(--color-ink-faint)" }}
        >
          Samples ship with the statement; hidden ones only ever run in the
          judge. At least two, and they must not all expect the same answer —
          otherwise a program that ignores its input would pass.
        </p>

        <div className="mt-4 flex flex-col gap-3">
          {tests.map((t, i) => (
            <div
              key={i}
              className="rounded-[8px] border p-3"
              style={{
                borderColor: "var(--color-line)",
                background: "var(--color-surface-2)",
              }}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className="font-mono text-[0.7rem]"
                  style={{ color: "var(--color-ink-faint)" }}
                >
                  #{i + 1}
                </span>
                <select
                  className="field max-w-32 py-1!"
                  value={t.kind}
                  onChange={(e) =>
                    setTests((prev) =>
                      prev.map((x, j) =>
                        j === i
                          ? { ...x, kind: e.target.value as TestDraft["kind"] }
                          : x,
                      ),
                    )
                  }
                  disabled={busy}
                >
                  <option value="SAMPLE">shown</option>
                  <option value="HIDDEN">hidden</option>
                </select>
                <button
                  className="btn btn-ghost ml-auto px-2.5! py-1! text-[0.66rem]!"
                  onClick={() =>
                    setTests((prev) => prev.filter((_, j) => j !== i))
                  }
                  disabled={busy || tests.length <= 2}
                  title={
                    tests.length <= 2 ? "A problem needs two cases" : "Remove"
                  }
                >
                  Remove
                </button>
              </div>

              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <textarea
                  className="field min-h-16"
                  placeholder="stdin"
                  value={t.input}
                  onChange={(e) =>
                    setTests((prev) =>
                      prev.map((x, j) =>
                        j === i ? { ...x, input: e.target.value } : x,
                      ),
                    )
                  }
                  disabled={busy}
                />
                <textarea
                  className="field min-h-16"
                  placeholder="expected stdout"
                  value={t.expectedOutput}
                  onChange={(e) =>
                    setTests((prev) =>
                      prev.map((x, j) =>
                        j === i ? { ...x, expectedOutput: e.target.value } : x,
                      ),
                    )
                  }
                  disabled={busy}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      {error && <ErrorBanner message={error} />}

      <div
        className="sticky bottom-4 flex flex-wrap items-center gap-3 rounded-[10px] border p-3"
        style={{
          borderColor: "var(--color-line)",
          background: "var(--color-surface-2)",
        }}
      >
        <button
          className="btn btn-primary"
          onClick={save}
          disabled={!canSubmit}
        >
          {busy ? (
            <Spinner />
          ) : existing ? (
            "Resubmit for review"
          ) : (
            "Submit for review"
          )}
        </button>
        <span
          className="font-mono text-[0.7rem]"
          style={{ color: "var(--color-ink-faint)" }}
        >
          An admin reviews it before it reaches a battle.
        </span>
      </div>
    </div>
  );
}

function SectionTitle({ n, title }: { n: string; title: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        className="font-mono text-[0.7rem]"
        style={{ color: "var(--color-ink-ghost)" }}
      >
        {n}
      </span>
      <h2 className="text-[1rem] font-bold">{title}</h2>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="label">{label}</label>
      {children}
      {hint && (
        <p
          className="font-mono text-[0.66rem]"
          style={{ color: "var(--color-ink-ghost)" }}
        >
          {hint}
        </p>
      )}
    </div>
  );
}
