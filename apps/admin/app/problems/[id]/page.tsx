"use client";

import { use, useEffect, useState } from "react";
import type { AdminProblemDetail } from "@repo/protocol";
import { AdminShell } from "../../../components/AdminShell";
import { ErrorBanner, Spinner } from "../../../components/atoms";
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

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="label">Content</p>
        <h1 className="mt-1 text-2xl font-bold">{problem.title}</h1>
      </div>
      {/* Keyed by id so navigating between problems remounts the form with
          fresh state rather than keeping the previous problem's drafts. */}
      <ProblemForm key={problem.id} existing={problem} />
    </div>
  );
}
