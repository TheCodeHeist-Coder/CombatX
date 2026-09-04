"use client";

import { use, useEffect, useState } from "react";
import type { MyProblemDetail } from "@repo/protocol";
import { AppShell } from "../../../../components/AppShell";
import { SignInGate } from "../../../../components/SignInGate";
import { ErrorBanner, Spinner } from "../../../../components/atoms";
import { SubmitForm } from "../../../../components/intel/SubmitForm";
import { ApiCallError, fetchMyProblem } from "../../../../lib/api";
import { useSession } from "../../../../lib/useSession";
import { useProfile } from "../../../../lib/useProfile";

/**
 * Edit one of your own submissions.
 *
 * The server enforces ownership and refuses an APPROVED problem, so this page
 * is a convenience rather than the security boundary.
 */
export default function EditSubmissionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { session, loaded } = useSession();
  const { profile } = useProfile(session);

  const [problem, setProblem] = useState<MyProblemDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    if (!session) return;
    let alive = true;
    fetchMyProblem(session.token, id)
      .then((p) => alive && setProblem(p))
      .catch((e) =>
        alive &&
        setError(
          e instanceof ApiCallError ? e.message : "Could not load the problem.",
        ),
      )
      .finally(() => alive && setBusy(false));
    return () => {
      alive = false;
    };
  }, [session, id]);

  return (
    <AppShell session={session} profile={profile}>
      <div className="mx-auto w-full max-w-3xl px-5 py-8 sm:px-7">
        <p className="eyebrow">Module // intel</p>
        <h1 className="mt-2 text-2xl font-bold">
          {problem ? problem.title : "Edit submission"}
        </h1>

        {problem?.status === "REJECTED" && problem.reviewNote && (
          <div
            className="mt-4 rounded-[8px] border p-3"
            style={{
              borderColor: "var(--color-bad)",
              background: "color-mix(in srgb, var(--color-bad) 8%, transparent)",
            }}
          >
            <p
              className="font-mono text-[0.68rem] font-bold"
              style={{ color: "var(--color-bad)" }}
            >
              What the reviewer asked for
            </p>
            <p
              className="mt-1 font-mono text-[0.76rem] leading-relaxed"
              style={{ color: "var(--color-ink-dim)" }}
            >
              {problem.reviewNote}
            </p>
          </div>
        )}

        <div className="mt-6">
          {!loaded ? null : !session || session.isGuest ? (
            <SignInGate what="edit your submission" guest={!!session?.isGuest} />
          ) : busy ? (
            <div className="flex justify-center py-12">
              <Spinner />
            </div>
          ) : error ? (
            <ErrorBanner message={error} />
          ) : problem ? (
            <SubmitForm session={session} existing={problem} />
          ) : null}
        </div>
      </div>
    </AppShell>
  );
}
