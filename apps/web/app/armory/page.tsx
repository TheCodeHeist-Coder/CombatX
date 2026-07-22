"use client";

import { ComingSoon } from "../../components/ComingSoon";

export default function Page() {
  return (
    <ComingSoon
      title="Armory"
      code="Module // armory"
      summary="Language runtimes and editor configuration. Python 3.12 is provisioned today; the protocol already models JavaScript, C++, and Java."
      planned={[
        "Enable additional language runtimes.",
        "Per-language starter templates.",
        "Editor keybindings and theme.",
      ]}
    />
  );
}
