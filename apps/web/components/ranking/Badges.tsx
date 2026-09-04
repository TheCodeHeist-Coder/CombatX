"use client";

import type { BadgeProgressView, BadgeView, RatingView } from "@repo/protocol";
import { PLACEMENT_BATTLES, TIERS } from "@repo/game";
import { BadgeMedal, TierMedal, type MedalTone } from "./Medal";
import { CRESTS, TIER_CRESTS } from "./crests";

/**
 * Badge and tier display.
 *
 * Every badge is a hexagon achievement medal (see Medal.tsx) carrying a
 * hand-drawn animal (see crests.ts). The hexagon-and-rim shape is what makes
 * these read as awards rather than icons; the animal is what makes each one
 * recognisable before its label is read.
 *
 * Colour carries RARITY, not category, because rarity is what a visitor is
 * actually scanning for — "what is unusual about this person?".
 */

interface Rarity {
  tone: MedalTone;
  /** Label colour beneath the medal. */
  fg: string;
  label: string;
}

const RARITY: Record<string, Rarity> = {
  COMMON: {
    tone: { base: "#7c8494", rimLight: "#aab2c0", rimDark: "#4a505c" },
    fg: "var(--color-ink-dim)",
    label: "Common",
  },
  UNCOMMON: {
    tone: { base: "#3fa89e", rimLight: "#7fded4", rimDark: "#1f6b63" },
    fg: "#5cc9bd",
    label: "Uncommon",
  },
  RARE: {
    tone: { base: "#3d8fe0", rimLight: "#87c4ff", rimDark: "#1c4f85" },
    fg: "#6fb4f5",
    label: "Rare",
  },
  LEGENDARY: {
    tone: { base: "#e0632c", rimLight: "#ffb27a", rimDark: "#8a3410" },
    fg: "#ff8a5c",
    label: "Legendary",
  },
};

function rarity(key: string): Rarity {
  return RARITY[key] ?? RARITY.COMMON!;
}

/**
 * The honours tone — gold, regardless of the badge's rarity.
 *
 * CONTRIBUTION badges deliberately step outside the rarity colour scheme.
 * Every other medal answers "how rare is this?"; these answer "this player
 * built something the rest of us play", which is a different axis. Colouring
 * them by rarity would file them back in with the fighting badges.
 */
const HONOUR_TONE: MedalTone = {
  base: "#d9a441",
  rimLight: "#ffe9a8",
  rimDark: "#8a6414",
};
const HONOUR_FG = "#f0c766";

/** Is this a badge given for authoring rather than for fighting? */
function isHonour(category: string): boolean {
  return category === "CONTRIBUTION";
}

/**
 * Tier tones, built from the single source of truth in @repo/game.
 *
 * Keyed by plain string because the tier arrives over the wire as one: an
 * unknown key (an older client meeting a newer tier) falls back rather than
 * failing to render.
 */
const TIER_TONE = new Map<string, MedalTone>(
  TIERS.map((t) => [
    t.key,
    { base: t.color, rimLight: lighten(t.color), rimDark: darken(t.color) },
  ]),
);
const TIER_COLOR = new Map<string, string>(TIERS.map((t) => [t.key, t.color]));

/**
 * The medal tone for a tier key, for callers outside this file.
 *
 * Exported so the landing page can draw the ladder with the SAME tones the
 * profile does. Falls back to the lowest tier on an unknown key, matching how
 * the rest of this file treats a tier it does not recognise.
 */
export function TIER_TONE_FOR(key: string): MedalTone {
  return TIER_TONE.get(key) ?? TIER_TONE.get(TIERS[0].key)!;
}

/**
 * One badge: the medal, with its name beneath.
 *
 * `title` carries the full description rather than a custom tooltip — it is
 * keyboard-reachable, works on every platform, and cannot be clipped by an
 * overflow container the way an absolutely-positioned tooltip can.
 */
