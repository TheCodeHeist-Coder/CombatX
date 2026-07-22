"use client";

import { ComingSoon } from "../../components/ComingSoon";

export default function Page() {
  return (
    <ComingSoon
      title="Rankings"
      code="Module // rankings"
      summary="Progression is live — XP, win streaks, and rank tiers are awarded on every finished battle — but there is no cross-user leaderboard endpoint yet."
      planned={[
        "Global XP leaderboard.",
        "Streak and win-rate boards.",
        "Head-to-head record against a given opponent.",
      ]}
    />
  );
}
