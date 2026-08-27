"use client";

import { useEffect, useState } from "react";

/**
 * The artwork panel beside an auth form.
 *
 * Signup and login each pass their own headline and image, so the two pages
 * feel like different rooms rather than the same wall twice. Drop the files
 * in at:
 *
 *   apps/web/public/auth-duel.png     (signup — two coders squaring off)
 *   apps/web/public/auth-return.png   (login  — the returning fighter)
 *
 * Like the hero fighters, each file is probed before it is committed to the
 * DOM, so a missing image degrades to the copy alone rather than a broken
 * image box. Replacing those files is the whole job.
 */
export function AuthArtwork({
  src,
  headline,
  body,
}: {
  src: string;
  /** Split across lines by the caller; rendered in the display face. */
  headline: readonly string[];
  body: string;
}) {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const probe = new window.Image();
    let alive = true;
    probe.onload = () => alive && setLoaded(true);
    probe.onerror = () => alive && setLoaded(false);
    probe.src = src;
    return () => {
      alive = false;
    };
  }, [src]);

  return (
    <div className="relative flex h-full flex-col justify-center overflow-hidden px-8 py-12 xl:px-12">
      {/*
        The two-tone wash the artwork sits on. Blue left, orange right —
        the same side colours the arena uses, so the page reads as part of
        the battle rather than as a generic auth screen.
      */}
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden
        style={{
          background:
            "radial-gradient(70% 60% at 12% 45%, color-mix(in srgb, var(--color-side-a) 16%, transparent), transparent 72%), radial-gradient(70% 60% at 88% 45%, color-mix(in srgb, var(--color-side-b) 15%, transparent), transparent 72%)",
        }}
      />

      <div className="relative z-10 mx-auto w-full max-w-xl text-center">
        <h2 className="wordmark grad-text text-[clamp(2.4rem,4.6vw,4rem)] leading-[0.95]">
          {headline.map((line) => (
            <span key={line} className="block">
              {line}
            </span>
          ))}
        </h2>

        <p
          className="mx-auto mt-5 max-w-sm font-mono text-[0.82rem] leading-[1.9]"
          style={{ color: "var(--color-ink-dim)" }}
        >
          {body}
        </p>

        {loaded && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt=""
            className="mt-8 w-full object-contain"
            style={{ maxHeight: "min(52vh, 32rem)" }}
          />
        )}
      </div>
    </div>
  );
}
