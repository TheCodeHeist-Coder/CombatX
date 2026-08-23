import Image from "next/image";

/**
 * The two hero warriors.
 *
 * Drop your own cut-out artwork in — transparent PNG or WebP works best, since
 * the figures sit directly on the page background with no plate behind them:
 *
 *   apps/web/public/fighter-left.png    (blue-lit, faces right)
 *   apps/web/public/fighter-right.png   (orange-lit, faces left)
 *
 * The side glow, float animation, and sizing are applied here, so swapping the
 * files is the whole job — no layout change needed. If an image is missing the
 * slot renders empty rather than showing a broken-image icon, so the hero
 * still looks intentional before the art lands.
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

  return (
    <div
      className={`relative ${className ?? ""}`}
      style={{
        // The coloured rim-light that ties each fighter to their side.
        filter: `drop-shadow(0 0 40px color-mix(in srgb, ${glow} 55%, transparent))`,
      }}
      aria-hidden
    >
      <Image
        src={src}
        alt=""
        fill
        sizes="(max-width: 1280px) 0px, 220px"
        // `contain` keeps any aspect ratio intact and bottom-anchors the
        // figure, so art taller or wider than the slot still stands on the
        // same line rather than being cropped or stretched.
        style={{ objectFit: "contain", objectPosition: "bottom center" }}
        priority={false}
        // A missing file would otherwise render as a broken-image icon.
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
        }}
      />
    </div>
  );
}
