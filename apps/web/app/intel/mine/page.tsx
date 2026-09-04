"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { MyProblemRow, ProblemStatus } from "@repo/protocol";
import { AppShell } from "../../../components/AppShell";
import { SignInGate } from "../../../components/SignInGate";
import { ErrorBanner, Spinner } from "../../../components/atoms";
import {
  ApiCallError,
  fetchMyProblems,
  withdrawMyProblem,
} from "../../../lib/api";
import { useSession } from "../../../lib/useSession";
import { useProfile } from "../../../lib/useProfile";
import { DifficultyChip } from "../page";

/**
 * The author's own submissions and where each one stands.
 *
 * The rejection note is shown in full rather than behind a link: it is the one
 * piece of information that tells the author what to change, and hiding it a
 * click away is how a rejection turns into a resubmission of the same thing.
 */
export default function MySubmissionsPage() {
  const { session, loaded } = useSession();
  const { profile } = useProfile(session);

  const [rows, setRows] = useState<MyProblemRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [working, setWorking] = useState<string | null>(null);

  function load() {
    if (!session) return;
    setBusy(true);
    fetchMyProblems(session.token)
      .then((r) => setRows(r.rows))
      .catch((e) =>
        setError(
          e instanceof ApiCallError
            ? e.message
            : "Could not load your submissions.",
        ),
      )
      .finally(() => setBusy(false));
  }

  useEffect(load, [session]);

  async function withdraw(id: string, title: string) {
    if (!session) return;
    if (!window.confirm(`Withdraw "${title}"? This cannot be undone.`)) return;
    setWorking(id);
    try {
      await withdrawMyProblem(session.token, id);
      load();
    } catch (e) {
      setError(
        e instanceof ApiCallError ? e.message : "Could not withdraw it.",
      );
    } finally {
      setWorking(null);
    }
  }

  const approved = rows.filter((r) => r.status === "APPROVED").length;

  return (
    <AppShell session={session} profile={profile}>
      <div className="mx-auto w-full max-w-4xl px-5 py-8 sm:px-7">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="eyebrow">Module // intel</p>
            <h1 className="mt-2 text-2xl font-bold">My submissions</h1>
          </div>
          <Link href="/intel/submit" className="btn btn-primary">
            Submit a problem
          </Link>
        </div>

        {approved > 0 && (
          <p
            className="mt-3 font-mono text-[0.74rem]"
            style={{ color: "var(--color-good)" }}
          >
            {approved} accepted — your Problem Setter medal reads x{approved}.
          </p>
        )}

        {error && (
          <div className="mt-5">
            <ErrorBanner message={error} />
          </div>
        )}

        <div className="mt-6">
          {!loaded ? null : !session || session.isGuest ? (
            <SignInGate
              what="see your submissions"
              guest={!!session?.isGuest}
            />
          ) : busy ? (
            <div className="flex justify-center py-12">
              <Spinner />
            </div>
          ) : rows.length === 0 ? (
            <div className="panel p-8 text-center">
              <p
                className="font-mono text-[0.8rem]"
                style={{ color: "var(--color-ink-dim)" }}
              >
                You have not written a problem yet.
              </p>
              <Link href="/intel/submit" className="btn btn-primary mt-4">
                Write your first
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {rows.map((p) => (
                <article key={p.id} className="panel p-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-[0.95rem] font-bold">{p.title}</h2>
                    <StatusChip value={p.status} />
                    <DifficultyChip value={p.difficulty} />
                    <span
                      className="ml-auto font-mono text-[0.7rem]"
                      style={{ color: "var(--color-ink-faint)" }}
                    >
                      {p.testCount} tests
                      {p.battleCount > 0 && ` · used ${p.battleCount}×`}
                    </span>
                  </div>

                  {p.status === "REJECTED" && p.reviewNote && (
                    <div
                      className="mt-3 rounded-[8px] border p-3"
                      style={{
                        borderColor: "var(--color-bad)",
                        background:
                          "color-mix(in srgb, var(--color-bad) 8%, transparent)",
                      }}
                    >
                      <p
                        className="font-mono text-[0.68rem] font-bold"
                        style={{ color: "var(--color-bad)" }}
                      >
                        Why it was sent back
                      </p>
                      <p
                        className="mt-1 font-mono text-[0.74rem] leading-relaxed"
                        style={{ color: "var(--color-ink-dim)" }}
                      >
                        {p.reviewNote}
                      </p>
                    </div>
                  )}

                  {p.status === "PENDING" && (
                    <p
                      className="mt-2 font-mono text-[0.72rem]"
                      style={{ color: "var(--color-ink-faint)" }}
                    >
                      Waiting for a reviewer. You can still edit it.
                    </p>
                  )}

                  {p.status === "APPROVED" && (
                    <p
                      className="mt-2 font-mono text-[0.72rem]"
                      style={{ color: "var(--color-good)" }}
                    >
                      Live in the arena. It can no longer be edited.
                    </p>
                  )}

                  {p.status !== "APPROVED" && (
                    <div className="mt-3 flex gap-2">
                      <Link
                        href={`/intel/mine/${p.id}`}
                        className="btn btn-ghost px-3! py-1.5! text-[0.7rem]!"
                      >
                        {p.status === "REJECTED" ? "Fix and resubmit" : "Edit"}
                      </Link>
                      <button
                        className="btn btn-ghost px-3! py-1.5! text-[0.7rem]!"
                        onClick={() => withdraw(p.id, p.title)}
                        disabled={working === p.id}
                      >
                        Withdraw
                      </button>
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

/** Review state as a colour-coded chip. */
function StatusChip({ value }: { value: ProblemStatus }) {
  const map: Record<ProblemStatus, { color: string; text: string }> = {
    DRAFT: { color: "var(--color-ink-faint)", text: "draft" },
    PENDING: { color: "var(--color-warn)", text: "pending review" },
    APPROVED: { color: "var(--color-good)", text: "approved" },
    REJECTED: { color: "var(--color-bad)", text: "changes needed" },
  };
  const { color, text } = map[value];
  return (
    <span
      className="chip font-mono"
      style={{ borderColor: color, color, fontSize: "0.64rem" }}
    >
      {text}
    </span>
  );
}
