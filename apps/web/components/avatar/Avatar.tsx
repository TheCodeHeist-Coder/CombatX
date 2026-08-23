import type { AvatarId } from "@repo/protocol";
import { SPRITES, SPRITE_NAMES } from "./sprites";

/**
 * Renders a pixel-art character as inline SVG.
 *
 * SVG rather than an <img>: the sprites are 12x12 grids of flat colour, so the
 * markup is smaller than a PNG, scales to any size without blurring, and the
 * background colour is a prop rather than 8 baked variants per character.
 *
 * `shapeRendering="crispEdges"` is what keeps the pixel boundaries hard at
 * large sizes — without it the rasteriser antialiases every cell edge.
 */
export function Avatar({
  avatarId,
  color,
  size = 40,
  rounded = 6,
  className,
  ring,
}: {
  avatarId: AvatarId;
  /** Background colour behind the sprite. */
  color: string;
  /** Rendered width/height in px. */
  size?: number;
  /** Corner radius in px. Pass 999 for a circle. */
  rounded?: number;
  className?: string;
  /** Optional outline colour — used to mark "you" vs the opponent. */
  ring?: string;
}) {
  const sprite = SPRITES[avatarId] ?? SPRITES.frog;
  const name = SPRITE_NAMES[avatarId] ?? "Player";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 12 12"
      shapeRendering="crispEdges"
      className={className}
      role="img"
      aria-label={`${name} avatar`}
      style={{
        borderRadius: rounded === 999 ? "999px" : `${rounded}px`,
        boxShadow: ring ? `0 0 0 2px ${ring}` : undefined,
        display: "block",
        flexShrink: 0,
      }}
    >
      <rect width="12" height="12" fill={color} />
      {sprite.rows.map((row, y) =>
        row.split("").map((ch, x) => {
          if (ch === ".") return null;
          const fill = sprite.palette[ch];
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
    </svg>
  );
}
