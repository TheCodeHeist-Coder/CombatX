import { CRESTS, TIER_CRESTS, type Crest } from "./crests";

/**
 * Renders an animal crest as inline SVG.
 *
 * Inline SVG rather than an <img>: a crest is a 12x12 grid of flat colour, so
 * the markup is smaller than a PNG, scales to any size without blurring, and
 * the frame colour can be a prop instead of 26 baked variants per rarity.
 * This is the same technique as components/avatar/Avatar.tsx, deliberately —
 * badges and player avatars should look like they came from one hand.
 *
 * `shapeRendering="crispEdges"` is what keeps the pixel boundaries hard at
 * large sizes; without it the rasteriser antialiases every cell edge and the
 * art turns to mush.
 */
export function CrestArt({
  crest,
  size = 44,
  frame,
  background,
  muted = false,
  title,
}: {
  crest: Crest;
  /** Rendered width/height in px. */
  size?: number;
  /** Border colour. Carries rarity for a badge, tier colour for a crest. */
  frame?: string;
  /** Fill behind the animal. */
  background?: string;
  /** Draw desaturated, for a badge that is not yet earned. */
  muted?: boolean;
  title?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="-1 -1 14 14"
      shapeRendering="crispEdges"
      role="img"
      aria-label={title ?? `${crest.animal} crest`}
      style={{
        display: "block",
        flexShrink: 0,
        // Locked badges are drained of colour rather than hidden: the shape
        // still reads, so a player can see what they are working toward.
        filter: muted ? "grayscale(1)" : undefined,
        opacity: muted ? 0.42 : 1,
      }}
    >
      {title && <title>{title}</title>}

      {/* The medal field, with a 1px rounded frame carrying the rarity. */}
      <rect
        x="-1"
        y="-1"
        width="14"
        height="14"
        rx="3.5"
        fill={background ?? "var(--color-surface-3)"}
        stroke={frame ?? "var(--color-line-strong)"}
        strokeWidth="1"
      />

      {crest.rows.map((row, y) =>
        row.split("").map((ch, x) => {
          if (ch === ".") return null;
          const fill = crest.palette[ch];
          if (!fill) return null;
          return (
            <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill={fill} />
          );
        }),
      )}
    </svg>
  );
}

/** Look up and render a badge's crest. Returns null when none is drawn. */
export function BadgeCrest(props: {
  badgeKey: string;
  size?: number;
  frame?: string;
  background?: string;
  muted?: boolean;
  title?: string;
}) {
  const crest = CRESTS[props.badgeKey];
  if (!crest) return null;
  return <CrestArt {...props} crest={crest} />;
}

/** Look up and render a tier's crest. Returns null when none is drawn. */
export function TierCrestArt(props: {
  tierKey: string;
  size?: number;
  frame?: string;
  background?: string;
  title?: string;
}) {
  const crest = TIER_CRESTS[props.tierKey];
  if (!crest) return null;
  return <CrestArt {...props} crest={crest} />;
}
