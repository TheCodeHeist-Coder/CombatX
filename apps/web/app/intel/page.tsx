"use client";

import { ComingSoon } from "../../components/ComingSoon";

export default function Page() {
  return (
    <ComingSoon
      title="Intel"
      code="Sector // intel"
      summary="Problem intelligence — statements, difficulty spread, and per-problem pass rates — is not exposed yet. Problems currently live only in the seed data."
      planned={[
        "Browse the problem catalogue.",
        "Aggregate pass rate and average solve time per problem.",
        "Contribute your own problems and hidden tests.",
      ]}
    />
  );
}
