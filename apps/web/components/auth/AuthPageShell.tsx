"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "../AppShell";
import { AuthPanel } from "./AuthPanel";
import { useSession } from "../../lib/useSession";

/**
 * The shared frame for /signup and /login.
 *
 * Both pages are the same card with different copy, so the layout, the
 * already-signed-in redirect, and the `next` handling live here rather than
 * being written twice and drifting apart.
 */
export function AuthPageShell({
  mode,
  title,
  subtitle,
  altHref,
  altPrompt,
  altLabel,
}: {
  mode: "signup" | "login";
  title: string;
  subtitle: string;
  altHref: string;
  altPrompt: string;
  altLabel: string;
}) {
  const { session, loaded, refresh } = useSession();
  const router = useRouter();
  const params = useSearchParams();

  // Where to land afterwards. Restricted to a site-relative path: taking an
  // arbitrary URL from the query string would make this an open redirect,
  // which is exactly the shape phishing links exploit.
  const raw = params.get("next");
  const next = raw && /^\/(?!\/)/.test(raw) ? raw : "/arena";

  // Someone already signed in has no business on these pages.
  useEffect(() => {
    if (loaded && session) router.replace(next);
  }, [loaded, session, next, router]);

  return (
    <AppShell session={session}>
      <div className="mx-auto w-full max-w-md px-5 py-12 sm:px-7">
        <div className="panel p-6 sm:p-7">
          <h1 className="wordmark text-[clamp(1.6rem,5vw,2.1rem)] leading-none">
            {title}
          </h1>
          <p
            className="mt-2.5 font-mono text-[0.78rem] leading-relaxed"
            style={{ color: "var(--color-ink-faint)" }}
          >
            {subtitle}
          </p>

          <div className="mt-6">
            <AuthPanel
              mode={mode}
              onReady={() => {
                refresh();
                router.push(next);
              }}
            />
          </div>

          <p
            className="mt-5 text-center font-mono text-[0.75rem]"
            style={{ color: "var(--color-ink-faint)" }}
          >
            {altPrompt}{" "}
            <Link
              href={
                raw ? `${altHref}?next=${encodeURIComponent(next)}` : altHref
              }
              className="underline underline-offset-2"
              style={{ color: "var(--color-accent)" }}
            >
              {altLabel}
            </Link>
          </p>
        </div>
      </div>
    </AppShell>
  );
}
