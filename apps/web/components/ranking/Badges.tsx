"use client";

import type { BadgeProgressView, BadgeView, RatingView } from "@repo/protocol";
import { TIERS } from "@repo/game";

/**
 * Badge and tier display.
 *
 * The visual language is deliberately GitHub-shaped: small, dense chips that
 * sit quietly on a profile and reward a closer look, rather than large trophy
 * art that would dominate the page. A player with twenty badges should still
 * have a readable profile.
 *
 * Colour is carried by RARITY, not by category, because rarity is the thing a
 * visitor is actually scanning for — "what is unusual about this person?".
 */

const RARITY: Record<string, { fg: string; bg: string; ring: string; label: string }> = {
  COMMON: {
    fg: "var(--color-ink-dim)",
    bg: "color-mix(in srgb, var(--color-ink-ghost) 12%, transparent)",
    ring: "var(--color-line-strong)",
    label: "Common",
  },
  UNCOMMON: {
    fg: "#4db6ac",
    bg: "color-mix(in srgb, #4db6ac 14%, transparent)",
    ring: "color-mix(in srgb, #4db6ac 40%, transparent)",
    label: "Uncommon",
  },
  RARE: {
    fg: "#42a5f5",
    bg: "color-mix(in srgb, #42a5f5 14%, transparent)",
    ring: "color-mix(in srgb, #42a5f5 45%, transparent)",
    label: "Rare",
  },
  LEGENDARY: {
    fg: "#f2622e",
    bg: "color-mix(in srgb, #f2622e 15%, transparent)",
    ring: "color-mix(in srgb, #f2622e 50%, transparent)",
    label: "Legendary",
  },
};

function rarity(key: string) {
  return RARITY[key] ?? RARITY.COMMON!;
}

/**
 * Tier colours, read from the single source of truth in @repo/game.
 *
 * Keyed by plain string because the tier arrives over the wire as one: an
 * unknown key (an older client meeting a newer tier) falls back rather than
 * failing to render.
 */
const TIER_COLOR = new Map<string, string>(TIERS.map((t) => [t.key, t.color]));

/**
 * One badge chip.
 *
 * `title` carries the description rather than a custom tooltip: it is
 * keyboard-reachable, works on every platform, and cannot be clipped by an
 * overflow container the way an absolutely-positioned tooltip can.
 */
export function Badge({
  badge,
  locked = false,
  size = "md",
}: {
  badge: BadgeView;
  locked?: boolean;
  size?: "sm" | "md";
}) {
  const r = rarity(badge.rarity);
  const small = size === "sm";

  return (
    <span
      title={
        locked
          ? `${badge.label} — ${badge.description} (not yet earned)`
          : `${badge.label} — ${badge.description}${
              badge.earnedAt ? ` · earned ${formatDate(badge.earnedAt)}` : ""
            }`
      }
      className="inline-flex items-center gap-1.5 rounded-full border font-mono whitespace-nowrap"
      style={{
        padding: small ? "0.15rem 0.5rem" : "0.28rem 0.7rem",
        fontSize: small ? "0.62rem" : "0.7rem",
        borderColor: locked ? "var(--color-line)" : r.ring,
        background: locked ? "transparent" : r.bg,
        color: locked ? "var(--color-ink-ghost)" : r.fg,
        opacity: locked ? 0.55 : 1,
      }}
    >
      <span
        aria-hidden
        className="inline-flex items-center justify-center rounded-full font-bold"
        style={{
          width: small ? "0.85rem" : "1rem",
          height: small ? "0.85rem" : "1rem",
          fontSize: small ? "0.5rem" : "0.58rem",
          background: locked ? "var(--color-surface-3)" : r.fg,
          color: locked ? "var(--color-ink-ghost)" : "var(--color-void)",
        }}
      >
        {badge.glyph}
      </span>
      {badge.label}
    </span>
  );
}

/** A row of earned badges. Renders nothing when there are none. */
export function BadgeRow({
  badges,
  size = "md",
}: {
  badges: BadgeView[];
  size?: "sm" | "md";
}) {
  if (badges.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {badges.map((b) => (
        <Badge key={b.key} badge={b} size={size} />
      ))}
    </div>
  );
}

/**
 * The tier crest — the Alpha/Beta/Gamma standing.
 *
 * Shows "Unranked" rather than a fake tier while the rating is provisional,
 * because a tier badge is a claim about skill and we have not earned the right
 * to make one yet. The battles-remaining hint turns that from a refusal into
 * something the player can act on.
 */
