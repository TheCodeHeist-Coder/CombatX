"use client";

import Link from "next/link";
import { AVATAR_IDS, type AvatarId } from "@repo/protocol";
import { Avatar } from "../avatar/Avatar";

/**
 * The character roster — every fighter you can take into a battle.
 *
 * Split into two squads purely for display, tinted with the two side colours
 * the arena itself uses, so the section reads as "these are the teams" rather
 * than as a flat sprite sheet. The split is cosmetic: any character can be
 * seated on either side.
 *
 * The grid is driven straight off AVATAR_IDS, so a sprite added to the
 * protocol appears here with no change to this file.
 */
export function RosterSection() {
  const half = Math.ceil(AVATAR_IDS.length / 2);
  const squads = [
    {
      name: "Blue Squad",
      blurb:
        "Twelve fighters holding the left side of the board. Pick one and it is yours for every battle.",
      color: "var(--color-side-a)",
      // Plates alternate within a squad for rhythm, but stay inside that
      // squad's own palette so the two rows read as two teams.
      plates: ["#2f6fd0", "#3f4655"],
      ids: AVATAR_IDS.slice(0, half),
    },
    {
      name: "Orange Squad",
      blurb:
        "Twelve more on the right. Your character shows up in the lobby, in the arena, and on the leaderboard.",
      color: "var(--color-side-b)",
      plates: ["#e08a2a", "#3f4655"],
      ids: AVATAR_IDS.slice(half),
    },
  ] as const;

  return (
    <section className="px-5 py-20 sm:px-7">
      <div className="mx-auto w-full max-w-5xl">
        <p className="eyebrow" style={{ color: "var(--color-ink-faint)" }}>
          Assemble your side
        </p>
        <h2 className="wordmark grad-text mt-3 text-[clamp(2rem,5.5vw,3.2rem)]">
          Pick your fighter
        </h2>
        <p
          className="mt-4 max-w-xl font-mono text-[0.82rem] leading-[1.9]"
          style={{ color: "var(--color-ink-dim)" }}
        >
          Every player picks a character and a colour. Team up two, three or
          four a side — your squad shares one problem and one clock.
        </p>

        <div className="mt-12 flex flex-col gap-12">
          {squads.map((squad) => (
            <Squad key={squad.name} {...squad} />
          ))}
        </div>
      </div>
    </section>
  );
}

function Squad({
  name,
  blurb,
  color,
  plates,
  ids,
}: {
  name: string;
  blurb: string;
  color: string;
  plates: readonly string[];
  ids: readonly AvatarId[];
}) {
  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <h3
          className="wordmark text-[clamp(1.5rem,3.4vw,2rem)]"
          style={{ color }}
        >
          {name}
        </h3>
        <Link
          href="/signup"
          className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.14em] transition-opacity hover:opacity-75"
          style={{ color }}
        >
          Claim yours &raquo;
        </Link>
      </div>

      <p
        className="mt-2 max-w-2xl font-mono text-[0.75rem] leading-relaxed"
        style={{ color: "var(--color-ink-faint)" }}
      >
        {blurb}
      </p>

      {/*
        Six across at every width, in a sheet capped well below the section's
        own width. The 12px sprites were drawn small; letting the tiles track
        the full column blows the art up far past the scale it holds up at.
      */}
      <div className="mt-5 grid max-w-xl grid-cols-6 gap-2">
        {ids.map((id, i) => (
          <RosterTile
            key={id}
            avatarId={id}
            color={plates[i % plates.length]!}
            accent={color}
          />
        ))}
      </div>
    </div>
  );
}

/** One character plate. Lifts and takes its squad's colour on hover. */
function RosterTile({
  avatarId,
  color,
  accent,
}: {
  avatarId: AvatarId;
  color: string;
  accent: string;
}) {
  return (
    <div
      className="roster-tile"
      style={{ "--tile-accent": accent } as React.CSSProperties}
    >
      {/*
        The tile owns the sizing, not the Avatar: `h-full w-full` overrides
        the svg's width/height attributes, so the plates track the column
        width instead of being pinned to a px value that only lines up at one
        breakpoint. The svg's viewBox keeps the sprite crisp at any size.
      */}
      <Avatar
        avatarId={avatarId}
        color={color}
        rounded={0}
        className="h-full w-full"
      />
    </div>
  );
}
