"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Difficulty,
  Language,
  type AdminProblemDetail,
  type AdminProblemInput,
} from "@repo/protocol";
import { ErrorBanner, Spinner } from "./atoms";
import {
  createProblem,
  updateProblem,
  AdminApiError,
} from "../lib/api";
import { useAdminSession } from "../lib/useAdminSession";

const DIFFICULTIES = Difficulty.options;
const LANGUAGES = Language.options;

interface TestDraft {
  kind: "SAMPLE" | "HIDDEN";
  input: string;
  expectedOutput: string;
  weight: number;
}

/**
 * Create or edit a problem.
 *
 * One component for both so the two forms cannot drift — `existing` decides
 * whether it POSTs or PUTs, and every field is seeded from it when present.
 */
export function ProblemForm({
  existing,
}: {
  existing?: AdminProblemDetail;
}) {
  const { session } = useAdminSession();
  const router = useRouter();

  const [title, setTitle] = useState(existing?.title ?? "");
  const [statement, setStatement] = useState(existing?.statementMarkdown ?? "");
  const [constraints, setConstraints] = useState(existing?.constraints ?? "");
  const [difficulty, setDifficulty] = useState<string>(
    existing?.difficulty ?? "EASY",
  );
  const [timeLimit, setTimeLimit] = useState(
    existing?.timeLimitDefaultSec ?? 600,
  );
  const [languages, setLanguages] = useState<string[]>(
    existing?.allowedLanguages ?? ["PYTHON"],
  );
  const [starter, setStarter] = useState<Record<string, string>>(
    existing?.starterCode ?? {},
  );
  const [tests, setTests] = useState<TestDraft[]>(
    existing?.testCases.map((t) => ({
      kind: t.kind,
      input: t.input,
      expectedOutput: t.expectedOutput,
      weight: t.weight,
    })) ?? [{ kind: "SAMPLE", input: "", expectedOutput: "", weight: 1 }],
  );

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleLanguage(lang: string) {
    setLanguages((prev) => {
      const next = prev.includes(lang)
        ? prev.filter((l) => l !== lang)
        : [...prev, lang];
      // Drop starter code for a language that is no longer allowed — the
      // server rejects the mismatch, and silently keeping it would make the
      // form fail to save with no visible cause.
      setStarter((s) => {
        const copy = { ...s };
        if (!next.includes(lang)) delete copy[lang];
        return copy;
      });
      return next;
    });
  }

  function patchTest(i: number, patch: Partial<TestDraft>) {
    setTests((prev) =>
      prev.map((t, idx) => (idx === i ? { ...t, ...patch } : t)),
    );
  }

  async function save() {
    if (!session || busy) return;
    setBusy(true);
    setError(null);

    const input: AdminProblemInput = {
      title: title.trim(),
      statementMarkdown: statement,
      constraints,
      difficulty: difficulty as AdminProblemInput["difficulty"],
      allowedLanguages: languages as AdminProblemInput["allowedLanguages"],
      starterCode: starter as AdminProblemInput["starterCode"],
      timeLimitDefaultSec: timeLimit,
      testCases: tests.map((t) => ({
        kind: t.kind,
        input: t.input,
        expectedOutput: t.expectedOutput,
        weight: t.weight,
      })),
    };

    try {
      if (existing) {
        await updateProblem(session.token, existing.id, input);
      } else {
        await createProblem(session.token, input);
      }
      router.push("/problems");
    } catch (err) {
      setError(
        err instanceof AdminApiError ? err.message : "Could not save.",
      );
      setBusy(false);
    }
  }

  const sampleCount = tests.filter((t) => t.kind === "SAMPLE").length;

  return (
    <div className="flex flex-col gap-6">
      <section className="panel p-5">
        <h2 className="text-base font-bold">Statement</h2>

        <div className="mt-4 flex flex-col gap-4">
          <Field label="Title" htmlFor="title">
            <input
              id="title"
              className="field"
              value={title}
              maxLength={120}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Two Sum"
            />
          </Field>

          <Field
            label="Problem statement"
            htmlFor="statement"
            hint="Markdown. This is what players read in the arena."
          >
            <textarea
              id="statement"
              className="field min-h-56 py-2.5"
              value={statement}
              onChange={(e) => setStatement(e.target.value)}
              placeholder={"Given an array of integers…\n\n## Input\n…"}
            />
          </Field>

          <Field
            label="Constraints"
            htmlFor="constraints"
            hint="Shown beside the statement. Optional."
          >
            <textarea
              id="constraints"
              className="field min-h-20 py-2.5"
              value={constraints}
              maxLength={2000}
              onChange={(e) => setConstraints(e.target.value)}
              placeholder="1 <= n <= 10^5"
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Difficulty" htmlFor="difficulty">
              <select
                id="difficulty"
                className="field"
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
              >
                {DIFFICULTIES.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </Field>

            <Field
              label="Default time limit"
              htmlFor="timeLimit"
              hint="Minutes. A battle can override this."
            >
              <input
                id="timeLimit"
                className="field"
                type="number"
                min={1}
                max={120}
                value={Math.round(timeLimit / 60)}
                onChange={(e) =>
                  setTimeLimit(Math.max(60, Number(e.target.value) * 60))
                }
              />
            </Field>
          </div>
        </div>
      </section>

      <section className="panel p-5">
        <h2 className="text-base font-bold">Languages</h2>
        <p
          className="mt-1.5 font-mono text-[0.75rem]"
          style={{ color: "var(--color-ink-faint)" }}
        >
          Which languages players may solve this in. Only runtimes installed in
          the judge will actually execute.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          {LANGUAGES.map((lang) => {
            const on = languages.includes(lang);
            return (
              <button
                key={lang}
                type="button"
                onClick={() => toggleLanguage(lang)}
                className="rounded-[6px] border px-3 py-1.5 font-mono text-[0.72rem] transition-colors"
                style={{
                  borderColor: on
                    ? "var(--color-primary)"
                    : "var(--color-line-strong)",
                  background: on
                    ? "color-mix(in srgb, var(--color-primary) 14%, transparent)"
                    : "var(--color-surface-3)",
                  color: on ? "var(--color-accent)" : "var(--color-ink-dim)",
                }}
              >
                {lang.toLowerCase()}
              </button>
            );
          })}
        </div>

        {languages.length > 0 && (
          <div className="mt-5 flex flex-col gap-4">
            <h3 className="label">Starter code</h3>
            {languages.map((lang) => (
              <Field key={lang} label={lang.toLowerCase()} htmlFor={`sc-${lang}`}>
                <textarea
                  id={`sc-${lang}`}
                  className="field min-h-24 py-2.5"
                  value={starter[lang] ?? ""}
                  onChange={(e) =>
                    setStarter((s) => ({ ...s, [lang]: e.target.value }))
                  }
                  placeholder="# read from stdin, print to stdout"
                  spellCheck={false}
                />
              </Field>
            ))}
          </div>
        )}
      </section>

      <section className="panel p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <h2 className="text-base font-bold">Test cases</h2>
            <p
              className="mt-1.5 font-mono text-[0.75rem]"
              style={{ color: "var(--color-ink-faint)" }}
            >
              SAMPLE cases ship with the statement. HIDDEN ones are never sent
              to the client — they are what actually decide the battle.
              {sampleCount === 0 && " Add at least one sample so players can see the format."}
            </p>
          </div>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() =>
              setTests((t) => [
                ...t,
                { kind: "HIDDEN", input: "", expectedOutput: "", weight: 1 },
              ])
            }
          >
            Add case
          </button>
        </div>

        <div className="mt-4 flex flex-col gap-3">
          {tests.map((t, i) => (
            <div
              key={i}
              className="rounded-[10px] border p-4"
              style={{
                borderColor: "var(--color-line)",
                background: "var(--color-surface-2)",
              }}
            >
              <div className="flex flex-wrap items-center gap-3">
                <span className="label">#{i + 1}</span>
                <select
                  className="field max-w-32 py-1!"
                  value={t.kind}
                  onChange={(e) =>
                    patchTest(i, {
                      kind: e.target.value as TestDraft["kind"],
                    })
                  }
                >
                  <option value="SAMPLE">SAMPLE</option>
                  <option value="HIDDEN">HIDDEN</option>
                </select>
                <label className="flex items-center gap-2">
                  <span className="label">Weight</span>
                  <input
                    className="field max-w-20 py-1!"
                    type="number"
                    min={1}
                    max={100}
                    value={t.weight}
                    onChange={(e) =>
                      patchTest(i, {
                        weight: Math.max(1, Number(e.target.value)),
                      })
                    }
                  />
                </label>
                <button
                  type="button"
                  className="btn btn-danger ml-auto px-2.5! py-1! text-[0.68rem]!"
                  disabled={tests.length === 1}
                  title={
                    tests.length === 1
                      ? "A problem needs at least one test case"
                      : "Remove this case"
                  }
                  onClick={() =>
                    setTests((prev) => prev.filter((_, idx) => idx !== i))
                  }
                >
                  Remove
                </button>
              </div>

              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <Field label="stdin" htmlFor={`in-${i}`}>
                  <textarea
                    id={`in-${i}`}
                    className="field min-h-20 py-2.5"
                    value={t.input}
                    onChange={(e) => patchTest(i, { input: e.target.value })}
                    spellCheck={false}
                  />
                </Field>
                <Field label="expected stdout" htmlFor={`out-${i}`}>
                  <textarea
                    id={`out-${i}`}
                    className="field min-h-20 py-2.5"
                    value={t.expectedOutput}
                    onChange={(e) =>
                      patchTest(i, { expectedOutput: e.target.value })
                    }
                    spellCheck={false}
                  />
                </Field>
              </div>
            </div>
          ))}
        </div>
      </section>

      {error && <ErrorBanner message={error} />}

      <div
        className="sticky bottom-4 flex items-center gap-3 rounded-[10px] border p-3"
        style={{
          borderColor: "var(--color-line-strong)",
          background:
            "color-mix(in srgb, var(--color-surface-2) 92%, transparent)",
          backdropFilter: "blur(8px)",
        }}
      >
        <button
          className="btn btn-primary"
          onClick={save}
          disabled={busy || !title.trim() || !statement.trim() || languages.length === 0}
        >
          {busy ? <Spinner /> : existing ? "Save changes" : "Create problem"}
        </button>
        <button
          className="btn btn-ghost"
          onClick={() => router.push("/problems")}
          disabled={busy}
        >
          Cancel
        </button>
        {existing && existing.battleCount > 0 && (
          <span
            className="font-mono text-[0.72rem]"
            style={{ color: "var(--color-warn)" }}
          >
            Used in {existing.battleCount} battle(s) — edits do not change past
            results.
          </span>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="label">
        {label}
      </label>
      {children}
      {hint && (
        <p
          className="font-mono text-[0.68rem]"
          style={{ color: "var(--color-ink-faint)" }}
        >
          {hint}
        </p>
      )}
    </div>
  );
}
