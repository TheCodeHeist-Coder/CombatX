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

/**
 * Leaf positions along one laurel branch, mirrored for the other side.
 *
 * A table rather than a generated arc: the leaves have to sit ON the stem
 * path, and hand-placing eleven of them is both shorter and more controllable
 * than solving for points along a bezier at render time.
 */
const LAUREL_LEAVES = [
  { x: 40, y: 101, r: 24 },
  { x: 30, y: 97, r: 38 },
  { x: 21, y: 90, r: 52 },
  { x: 14, y: 81, r: 64 },
  { x: 9, y: 70, r: 76 },
  { x: 6, y: 58, r: 86 },
  { x: 6, y: 46, r: 98 },
  { x: 8, y: 35, r: 110 },
  { x: 12, y: 24, r: 122 },
  { x: 16, y: 19, r: 128 },
] as const;

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
  ornate = false,
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
  /**
   * Draw the honours treatment: a gold laurel wreath, an outer glow and a
   * jewelled rim.
   *
   * Reserved for CONTRIBUTION badges. Everything else on a profile is won by
   * FIGHTING; these are the only ones given for building something other
   * players use, and a wreath is the oldest visual language there is for that
   * distinction. Using it for an ordinary badge would spend the difference.
   */
  ornate?: boolean;
  title?: string;
  /** Unique suffix for this instance's gradient ids. */
  uid: string;
}) {
  const g = (n: string) => `${n}-${uid}`;

  return (
    <svg
      width={size}
      height={size}
      /* Padded past 100x100: the rim stroke and the multiplier bubble both
         extend beyond the hexagon's own bounds, and with a viewBox of exactly
         0 0 100 100 they get clipped wherever an ancestor sets overflow
         hidden — as a table row does. */
      /* Ornate medals carry a laurel wreath outside the hexagon, so they need
         more room than the rim stroke alone. */
      viewBox={ornate ? "-20 -14 140 132" : "-4 -4 108 108"}
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
        {/*
          The face, lit from the upper left.

          An ornate medal gets a DARK, warm-tinted well instead of a tinted
          one. Measured: at the same opacities the gold washed out the pixel
          art and the spider and owl stopped reading at all. The gold belongs
          on the rim and the wreath, where nothing has to be legible through it.
        */}
        <radialGradient id={g("face")} cx="35%" cy="26%" r="82%">
          {ornate ? (
            <>
              <stop offset="0%" stopColor="#2a2417" />
              <stop offset="58%" stopColor="#1a1710" />
              <stop offset="100%" stopColor="#0b0d12" />
            </>
          ) : (
            <>
              <stop offset="0%" stopColor={tone.base} stopOpacity="0.62" />
              <stop offset="58%" stopColor={tone.base} stopOpacity="0.3" />
              <stop offset="100%" stopColor="#0b0d12" stopOpacity="0.96" />
            </>
          )}
        </radialGradient>

        {/* The gloss across the top third. */}
        <linearGradient id={g("gloss")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity={ornate ? 0.14 : 0.26} />
          <stop offset="45%" stopColor="#ffffff" stopOpacity="0.06" />
          <stop offset="60%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>

        {/* Clips the pixel artwork to the medal face so no stray cell pokes
            outside the hexagon at small sizes. */}
        <clipPath id={g("clip")}>
          <polygon points={HEX_INNER} />
        </clipPath>

        {ornate && (
          <>
            {/* Laurel gold, shaded so the wreath reads as metal rather than
                a flat yellow outline. */}
            <linearGradient id={g("laurel")} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ffe9a8" />
              <stop offset="45%" stopColor="#e8b54a" />
              <stop offset="100%" stopColor="#a0741f" />
            </linearGradient>

            {/* A soft halo. Kept low-opacity: it should suggest importance,
                not look like the medal is on fire. */}
            <radialGradient id={g("halo")} cx="50%" cy="50%" r="50%">
              <stop offset="55%" stopColor="#f0c05a" stopOpacity="0.32" />
              <stop offset="80%" stopColor="#f0c05a" stopOpacity="0.10" />
              <stop offset="100%" stopColor="#f0c05a" stopOpacity="0" />
            </radialGradient>
          </>
        )}
      </defs>

      {/* 0. The halo, behind everything. */}
      {ornate && !muted && (
        <circle cx="50" cy="50" r="66" fill={`url(#${g("halo")})`} pointerEvents="none" />
      )}

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


      {/* The laurel wreath: two mirrored branches meeting at a ribbon knot.
          Drawn after the medal so the leaves overlap its rim, which is what
          makes it read as a wreath AROUND the medal rather than a border. */}
      {ornate && (
        <g pointerEvents="none">
          {[-1, 1].map((side) => (
            <g key={side} transform={side === -1 ? "" : "translate(100 0) scale(-1 1)"}>
              {/* The branch: a stem sweeping from the knot up around the side. */}
              <path
                d="M50 105 C26 102 8 86 4 60 C2 42 8 27 17 16"
                fill="none"
                stroke={`url(#${g("laurel")})`}
                strokeWidth="3.2"
                strokeLinecap="round"
                opacity={muted ? 0.5 : 1}
              />
              {/* Leaves, spaced along the stem and rotated to follow it. */}
              {LAUREL_LEAVES.map((leaf, i) => (
                <ellipse
                  key={i}
                  cx={leaf.x}
                  cy={leaf.y}
                  rx="7.4"
                  ry="3.5"
                  fill={`url(#${g("laurel")})`}
                  transform={`rotate(${leaf.r} ${leaf.x} ${leaf.y})`}
                  opacity={muted ? 0.5 : 0.96}
                />
              ))}
            </g>
          ))}

          {/* The knot where the two branches meet. */}
          <circle
            cx="50"
            cy="104"
            r="5"
            fill={`url(#${g("laurel")})`}
            stroke="#7a5613"
            strokeWidth="0.8"
            opacity={muted ? 0.5 : 1}
          />
        </g>
      )}

      {/* The tier multiplier bubble, as on GitHub's repeatable achievements. */}
      {tier && tier > 1 && (
        /* On a wreathed medal the laurel fills the lower corners, so the
           bubble moves to the upper right where nothing is competing. */
        <g transform={ornate ? "translate(14 -26)" : undefined}>
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
  ornate?: boolean;
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
