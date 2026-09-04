"use client";

import Link from "next/link";
import type {
  FixtureStatus,
  LeagueCard as LeagueCardType,
  LeagueStatus,
  LeagueVisibility,
} from "@repo/protocol";

/**
 * Small shared pieces of the leagues UI.
 *
 * Kept together because each is a handful of lines whose only job is to make
 * one enum readable, and scattering them across the pages that use them would
 * be how two screens end up disagreeing about what "RUNNING" looks like.
 */

/**
 * "Back to leagues" — persistent, not a dead end.
 *
 * A league page is reached from the list, from a shared link, and from a
 * pasted join code. Only the first of those leaves anything in history, so
 * `router.back()` would strand the other two on whatever came before — or on
 * nothing at all. This is an ordinary link to a known destination, which
 * behaves the same however the visitor arrived.
 */
export function BackToLeagues({ label = "All leagues" }: { label?: string }) {
  return (
    <Link
      href="/leagues"
      className="inline-flex items-center gap-1.5 font-mono text-[0.72rem] transition-colors hover:text-[var(--color-accent)]"
      style={{ color: "var(--color-ink-faint)" }}
    >
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
        <path
          d="M7.5 2.5 4 6l3.5 3.5"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {label}
    </Link>
  );
}

/** A league's lifecycle as a colour-coded chip. */
export function LeagueStatusChip({ value }: { value: LeagueStatus }) {
  const map: Record<LeagueStatus, { color: string; text: string }> = {
    DRAFT: { color: "var(--color-ink-faint)", text: "draft" },
    OPEN: { color: "var(--color-good)", text: "open to join" },
    RUNNING: { color: "var(--color-warn)", text: "in progress" },
    FINISHED: { color: "var(--color-ink-faint)", text: "completed" },
    CANCELLED: { color: "var(--color-bad)", text: "cancelled" },
  };
  const { color, text } = map[value];
  return (
    <span
      className="chip font-mono"
      style={{ borderColor: color, color, fontSize: "0.64rem" }}
    >
      {text}
    </span>
  );
}

/** Whether anyone may walk in, or a code is needed. */
export function VisibilityChip({ value }: { value: LeagueVisibility }) {
  const isPublic = value === "PUBLIC";
  const color = isPublic ? "var(--color-side-a)" : "var(--color-ink-faint)";
  return (
    <span
      className="chip font-mono"
      style={{ borderColor: color, color, fontSize: "0.64rem" }}
      title={
        isPublic
          ? "Anyone can find this league and form a team"
          : "Only people with the join code can get in"
      }
    >
      {isPublic ? "public" : "invite only"}
    </span>
  );
}

/** How far a fixture has got. */
export function FixtureStatusChip({ value }: { value: FixtureStatus }) {
  const map: Record<FixtureStatus, { color: string; text: string }> = {
    SCHEDULED: { color: "var(--color-ink-faint)", text: "scheduled" },
    LIVE: { color: "var(--color-warn)", text: "playing" },
    COMPLETED: { color: "var(--color-good)", text: "decided" },
    CANCELLED: { color: "var(--color-bad)", text: "called off" },
  };
  const { color, text } = map[value];
  return (
    <span
      className="chip font-mono"
      style={{ borderColor: color, color, fontSize: "0.62rem" }}
    >
      {text}
    </span>
  );
}

/** "1v1" / "2v2" — the format, from the team size. */
export function FormatChip({ teamSize }: { teamSize: number }) {
  return (
    <span
      className="chip font-mono"
      style={{
        borderColor: "var(--color-line-strong)",
        color: "var(--color-ink-dim)",
        fontSize: "0.64rem",
      }}
    >
      {teamSize}v{teamSize}
    </span>
  );
}

/**
 * A league's logo, or its initials.
 *
 * Falls back rather than showing a broken frame: most leagues will never get
 * round to uploading a picture, and a blank square would make the whole list
 * look unfinished. The initials are derived from the name, so the fallback is
 * still recognisably THIS league.
 */