export function Badge({
  badge,
  locked = false,
  size = "md",
  tier,
}: {
  badge: BadgeView;
  locked?: boolean;
  size?: "sm" | "md" | "lg";
  /** Optional multiplier bubble for a repeatable achievement. */
  tier?: number;
}) {
  const honour = isHonour(badge.category);
  const r = rarity(badge.rarity);
  const tone = honour ? HONOUR_TONE : r.tone;
  const fg = honour ? HONOUR_FG : r.fg;
  // A wreathed medal needs a little more room to read, and the ornate viewBox
  // scales its contents down to make space for the laurel.
  const px = (size === "lg" ? 80 : size === "sm" ? 34 : 64) * (honour ? 1.18 : 1);

  const description = locked
    ? `${badge.label} — ${badge.description} (not yet earned)`
    : `${badge.label} — ${badge.description}${
        badge.earnedAt ? ` · earned ${formatDate(badge.earnedAt)}` : ""
      }`;

  return (
    <figure
      title={description}
      className="m-0 flex flex-col items-center gap-1.5"
      style={{ width: px + 16 }}
    >
      {CRESTS[badge.key] ? (
        <BadgeMedal
          badgeKey={badge.key}
          tone={tone}
          size={px}
          muted={locked}
          tier={tier}
          ornate={honour}
          title={description}
        />
      ) : (
        // A badge added to the table before its art exists still renders,
        // rather than vanishing from the shelf.
        <span
          className="flex items-center justify-center rounded-[6px] border font-mono font-bold"
          style={{
            width: px,
            height: px,
            borderColor: locked ? "var(--color-line)" : tone.rimDark,
            background: locked ? "transparent" : "var(--color-surface-3)",
            color: locked ? "var(--color-ink-ghost)" : fg,
            fontSize: px * 0.34,
          }}
          aria-hidden
        >
          {badge.glyph}
        </span>
      )}

      {size !== "sm" && (
        <figcaption
          className="text-center font-mono leading-tight"
          style={{
            // The ornate viewBox is taller than the plain one, which pushes
            // its caption down; pull it back so a mixed row aligns.
            marginTop: honour ? "-0.5rem" : undefined,
            fontSize: "0.62rem",
            color: locked ? "var(--color-ink-ghost)" : fg,
          }}
        >
          {badge.label}
        </figcaption>
      )}
    </figure>
  );
}

/** A row of earned medals. Renders nothing when there are none. */
export function BadgeRow({
  badges,
  size = "md",
}: {
  badges: BadgeView[];
  size?: "sm" | "md" | "lg";
}) {
  if (badges.length === 0) return null;
  return (
    <div className="flex flex-wrap items-start gap-2">
      {badges.map((b) => (
        <Badge key={b.key} badge={b} size={size} />
      ))}
    </div>
  );
}

/**
 * The tier medal — the Alpha/Beta/Gamma standing.
 *
 * Shows "Unranked" rather than a fake tier while the rating is provisional,
 * because a tier badge is a claim about skill and we have not earned the right
 * to make one yet. The battles-so-far line turns that from a refusal into
 * something the player can act on.
 */
export function TierCrest({
  rating,
  showRating = true,
  size = 72,
}: {
  rating: RatingView;
  showRating?: boolean;
  size?: number;
}) {
  const color = rating.tier
    ? TIER_COLOR.get(rating.tier) ?? "var(--color-primary)"
    : "var(--color-ink-ghost)";
  const tone = rating.tier ? TIER_TONE.get(rating.tier) : undefined;
  const art = rating.tier ? TIER_CRESTS[rating.tier] : null;

  const remaining = Math.max(0, PLACEMENT_BATTLES - rating.rankedBattles);

  return (
    <div className="flex items-center gap-3.5">
      {art && tone && rating.tier ? (
        <TierMedal
          tierKey={rating.tier}
          tone={tone}
          size={size}
          title={`${rating.tierLabel} — ${art.animal}`}
        />
      ) : (
        /*
         * Not yet placed.
         *
         * Shows the lowest tier's medal drawn faintly rather than a bare "?".
         * A blank box tells a new player nothing except that they have
         * nothing; a ghosted medal shows them the thing they are working
         * toward, and reads as "not yet" rather than "empty".
         */
        <div className="relative shrink-0" style={{ width: size, height: size }}>
          <TierMedal
            tierKey="IOTA"
            tone={
              TIER_TONE.get("IOTA") ?? {
                base: "#6b7280",
                rimLight: "#9aa3b0",
                rimDark: "#3f4650",
              }
            }
            size={size}
            title="Not yet placed"
          />
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background: "var(--color-surface)",
              opacity: 0.62,
              borderRadius: size * 0.16,
            }}
            aria-hidden
          />
        </div>
      )}

      <div className="min-w-0">
        <p
          className="font-mono text-[0.9rem] font-bold leading-tight"
          style={{ color }}
        >
          {rating.tierLabel ?? "Unranked"}
        </p>
        {showRating && (
          <p
            className="font-mono text-[0.7rem] leading-tight"
            style={{ color: "var(--color-ink-faint)" }}
          >
            {rating.provisional
              ? remaining > 0
                ? `${remaining} more ranked ${
                    remaining === 1 ? "battle" : "battles"
                  } to place`
                : "Placing after your next battle"
              : `${rating.rating} rating`}
          </p>
        )}
        <p
          className="font-mono text-[0.64rem] leading-tight"
          style={{ color: "var(--color-ink-ghost)" }}
        >
          {art
            ? art.animal
            : `${rating.rankedBattles} of ${PLACEMENT_BATTLES} fought`}
        </p>
      </div>
    </div>
  );
}

