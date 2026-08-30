import { CRESTS, TIER_CRESTS, type Crest } from "./crests";

/**
 * A hexagon achievement medal, in the shape GitHub's profile achievements use.
 *
 * WHY A HEXAGON AND NOT A ROUNDED SQUARE
 * --------------------------------------
 * A square badge reads as an icon — a UI affordance. A hexagon with a rim and
 * a highlight reads as a MEDAL: an object that was awarded rather than a
 * control you can press. That distinction is most of why GitHub's achievements
 * feel earned, and it costs nothing but the silhouette.
 *
 * HOW THE DEPTH IS BUILT
 * ----------------------
 * Five stacked layers, outermost first:
 *
 *   1. Rim        the metal edge, a vertical gradient (light top, dark bottom)
 *   2. Bezel      a thin inset ring that separates rim from face
 *   3. Face       the coloured field, radial gradient lit from upper-left.
 *                 Kept deliberately dim: the rim carries the rarity colour, so
 *                 a bright face would compete with the artwork sitting on it.
 *   4. Artwork    the 12x12 animal, clipped to the hexagon
 *   5. Gloss      a soft highlight across the top third
 *
 * All of it is inline SVG, so a medal recolours per rarity from one component
 * instead of needing 26 exported images, and stays sharp at any size.
 *
 * Every gradient id is suffixed with a per-instance `uid`. SVG defs share one
 * global namespace across the whole document, so two medals with the same
 * hard-coded id would make the second silently inherit the first one's colours.
 */

/** Points of a flat-top hexagon inscribed in a 100x100 box. */
const HEX = "50,3 93,26 93,74 50,97 7,74 7,26";
/** The same hexagon inset slightly, for the face beneath the rim. */
const HEX_INNER = "50,10 87,30 87,70 50,90 13,70 13,30";

export interface MedalTone {
  /** The face colour — carries rarity or tier. */
  base: string;
  /** The lighter edge of the rim. */
  rimLight: string;
  /** The darker edge of the rim. */
  rimDark: string;
}

export function Medal({
  crest,
  tone,
  size = 64,
  muted = false,
  tier,
  title,
  uid,
}: {
  crest: Crest;
  tone: MedalTone;
  size?: number;
  /** Draw drained of colour, for a badge that is not yet earned. */
  muted?: boolean;
  /** Optional tier multiplier bubble, e.g. 2 renders as "x2". */
  tier?: number;
  title?: string;
  /** Unique suffix for this instance's gradient ids. */
  uid: string;
}) {
  const g = (n: string) => `${n}-${uid}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role="img"
      aria-label={title ?? `${crest.animal} medal`}
      style={{
        display: "block",
        flexShrink: 0,
        filter: muted ? "grayscale(1)" : undefined,
        opacity: muted ? 0.45 : 1,
        overflow: "visible",
      }}
    >
      {title && <title>{title}</title>}

      <defs>
        {/* The rim: light at the top, dark at the bottom, so the medal reads
            as a solid object lit from above. */}
        <linearGradient id={g("rim")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={tone.rimLight} />
          <stop offset="52%" stopColor={tone.rimDark} />
          <stop offset="100%" stopColor={tone.rimLight} stopOpacity="0.85" />
        </linearGradient>

        {/* The face, lit from the upper left. */}
        <radialGradient id={g("face")} cx="35%" cy="26%" r="82%">
          <stop offset="0%" stopColor={tone.base} stopOpacity="0.62" />
          <stop offset="58%" stopColor={tone.base} stopOpacity="0.3" />
          <stop offset="100%" stopColor="#0b0d12" stopOpacity="0.96" />
        </radialGradient>

        {/* The gloss across the top third. */}
        <linearGradient id={g("gloss")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.26" />
          <stop offset="45%" stopColor="#ffffff" stopOpacity="0.06" />
          <stop offset="60%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>

        {/* Clips the pixel artwork to the medal face so no stray cell pokes
            outside the hexagon at small sizes. */}
        <clipPath id={g("clip")}>
          <polygon points={HEX_INNER} />
        </clipPath>
      </defs>

      {/* 1. Rim */}
      <polygon
        points={HEX}
        fill={`url(#${g("rim")})`}
        stroke={tone.rimDark}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />

      {/* 2. Bezel — a hairline inset that stops rim and face bleeding together. */}
      <polygon
        points={HEX_INNER}
        fill="none"
        stroke="#0b0d12"
        strokeWidth="3"
        strokeLinejoin="round"
        opacity="0.55"
      />

      {/* 3. Face */}
      <polygon points={HEX_INNER} fill={`url(#${g("face")})`} />

      {/* 4. Artwork, scaled from the 12x12 grid into the face and clipped. */}
      <g clipPath={`url(#${g("clip")})`}>
        <g transform="translate(26 24) scale(4.0)" shapeRendering="crispEdges">
          {crest.rows.map((row, y) =>
            row.split("").map((ch, x) => {
              if (ch === ".") return null;
              const fill = crest.palette[ch];
              if (!fill) return null;
              return (
                <rect
                  key={`${x}-${y}`}
                  x={x}
                  y={y}
                  width="1"
                  height="1"
                  fill={fill}
                />
              );
            }),
          )}
        </g>
      </g>

      {/* 5. Gloss, drawn last so it sits over the artwork. */}
      <polygon
        points={HEX_INNER}
        fill={`url(#${g("gloss")})`}
        pointerEvents="none"
      />

      {/* Inner rim highlight — one bright stroke along the top edges, which is
          what sells the metal more than any amount of gradient. */}
      <polyline
        points="13,70 13,30 50,10 87,30"
        fill="none"
        stroke="#ffffff"
        strokeOpacity="0.22"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        pointerEvents="none"
      />

      {/* The tier multiplier bubble, as on GitHub's repeatable achievements. */}
      {tier && tier > 1 && (
        <g>
          <circle
            cx="82"
            cy="82"
            r="17"
            fill="#12141a"
            stroke={tone.rimLight}
            strokeWidth="2.5"
          />
          <text
            x="82"
            y="82"
            textAnchor="middle"
            dominantBaseline="central"
            fontSize="19"
            fontWeight="700"
            fill={tone.rimLight}
            fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
          >
            x{tier}
          </text>
        </g>
      )}
    </svg>
  );
}

/** Look up and render a badge's medal. Returns null when no art exists. */
export function BadgeMedal(props: {
  badgeKey: string;
  tone: MedalTone;
  size?: number;
  muted?: boolean;
  tier?: number;
  title?: string;
}) {
  const crest = CRESTS[props.badgeKey];
  if (!crest) return null;
  return <Medal {...props} crest={crest} uid={props.badgeKey} />;
}

/** Look up and render a tier's medal. Returns null when no art exists. */
export function TierMedal(props: {
  tierKey: string;
  tone: MedalTone;
  size?: number;
  title?: string;
}) {
  const crest = TIER_CRESTS[props.tierKey];
  if (!crest) return null;
  return <Medal {...props} crest={crest} uid={`tier-${props.tierKey}`} />;
}
