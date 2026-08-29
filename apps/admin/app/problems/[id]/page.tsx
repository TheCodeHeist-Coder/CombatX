"use client";

import { use, useEffect, useState } from "react";
import type { AdminProblemDetail } from "@repo/protocol";
import { AdminShell } from "../../../components/AdminShell";
import {
  Chip,
  ErrorBanner,
  PageHeader,
  Spinner,
} from "../../../components/atoms";
import { ProblemForm } from "../../../components/ProblemForm";
import { fetchProblem, AdminApiError } from "../../../lib/api";
import { useAdminSession } from "../../../lib/useAdminSession";

export default function EditProblemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return (
    <AdminShell>
      <EditProblem id={id} />
    </AdminShell>
  );
}

function EditProblem({ id }: { id: string }) {
  const { session } = useAdminSession();
  const [problem, setProblem] = useState<AdminProblemDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;
    let alive = true;
    fetchProblem(session.token, id)
      .then((p) => alive && setProblem(p))
      .catch(
        (err) =>
          alive &&
          setError(
            err instanceof AdminApiError
              ? err.message
              : "Could not load that problem.",
          ),
      );
    return () => {
      alive = false;
    };
  }, [session, id]);

  if (error) return <ErrorBanner message={error} />;
  if (!problem) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Spinner />
      </div>
    );
  }

  const difficultyColour =
    problem.difficulty === "EASY"
      ? "var(--color-good)"
      : problem.difficulty === "HARD"
        ? "var(--color-bad)"
        : "var(--color-warn)";

  return (
    <div className="flex flex-col gap-7">
      <PageHeader
        eyebrow="Edit problem"
        title={problem.title}
        actions={
          <div className="flex items-center gap-2">
            <Chip color={difficultyColour}>
              {problem.difficulty.toLowerCase()}
            </Chip>
            <Chip>
              {problem.testCases.length} test
              {problem.testCases.length === 1 ? "" : "s"}
            </Chip>
            {problem.battleCount > 0 && (
              <Chip color="var(--color-warn)">
                used in {problem.battleCount}
              </Chip>
            )}
          </div>
        }
      />
      {/* Keyed by id so navigating between problems remounts the form with
          fresh state rather than keeping the previous problem's drafts. */}
      <ProblemForm key={problem.id} existing={problem} />
    </div>
  );
}
