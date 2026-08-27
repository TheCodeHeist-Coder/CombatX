"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "../AppShell";
import { AuthArtwork } from "./AuthArtwork";
import { AuthPanel } from "./AuthPanel";
import { useSession } from "../../lib/useSession";

/**
 * The shared frame for /signup and /login.
 *
 * A 50/50 split above lg: artwork left, form right. Below that the artwork
 * column drops away entirely rather than stacking above the form — on a phone
 * it would push the fields below the fold, which is the one thing an auth page
 * must never do.
 *
 * Both pages are the same layout with different copy, so the split, the
 * already-signed-in redirect, and the `next` handling live here rather than
 * being written twice and drifting apart.
 */
export function AuthPageShell({
  mode,
  title,
  subtitle,
  artSrc,
  artHeadline,
  artBody,
  altHref,
  altPrompt,
  altLabel,
}: {
  mode: "signup" | "login";
  title: string;
  subtitle: string;
  /** Each page brings its own artwork, so the two do not look identical. */
  artSrc: string;
  artHeadline: readonly string[];
  artBody: string;
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
      <div className="grid min-h-[calc(100dvh-8rem)] lg:grid-cols-2">
        {/* Left: the artwork. Hidden below lg — see the component note. */}
        <div
          className="hidden border-r lg:block"
          style={{ borderColor: "var(--color-line)" }}
        >
          <AuthArtwork
            src={artSrc}
            headline={artHeadline}
            body={artBody}
          />
        </div>

        {/* Right: the form, centred in its half. */}
        <div className="flex items-center justify-center px-5 py-12 sm:px-8">
          <div className="w-full max-w-sm">
            <h1 className="wordmark grad-text text-[clamp(1.9rem,4vw,2.6rem)] leading-none">
              {title}
            </h1>
            <p
              className="mt-3 font-mono text-[0.78rem] leading-relaxed"
              style={{ color: "var(--color-ink-faint)" }}
            >
              {subtitle}
            </p>

            <div className="mt-7">
              <AuthPanel
                mode={mode}
                onReady={() => {
                  refresh();
                  router.push(next);
                }}
              />
            </div>

            <p
              className="mt-6 text-center font-mono text-[0.75rem]"
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
      </div>
    </AppShell>
  );
}
