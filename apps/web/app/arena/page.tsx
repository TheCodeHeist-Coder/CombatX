"use client";

import { ComingSoon } from "../../components/ComingSoon";

export default function Page() {
  return (
    <ComingSoon
      title="Arena"
      code="Sector // arena"
      summary="The Arena opens from inside a battle room. Create or join one from Mission Control to deploy — there is no standalone arena view yet."
      planned={[
        "Direct re-entry into an in-progress battle.",
        "Spectator mode for rooms you are not seated in.",
        "Replay of a finished battle's timeline.",
      ]}
    />
  );
}
