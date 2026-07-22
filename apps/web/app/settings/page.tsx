"use client";

import { ComingSoon } from "../../components/ComingSoon";

export default function Page() {
  return (
    <ComingSoon
      title="Settings"
      code="Module // settings"
      summary="There is nothing to configure yet: play is guest-only, so there is no account, password, or persisted preference to change."
      planned={[
        "Change your display name.",
        "Reduced-motion and theme preferences.",
        "Clear local session data.",
      ]}
    />
  );
}
