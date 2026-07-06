"use client";

import Link from "next/link";
import { Logo } from "./Logo.js";
import type { Session } from "../lib/session.js";

/** Slim app header: wordmark on the left, guest identity on the right. */
export function TopBar({
  session,
  right,
}: {
  session?: Session | null;
  right?: React.ReactNode;
}) {
  return (
    <header className="mb-8 flex items-center justify-between">
      <Link href="/" className="transition-opacity hover:opacity-80">
        <Logo />
      </Link>
      <div className="flex items-center gap-3">
        {right}
        {session && (
          <span className="chip">
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: "var(--color-good)" }}
            />
            {session.displayName}
          </span>
        )}
      </div>
    </header>
  );
}
