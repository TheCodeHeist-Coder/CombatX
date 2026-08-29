"use client";

import { AdminShell } from "../../../components/AdminShell";
import { PageHeader } from "../../../components/atoms";
import { ProblemForm } from "../../../components/ProblemForm";

export default function NewProblemPage() {
  return (
    <AdminShell>
      <div className="flex flex-col gap-7">
        <PageHeader
          eyebrow="Content"
          title="New problem"
          lede="Players read the statement, the judge runs the tests. Hidden tests are what actually decide a battle."
        />
        <ProblemForm />
      </div>
    </AdminShell>
  );
}
