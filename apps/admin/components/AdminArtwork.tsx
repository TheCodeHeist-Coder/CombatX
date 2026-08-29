"use client";

import { useEffect, useState } from "react";

/**
 * The artwork panel beside the sign-in form.
 *
 * Drop a transparent PNG or WebP in at:
 *
 *   apps/admin/public/admin-hero.png
 *
 * Like the player app's hero fighters, the file is probed before it is
 * committed to the DOM, so a missing image degrades to the copy alone rather
 * than a broken-image box. Replacing that one file is the whole job.
 */
export function AdminArtwork() {
  const src = "/admin-hero.png";
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
    <div className="relative flex h-full flex-col justify-center overflow-hidden px-8 py-12 xl:px-14">
      {/* The player app's two-tone wash — blue left, orange right — so the
          console's door looks like the rest of CombatX. */}
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden
        style={{
          background:
            "radial-gradient(70% 60% at 14% 42%, color-mix(in srgb, var(--color-side-a) 16%, transparent), transparent 72%), radial-gradient(70% 60% at 88% 52%, color-mix(in srgb, var(--color-side-b) 15%, transparent), transparent 72%)",
        }}
      />

      <div className="relative z-10 mx-auto w-full max-w-lg text-center">
        <p className="label" style={{ letterSpacing: "0.2em" }}>
          Restricted area
        </p>

        <h2 className="wordmark grad-text mt-4 text-[clamp(2.2rem,4.2vw,3.5rem)] leading-[0.95]">
          <span className="block">Run the</span>
          <span className="block">arena</span>
        </h2>

        <p
          className="mx-auto mt-5 max-w-sm font-mono text-[0.82rem] leading-[1.9]"
          style={{ color: "var(--color-ink-dim)" }}
        >
          Set the problems every battle is fought over, watch who is online, and
          keep the arena honest.
        </p>

        {loaded && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt=""
            className="mt-8 w-full object-contain"
            style={{ maxHeight: "min(48vh, 30rem)" }}
          />
        )}

        {/* A short capability list, so the panel still carries weight before
            any artwork is dropped in. */}
        <ul className="mt-9 flex flex-col gap-2.5 text-left">
          {CAPABILITIES.map((c) => (
            <li key={c} className="flex items-start gap-2.5">
              <span
                className="mt-[0.42rem] h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ background: "var(--color-primary)" }}
                aria-hidden
              />
              <span
                className="font-mono text-[0.76rem] leading-relaxed"
                style={{ color: "var(--color-ink-faint)" }}
              >
                {c}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

const CAPABILITIES = [
  "Author problems, test cases and starter code",
  "Track live players, battles and submissions",
  "Read traffic no analytics vendor ever sees",
] as const;
