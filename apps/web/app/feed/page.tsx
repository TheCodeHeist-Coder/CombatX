"use client";

import { ComingSoon } from "../../components/ComingSoon";

export default function Page() {
  return (
    <ComingSoon
      title="Tactical Feed"
      code="Module // feed"
      summary="A live feed of battles across the instance. The judge already publishes verdicts over Redis pub/sub, so the data exists — it is simply not aggregated or exposed."
      planned={[
        "Live global battle ticker.",
        "Recent finishes with outcome and margin.",
        "Follow specific operatives.",
      ]}
    />
  );
}
