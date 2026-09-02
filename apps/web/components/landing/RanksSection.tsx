"use client";

import { BADGES, TIERS } from "@repo/game";
import type { BadgeView } from "@repo/protocol";
import { Badge, TIER_TONE_FOR } from "../ranking/Badges";
import { TierMedal } from "../ranking/Medal";

/**
 * The ranks-and-badges explainer on the landing page.
 *
 * A visitor's question here is "what am I playing FOR?", and the honest answer
 * has two halves that must not be blurred together:
 *
 *   - TIERS are skill, they are held one at a time, and they can be LOST.
 *   - BADGES are history, many are held at once, and they are permanent.
 *
 * Both halves are drawn with the SAME components the profile uses (Medal,
 * Badge, the crest art), rather than a mock-up. So what a visitor is shown
 * here is exactly what they will later earn — if the medals ever change, this
 * section changes with them and cannot drift into advertising something the
 * product no longer does.
 *
 * The tier thresholds are read from TIERS in @repo/game, the same table the
 * server ranks by. Hard-coding "1850" here would be a number that silently
 * lies the first time the ladder is retuned.
 */
export function RanksSection() {
  return (
    <section id="ranks">
      <div className="mx-auto w-full max-w-6xl px-5 py-20 sm:px-7">
        {/* --- Heading --- */}
        <div className="text-center">
          <p className="eyebrow" style={{ color: "var(--color-ink-faint)" }}>
            Ranks &amp; badges
          </p>
          <h2 className="wordmark grad-text mt-3 text-[clamp(2rem,5.5vw,3.2rem)]">
            Earn your letter
          </h2>
          <p
            className="mx-auto mt-4 max-w-2xl font-mono text-[0.82rem] leading-[1.9] sm:text-[0.88rem]"
            style={{ color: "var(--color-ink-dim)" }}
          >
            Every ranked battle moves your rating. Your rating decides your
            tier &mdash; a single Greek letter that says how good you are right
            now. Badges sit alongside it and record what you have actually done.
          </p>
        </div>

        {/* --- The tier ladder --- */}
        <div className="mt-14">
          <div className="mb-6 flex items-baseline justify-center gap-3">
            <h3 className="text-[1.15rem] font-bold">The ladder</h3>
            <span
              className="font-mono text-[0.72rem]"
              style={{ color: "var(--color-ink-faint)" }}
            >
              one at a time &middot; can be lost
            </span>
          </div>

          {/*
            Ascending, so the eye travels the way the ladder is climbed and
            Alpha lands last. auto-fit rather than a fixed column count: six
            tiers wrap to 3x2 on a tablet and 2x3 on a phone without a
            separate breakpoint for each.
          */}
          <div
            className="grid gap-4"
            style={{
              gridTemplateColumns:
                "repeat(auto-fit, minmax(9.5rem, 1fr))",
            }}
          >
            {TIERS.map((t) => (
              <article
                key={t.key}
                className="panel flex flex-col items-center px-3 py-6 text-center"
                style={{ borderColor: `${t.color}33` }}
              >
                <TierMedal
                  tierKey={t.key}
                  tone={TIER_TONE_FOR(t.key)}
                  size={68}
                  title={`${t.label} — ${t.blurb}`}
                />
                <h4
                  className="mt-3 text-[0.95rem] font-bold"
                  style={{ color: t.color }}
                >
                  {t.label}
                </h4>
                <p
                  className="mt-1 font-mono text-[0.66rem]"
                  style={{ color: "var(--color-ink-faint)" }}
                >
                  {t.minRating === 0 ? "Starting tier" : `${t.minRating}+`}
                </p>
                <p
                  className="mt-2 font-mono text-[0.68rem] leading-[1.7]"
                  style={{ color: "var(--color-ink-dim)" }}
                >
                  {t.blurb}
                </p>
              </article>
            ))}
          </div>
        </div>

        {/* --- Example badges --- */}
        <div className="mt-16">
          <div className="mb-6 flex items-baseline justify-center gap-3">
            <h3 className="text-[1.15rem] font-bold">Badges you can earn</h3>
            <span
              className="font-mono text-[0.72rem]"
              style={{ color: "var(--color-ink-faint)" }}
            >
              permanent once earned
            </span>
          </div>

          {/*
            A 14rem minimum, so eight cards settle into 4x2 on a desktop
            rather than the ragged 5+3 a narrower minimum produces. Still
            auto-fit, so it drops to 2-up and then 1-up on the way down.
          */}
          <div
            className="grid gap-3"
            style={{
              gridTemplateColumns: "repeat(auto-fit, minmax(14rem, 1fr))",
            }}
          >
            {SAMPLE_BADGES.map((b) => (
              <article
                key={b.key}
                className="panel flex items-center gap-3 px-3 py-3"
              >
                <Badge badge={b} size="sm" />
                <div className="min-w-0">
                  <h4 className="text-[0.82rem] font-bold leading-tight">
                    {b.label}
                  </h4>
                  <p
                    className="mt-1 font-mono text-[0.64rem] leading-[1.6]"
                    style={{ color: "var(--color-ink-dim)" }}
                  >
                    {b.description}
                  </p>
                </div>
              </article>
            ))}
          </div>

          {/* Rarity legend: the medals are colour-coded, so say what by. */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
            {RARITY_LEGEND.map((r) => (
              <span
                key={r.label}
                className="flex items-center gap-2 font-mono text-[0.68rem]"
                style={{ color: "var(--color-ink-dim)" }}
              >
                <span
                  aria-hidden
                  style={{
                    width: "0.6rem",
                    height: "0.6rem",
                    borderRadius: "2px",
                    background: r.color,
                    display: "inline-block",
                  }}
                />
                {r.label}
              </span>
            ))}
            <span
              className="font-mono text-[0.68rem]"
              style={{ color: "var(--color-ink-faint)" }}
            >
              + {REMAINING_BADGE_COUNT} more to collect
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * Rarity swatches, kept in step with the RARITY table in Badges.tsx.
 *
 * The `base` tone of each rarity, so the legend chip is literally the colour
 * of the medal face it is describing.
 */
const RARITY_LEGEND = [
  { label: "Common", color: "#7c8494" },
  { label: "Uncommon", color: "#3fa89e" },
  { label: "Rare", color: "#3d8fe0" },
  { label: "Legendary", color: "#e0632c" },
] as const;

/**
 * Eight badges chosen to SPAN the set rather than to flatter it.
 *
 * Two commons anyone reaches in their first session, then one from each of
 * the other categories — difficulty, streak, skill, and the closed pioneer
 * set — climbing to legendary. A visitor should be able to see both the first
 * badge they will get tonight and the one they probably never will.
 *
 * Written out rather than imported from BADGES because the landing page is a
 * shop window, not the catalogue: it shows a curated eight, and the shelf on
 * a real profile shows all of them.
 */
const SAMPLE_BADGES: BadgeView[] = [
  {
    key: "FIRST_BLOOD",
    label: "First Blood",
    description: "Won their first battle.",
    category: "MILESTONE",
    rarity: "COMMON",
    glyph: "I",
    earnedAt: null,
  },
  {
    key: "HAT_TRICK",
    label: "Hat Trick",
    description: "Won three battles in a row.",
    category: "STREAK",
    rarity: "COMMON",
    glyph: "3",
    earnedAt: null,
  },
  {
    key: "HARD_LINER",
    label: "Hard Liner",
    description: "Won their first battle on a hard problem.",
    category: "DIFFICULTY",
    rarity: "UNCOMMON",
    glyph: "h",
    earnedAt: null,
  },
  {
    key: "FLAWLESS",
    label: "Flawless",
    description: "Won 10 battles passing every single test.",
    category: "SKILL",
    rarity: "UNCOMMON",
    glyph: "*",
    earnedAt: null,
  },
  {
    key: "CRUCIBLE",
    label: "Crucible",
    description: "Won 10 battles on hard problems.",
    category: "DIFFICULTY",
    rarity: "RARE",
    glyph: "H",
    earnedAt: null,
  },
  {
    key: "GIANT_SLAYER",
    label: "Giant Slayer",
    description: "Beat 10 opponents rated far above them.",
    category: "SKILL",
    rarity: "RARE",
    glyph: "^",
    earnedAt: null,
  },
  {
    key: "IMMORTAL",
    label: "Immortal",
    description: "Won twenty-five battles in a row.",
    category: "STREAK",
    rarity: "LEGENDARY",
    glyph: "!",
    earnedAt: null,
  },
  {
    key: "PIONEER",
    label: "Pioneer",
    description: "One of the first operatives to enlist.",
    category: "PIONEER",
    rarity: "LEGENDARY",
    glyph: "1",
    earnedAt: null,
  },
];

/**
 * How many badges are NOT shown above.
 *
 * Derived from the real table rather than typed, so adding a badge in
 * @repo/game updates this line instead of quietly making it wrong.
 */
const REMAINING_BADGE_COUNT = BADGES.length - SAMPLE_BADGES.length;
