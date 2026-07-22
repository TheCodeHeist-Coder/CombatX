"use client";

import { ComingSoon } from "../../components/ComingSoon";

export default function Page() {
  return (
    <ComingSoon
      title="Archive"
      code="Sector // archive"
      summary="Battle history is persisted in Postgres, but there is no endpoint to list a user's past battles yet — a single result can only be fetched by ID."
      planned={[
        "Every battle you have fought, newest first.",
        "Filter by outcome, difficulty, and opponent.",
        "Re-open any past result page.",
      ]}
    />
  );
}
