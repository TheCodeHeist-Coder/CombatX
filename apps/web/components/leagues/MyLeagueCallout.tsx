"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { LeagueCard, LeagueFixtureView } from "@repo/protocol";
import { fetchLeague, fetchLeagues } from "../../lib/api";
import type { Session } from "../../lib/session";

/**
 * "You have a match" — league business, surfaced on the lobby.
 *
 * WHY THIS EXISTS
 * ---------------
 * Everything about a league lived behind the Leagues tab, so a player who
 * does not habitually open it had no way of knowing a match had been
 * scheduled for them. The notification bell fixes the moment it happens; this
 * fixes the days afterwards, when the fact is no longer new but the match is
 * still coming.
 *
 * RENDERS NOTHING when there is nothing to say, which is the common case.
 * A lobby carrying a permanent empty "no matches" panel would be worse than
 * no panel at all.
 */
export function MyLeagueCallout({ session }: { session: Session }) {
  const [rows, setRows] = useState<
    { league: LeagueCard; fixture: LeagueFixtureView }[]
  >([]);

  useEffect(() => {
    if (session.isGuest) return;
    let alive = true;

    void (async () => {
      try {
        const list = await fetchLeagues(session.token);
        // Only leagues still being played; a finished one has nothing coming.
        const live = list.mine.filter(
          (l) => l.status === "OPEN" || l.status === "RUNNING",
        );
        const found: { league: LeagueCard; fixture: LeagueFixtureView }[] = [];

        for (const league of live.slice(0, 5)) {
          const detail = await fetchLeague(league.id, session.token);
          if (!detail.myTeamId) continue;
          for (const fx of detail.fixtures) {
            const mine =
              fx.homeTeamId === detail.myTeamId ||
              fx.awayTeamId === detail.myTeamId;
            // Anything still to play. A decided match is history, and the
            // archive is where history belongs.
            if (mine && (fx.status === "SCHEDULED" || fx.status === "LIVE")) {
              found.push({ league, fixture: fx });
            }
          }
        }
        if (alive) setRows(found.slice(0, 3));
      } catch {
        // The lobby must still work if this fails — it is an extra, not the
        // page. Failing quietly is the right behaviour for a callout.
      }
    })();

    return () => {
      alive = false;
    };
  }, [session]);

  if (rows.length === 0) return null;

  return (
    <div className="mx-auto mt-6 w-full max-w-md">
      {rows.map(({ league, fixture }) => {
        const live = fixture.status === "LIVE";
        // A live leg the player can walk straight into, if one is open.
        const openLeg = fixture.legs.find((l) => l.battleId && !l.isFinished);
        return (
          <Link
            key={fixture.id}
            href={
              live && openLeg?.battleId
                ? `/battle/${openLeg.battleId}`
                : `/leagues/${league.id}`
            }
            className="panel mb-2 flex items-center gap-3 px-4 py-3 transition-colors hover:border-[var(--color-line-strong)]"
            style={{
              borderColor: live ? "var(--color-warn)" : undefined,
              background: live
                ? "color-mix(in srgb, var(--color-warn) 8%, transparent)"
                : undefined,
            }}
          >
            <span
              className="chip shrink-0 font-mono"
              style={{
                borderColor: live ? "var(--color-warn)" : "var(--color-line-strong)",
                color: live ? "var(--color-warn)" : "var(--color-ink-faint)",
                fontSize: "0.6rem",
              }}
            >
              {live ? "live now" : "upcoming"}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[0.82rem] font-bold">
                {fixture.homeTeamName} vs {fixture.awayTeamName}
              </span>
              <span
                className="mt-0.5 block truncate font-mono text-[0.64rem]"
                style={{ color: "var(--color-ink-faint)" }}
              >
                {league.name}
              </span>
            </span>
            <span
              className="shrink-0 font-mono text-[0.66rem]"
              style={{ color: "var(--color-accent)" }}
            >
              {live ? "Join →" : "View →"}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
