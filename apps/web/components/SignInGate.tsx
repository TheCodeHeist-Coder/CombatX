"use client";

import { GuestGate } from "./GuestGate";

/**
 * What a signed-out visitor sees on a page that needs an identity.
 *
 * It carries the sign-up form itself rather than pointing at the lobby and
 * leaving you to find it: every one of these pages is reachable straight from
 * the top nav, so "go elsewhere first" is a dead end at exactly the moment
 * someone is trying to use the feature.
 */
export function SignInGate({
  what,
  onReady,
}: {
  what: string;
  /**
   * The host page's session refresh. The session lives in localStorage, which
   * no router refresh re-reads, so the page must be told to look again itself.
   */
  onReady: () => void;
}) {
  return (
    <div className="panel mt-6 p-6">
      <h2 className="text-base font-bold">Pick a character to continue</h2>
      <p
        className="mt-1.5 font-mono text-[0.78rem] leading-relaxed"
        style={{ color: "var(--color-ink-faint)" }}
      >
        You need an identity to {what}. No account, no password — choose a
        character and a callsign and you are in.
      </p>

      <div className="mt-5 max-w-sm">
        <GuestGate onReady={onReady} />
      </div>
    </div>
  );
}
