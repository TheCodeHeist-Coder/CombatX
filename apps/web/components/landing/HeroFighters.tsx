/**
 * The two hero fighters.
 *
 * The reference art is a pair of cut-out boxer photographs. Those are licensed
 * images we don't have, so this draws a stylised silhouette in the same pose
 * and lighting instead — blue-lit on the left, orange-lit on the right —
 * sitting in exactly the space the photos occupy.
 *
 * To use real cut-outs later: drop transparent PNGs at
 * /public/fighter-left.png and /public/fighter-right.png and swap the <svg>
 * for an <img>. Nothing else in the layout needs to change.
 */
export function HeroFighter({
  side,
  className,
}: {
  side: "left" | "right";
  className?: string;
}) {
  const glow = side === "left" ? "var(--color-side-a)" : "var(--color-side-b)";
  const flip = side === "right";

  return (
    <div
      className={className}
      style={{
        filter: `drop-shadow(0 0 40px color-mix(in srgb, ${glow} 55%, transparent))`,
        transform: flip ? "scaleX(-1)" : undefined,
      }}
      aria-hidden
    >
      <svg
        viewBox="0 0 120 200"
        width="100%"
        height="100%"
        fill="none"
        preserveAspectRatio="xMidYMax meet"
      >
        <defs>
          <linearGradient id={`fg-${side}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={glow} stopOpacity="0.95" />
            <stop offset="55%" stopColor={glow} stopOpacity="0.45" />
            <stop offset="100%" stopColor={glow} stopOpacity="0.12" />
          </linearGradient>
        </defs>

        {/* Head, tucked behind the lead shoulder as a guard implies. */}
        <ellipse cx="62" cy="30" rx="14" ry="16" fill={`url(#fg-${side})`} />

        {/* Torso, twisted side-on into the stance. */}
        <path
          d="M46 50c7-5 26-5 33 1 6 6 9 22 8 37-1 12-3 20-5 26H43c-3-8-6-17-6-29 0-15 3-30 9-35z"
          fill={`url(#fg-${side})`}
        />

        {/* Lead arm: elbow tucked, fist up at chin height. */}
        <path
          d="M47 58c-10 2-19 9-23 19-3 8-1 14 4 16l7-15c2-6 7-11 13-13z"
          fill={`url(#fg-${side})`}
        />
        <circle cx="30" cy="88" r="12" fill={`url(#fg-${side})`} />

        {/* Rear arm: cocked, fist held back ready to throw. */}
        <path
          d="M78 60c11 2 19 9 22 19 2 7 0 12-5 13l-6-13c-3-6-7-10-13-12z"
          fill={`url(#fg-${side})`}
        />
        <circle cx="96" cy="86" r="11" fill={`url(#fg-${side})`} />

        {/* Legs: front foot forward, rear leg driving — a boxer's stance. */}
        <path
          d="M43 114h36c3 14 4 28 3 40l-4 32H64l-2-42-9 42H40c-2-24-1-49 3-72z"
          fill={`url(#fg-${side})`}
        />
      </svg>
    </div>
  );
}
