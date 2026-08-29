"use client";

import { AdminShell } from "../../../components/AdminShell";
import { ProblemForm } from "../../../components/ProblemForm";

export default function NewProblemPage() {
  return (
    <AdminShell>
      <div className="flex flex-col gap-6">
        <div>
          <p className="label">Content</p>
          <h1 className="mt-1 text-2xl font-bold">New problem</h1>
        </div>
        <ProblemForm />
      </div>
    </AdminShell>
  );
}