/**
 * How far through placement a player is, 0..1.
 *
 * Counts battles rather than tracking the rating deviation on purpose: a
 * player needs to know how much further to go, and "your deviation is 248"
 * answers a question nobody asked.
 */
export function PlacementProgress({ rating }: { rating: RatingView }) {
  if (!rating.provisional) return null;

  const done = Math.min(rating.rankedBattles, PLACEMENT_BATTLES);
  const pct = Math.round((done / PLACEMENT_BATTLES) * 100);

  return (
    <div>
      <div className="flex items-baseline justify-between font-mono text-[0.65rem]">
        <span style={{ color: "var(--color-ink-faint)" }}>Placement</span>
        <span style={{ color: "var(--color-ink-ghost)" }}>
          {done} / {PLACEMENT_BATTLES}
        </span>
      </div>
      <div
        className="mt-1 h-1.5 overflow-hidden rounded-full"
        style={{ background: "var(--color-surface-3)" }}
      >
        <div
          className="h-full rounded-full transition-[width]"
          style={{ width: `${pct}%`, background: "var(--color-primary)" }}
        />
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
  const next = TIERS.find(
    (t) => t.key !== rating.tier && t.minRating > rating.conservative,
  );

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
 * The full shelf: earned medals first, then what is still out there.
 *
 * Locked medals are drained of colour rather than hidden. A shelf that only
 * lists what you already have is a trophy case; showing the rest is what makes
 * it a map — and a greyed animal still reads as a specific animal, so a player
 * can see exactly what they are working toward.
 */
export function BadgeShelf({ badges }: { badges: BadgeProgressView[] }) {
  const earned = badges.filter((b) => b.earned);
  const locked = badges.filter((b) => !b.earned);

  return (
    <div className="flex flex-col gap-6">
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
          <div className="mt-3.5 flex flex-wrap items-start gap-3">
            {earned.map((b) => (
              // `tier` drives the "x2" bubble. Only a repeatable badge ever
              // reports a count above 1, so ordinary badges are unaffected.
              <Badge key={b.key} badge={b} tier={b.count} />
            ))}
          </div>
        )}
      </section>

      {locked.length > 0 && (
        <section>
          <h3 className="label">Locked</h3>
          <div className="mt-3.5 flex flex-wrap items-start gap-3">
            {locked.map((b) => (
              <div
                key={b.key}
                className="flex flex-col items-center gap-1"
                style={{ width: 80 }}
              >
                <Badge badge={b} locked />
                {b.progress !== null && b.progress > 0 && (
                  <div className="flex w-full flex-col items-center gap-0.5">
                    <div
                      className="h-1 w-full overflow-hidden rounded-full"
                      style={{ background: "var(--color-surface-3)" }}
                    >
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.round(b.progress * 100)}%`,
                          background: "var(--color-ink-faint)",
                        }}
                      />
                    </div>
                    <span
                      className="font-mono text-[0.55rem] tabular-nums"
                      style={{ color: "var(--color-ink-ghost)" }}
                    >
                      {Math.round(b.progress * 100)}%
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

/** Mix a hex colour toward white, for a rim highlight. */
function lighten(hex: string, amount = 0.45): string {
  return mix(hex, 255, amount);
}
/** Mix a hex colour toward black, for a rim shadow. */
function darken(hex: string, amount = 0.45): string {
  return mix(hex, 0, amount);
}
function mix(hex: string, target: number, amount: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1]!, 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) =>
    Math.round(v + (target - v) * amount),
  );
  return `#${ch.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
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
