"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * What a signed-out visitor sees on a page that needs an account.
 *
 * Sends them to /signup rather than carrying a form itself: the credential
 * form is four fields plus an avatar picker, which is a page, not a panel
 * dropped into the middle of someone else's layout.
 *
 * The current path rides along as `next` so they land back here afterwards
 * instead of on a generic home page.
 */
export function SignInGate({
  what,
  guest = false,
}: {
  what: string;
  /** True when the visitor IS signed in, but only as a room-code guest. */
  guest?: boolean;
}) {
  const pathname = usePathname();
  const next = encodeURIComponent(pathname);

  return (
    <div className="panel mt-6 p-6">
      <h2 className="text-base font-bold">
        {guest ? "Create an account to continue" : "Sign in to continue"}
      </h2>
      <p
        className="mt-1.5 font-mono text-[0.78rem] leading-relaxed"
        style={{ color: "var(--color-ink-faint)" }}
      >
        {guest
          ? `You are playing as a guest. Guests can battle, but you need an account to ${what}.`
          : `You need an account to ${what}.`}
      </p>

      <div className="mt-5 flex flex-wrap gap-2.5">
        <Link href={`/signup?next=${next}`} className="btn btn-primary">
          Create account
        </Link>
        <Link href={`/login?next=${next}`} className="btn btn-ghost">
          Log in
        </Link>
      </div>
    </div>
  );
}
