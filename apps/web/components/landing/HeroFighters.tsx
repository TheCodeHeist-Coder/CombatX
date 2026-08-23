"use client";

import { useEffect, useState } from "react";

/**
 * The two hero warriors.
 *
 * Drop your own cut-out artwork in — a transparent PNG or WebP works best,
 * since the figures sit directly on the page background with no plate behind
 * them:
 *
 *   apps/web/public/fighter-left.png    (blue-lit, should face RIGHT)
 *   apps/web/public/fighter-right.png   (orange-lit, should face LEFT)
 *
 * The side glow, float animation, and sizing all live here, so replacing those
 * two files is the whole job — no layout change needed.
 *
 * The image is probed before it is rendered, so a slot with no art yet is
 * simply empty space rather than a broken-image box. That keeps the hero
 * looking deliberate both before and after the artwork arrives.
 */
export function HeroFighter({
  side,
  className,
}: {
  side: "left" | "right";
  className?: string;
}) {
  const glow = side === "left" ? "var(--color-side-a)" : "var(--color-side-b)";
  const src = side === "left" ? "/fighter-left.png" : "/fighter-right.png";

  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // Probe with a detached Image so nothing is committed to the DOM unless the
    // file really exists and decodes.
    const probe = new window.Image();
    let alive = true;
    probe.onload = () => alive && setLoaded(true);
    probe.onerror = () => alive && setLoaded(false);
    probe.src = src;
    return () => {
      alive = false;
    };
  }, [src]);

  if (!loaded) return null;

  return (
    <div
      className={className}
      style={{
        // The coloured rim-light that ties each fighter to their side.
        filter: `drop-shadow(0 0 40px color-mix(in srgb, ${glow} 55%, transparent))`,
      }}
      aria-hidden
    >
      {/* `contain` + bottom anchoring keeps any aspect ratio intact and stands
          the figure on the same line, so art taller or wider than the slot is
          never cropped or stretched.

          A plain <img>, not next/image: the source is user-supplied art that
          may not exist yet, and next/image turns a missing file into a
          server-side error rather than an empty slot. These are decorative and
          already gated behind a load probe, so the optimizer buys nothing. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" className="h-full w-full object-contain object-bottom" />
    </div>
  );
}