export function TierCrest({
  rating,
  showRating = true,
}: {
  rating: RatingView;
  showRating?: boolean;
}) {
  const color = rating.tier
    ? TIER_COLOR.get(rating.tier) ?? "var(--color-primary)"
    : "var(--color-ink-ghost)";

  return (
    <div className="flex items-center gap-3">
      <div
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] border font-mono text-base font-bold"
        style={{
          borderColor: `color-mix(in srgb, ${color} 45%, transparent)`,
          background: `color-mix(in srgb, ${color} 14%, transparent)`,
          color,
        }}
        aria-hidden
      >
        {rating.tierLabel ? rating.tierLabel.charAt(0) : "?"}
      </div>

      <div className="min-w-0">
        <p
          className="font-mono text-[0.82rem] font-bold leading-tight"
          style={{ color }}
        >
          {rating.tierLabel ?? "Unranked"}
        </p>
        {showRating && (
          <p
            className="font-mono text-[0.68rem] leading-tight"
            style={{ color: "var(--color-ink-faint)" }}
          >
            {rating.provisional
              ? `${rating.rankedBattles} ranked ${
                  rating.rankedBattles === 1 ? "battle" : "battles"
                } — still placing`
              : `${rating.rating} rating`}
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * A progress bar toward the next tier.
 *
 * Hidden while provisional: there is no tier to progress from, so a bar would
 * be measuring nothing.
 */
export function TierProgress({ rating }: { rating: RatingView }) {
  if (rating.provisional) return null;

  const color = rating.tier
    ? TIER_COLOR.get(rating.tier) ?? "var(--color-primary)"
    : "var(--color-primary)";
  const next = TIERS.find((t) => t.key !== rating.tier && t.minRating > rating.conservative);

  return (
    <div>
      <div className="flex items-baseline justify-between font-mono text-[0.65rem]">
        <span style={{ color: "var(--color-ink-faint)" }}>
          {rating.tierLabel}
        </span>
        <span style={{ color: "var(--color-ink-ghost)" }}>
          {next ? next.label : "Top tier"}
        </span>
      </div>
      <div
        className="mt-1 h-1.5 overflow-hidden rounded-full"
        style={{ background: "var(--color-surface-3)" }}
      >
        <div
          className="h-full rounded-full transition-[width]"
          style={{
            width: `${Math.round(rating.tierProgress * 100)}%`,
            background: color,
          }}
        />
      </div>
    </div>
  );
}

/**
 * The full shelf: earned badges first, then what is still out there.
 *
 * Locked badges are shown on purpose. A shelf that only lists what you already
 * have is a trophy case; showing the rest is what makes it a map.
 */
export function BadgeShelf({ badges }: { badges: BadgeProgressView[] }) {
  const earned = badges.filter((b) => b.earned);
  const locked = badges.filter((b) => !b.earned);

  return (
    <div className="flex flex-col gap-5">
      <section>
        <div className="flex items-baseline justify-between">
          <h3 className="label">Earned</h3>
          <span
            className="font-mono text-[0.68rem] tabular-nums"
            style={{ color: "var(--color-ink-ghost)" }}
          >
            {earned.length} / {badges.length}
          </span>
        </div>
        {earned.length === 0 ? (
          <p
            className="mt-2.5 font-mono text-[0.74rem]"
            style={{ color: "var(--color-ink-ghost)" }}
          >
            No badges yet — win a battle to start.
          </p>
        ) : (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {earned.map((b) => (
              <Badge key={b.key} badge={b} />
            ))}
          </div>
        )}
      </section>

      {locked.length > 0 && (
        <section>
          <h3 className="label">Locked</h3>
          <ul className="mt-2.5 flex flex-col gap-2">
            {locked.map((b) => (
              <li key={b.key} className="flex items-center gap-3">
                <Badge badge={b} locked size="sm" />
                {b.progress !== null && b.progress > 0 && (
                  <div className="flex flex-1 items-center gap-2">
                    <div
                      className="h-1 flex-1 overflow-hidden rounded-full"
                      style={{ background: "var(--color-surface-3)" }}
                    >
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.round(b.progress * 100)}%`,
                          background: "var(--color-ink-ghost)",
                        }}
                      />
                    </div>
                    <span
                      className="font-mono text-[0.6rem] tabular-nums"
                      style={{ color: "var(--color-ink-ghost)" }}
                    >
                      {Math.round(b.progress * 100)}%
                    </span>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso.slice(0, 10);
  }
}