export function LeagueLogo({
  name,
  logoUrl,
  size = 48,
}: {
  name: string;
  logoUrl?: string | null;
  size?: number;
}) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

  if (logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- data URLs; see lib/image.ts
      <img
        src={logoUrl}
        alt=""
        width={size}
        height={size}
        className="shrink-0 rounded-[10px] object-cover"
        style={{ border: "1px solid var(--color-line-strong)" }}
      />
    );
  }

  return (
    <div
      aria-hidden
      className="flex shrink-0 items-center justify-center rounded-[10px] font-bold"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.36,
        background: "var(--color-surface-2)",
        border: "1px solid var(--color-line-strong)",
        color: "var(--color-ink-faint)",
        letterSpacing: "0.02em",
      }}
    >
      {initials || "?"}
    </div>
  );
}

/**
 * The join code, with a copy button.
 *
 * A code that has to be retyped from a screenshot is a code that gets typed
 * wrong, so the primary action is copying it, and the code itself is shown
 * only so the host can read it aloud.
 */
export function JoinCode({ code }: { code: string }) {
  return (
    <button
      className="flex items-center gap-2 rounded-[8px] border px-3 py-1.5 transition-colors"
      style={{
        borderColor: "var(--color-line-strong)",
        background: "var(--color-surface-2)",
      }}
      onClick={() => void navigator.clipboard?.writeText(code)}
      title="Copy the join code"
    >
      <span
        className="font-mono text-[0.62rem] uppercase tracking-wider"
        style={{ color: "var(--color-ink-faint)" }}
      >
        code
      </span>
      <span
        className="font-mono text-[0.9rem] font-bold tracking-[0.18em]"
        style={{ color: "var(--color-accent)" }}
      >
        {code}
      </span>
    </button>
  );
}

/**
 * One league in a list.
 *
 * `joined` marks a league the viewer is already in, so the list can stay ONE
 * list and the filters only ever have to be applied once.
 *
 * The marker is a thin accent rule down the left edge, not a full coloured
 * border. Someone who plays in — or runs — most of the leagues they can see
 * would otherwise get a page where every card is highlighted, and a highlight
 * on everything marks nothing. A rule survives that: it still distinguishes
 * the joined ones when they are a minority, and recedes into a margin stripe
 * when they are the majority.
 *
 * A finished or cancelled league is dimmed rather than hidden: the page is an
 * archive as well as a lobby, and its standings are the record of a
 * tournament people actually played.
 */
export function LeagueListCard({
  league,
  joined = false,
}: {
  league: LeagueCardType;
  joined?: boolean;
}) {
  const capacity =
    league.maxTeams === null
      ? `${league.teamCount} teams`
      : `${league.teamCount}/${league.maxTeams} teams`;

  const over = league.status === "FINISHED" || league.status === "CANCELLED";

  return (
    <Link
      href={`/leagues/${league.id}`}
      className="panel flex gap-4 p-4 transition-colors hover:border-[var(--color-line-strong)]"
      style={{
        ...(joined && {
          borderLeft: "2px solid var(--color-primary)",
          paddingLeft: "calc(1rem - 1px)",
        }),
        ...(over && { opacity: 0.72 }),
      }}
    >
      <LeagueLogo name={league.name} logoUrl={league.logoUrl} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="truncate text-[0.95rem] font-bold">{league.name}</h3>
          <LeagueStatusChip value={league.status} />
          <VisibilityChip value={league.visibility} />
          <FormatChip teamSize={league.teamSize} />
        </div>

        {league.description && (
          <p
            className="mt-1.5 line-clamp-2 font-mono text-[0.7rem] leading-[1.7]"
            style={{ color: "var(--color-ink-dim)" }}
          >
            {league.description}
          </p>
        )}

        <p
          className="mt-2 font-mono text-[0.66rem]"
          style={{ color: "var(--color-ink-faint)" }}
        >
          {/*
            The accent rule that marks a joined league is colour alone, which
            says nothing to a screen reader and nothing to a viewer who cannot
            distinguish it. This is the same fact in words.
          */}
          {joined && (
            <span style={{ color: "var(--color-accent)" }}>You&rsquo;re in · </span>
          )}
          {capacity} · {league.fixtureCount} match
          {league.fixtureCount === 1 ? "" : "es"} · run by {league.hostName}
        </p>
      </div>
    </Link>
  );
}
