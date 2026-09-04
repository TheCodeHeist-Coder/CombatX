"use client";

import type { LeagueStandingsResponse } from "@repo/protocol";
import { LeagueLogo } from "./LeagueBits";

/**
 * The league table.
 *
 * WHY THE QUALIFICATION LINE IS DRAWN, NOT DESCRIBED
 * --------------------------------------------------
 * A rule like "top 2 advance" is a sentence; what a competitor actually wants
 * to know is "am I above the line?". So the teams that qualify are tinted and
 * a rule is drawn beneath the last of them, which answers that question at a
 * glance and keeps answering it as results come in.
 *
 * The table is shown even before a rule exists — most leagues are just a
 * table of matches, and standings are worth having on their own.
 */
export function StandingsTable({
  standings,
  myTeamId,
}: {
  standings: LeagueStandingsResponse;
  myTeamId: string | null;
}) {
  const { rows } = standings;
  if (rows.length === 0) return null;

  const lastQualifying = rows.reduce(
    (acc, r, i) => (r.qualifies ? i : acc),
    -1,
  );

  return (
    <div className="panel overflow-x-auto">
      <table className="w-full min-w-[34rem] border-collapse">
        <thead>
          <tr
            className="text-left font-mono text-[0.62rem] uppercase tracking-wider"
            style={{ color: "var(--color-ink-faint)" }}
          >
            <Th className="w-10 text-center">#</Th>
            <Th>Team</Th>
            <Th className="w-12 text-center" title="Matches played">
              P
            </Th>
            <Th className="w-12 text-center" title="Won">
              W
            </Th>
            <Th className="w-12 text-center" title="Drawn">
              D
            </Th>
            <Th className="w-12 text-center" title="Lost">
              L
            </Th>
            {/* Leg difference is the first tie-break, so it earns a column. */}
            <Th className="w-14 text-center" title="Problems won minus lost">
              +/&minus;
            </Th>
            <Th className="w-14 text-center" title="Points: 3 a win, 1 a draw">
              Pts
            </Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const mine = r.teamId === myTeamId;
            return (
              <tr
                key={r.teamId}
                style={{
                  borderTop: "1px solid var(--color-line)",
                  // The cut line: a solid rule under the last qualifier says
                  // where the bracket begins better than any legend.
                  borderBottom:
                    i === lastQualifying
                      ? "2px solid var(--color-good)"
                      : undefined,
                  background: r.isChampion
                    ? "color-mix(in srgb, var(--color-amber) 12%, transparent)"
                    : mine
                      ? "color-mix(in srgb, var(--color-primary) 7%, transparent)"
                      : r.qualifies
                        ? "color-mix(in srgb, var(--color-good) 5%, transparent)"
                        : undefined,
                }}
              >
                <Td className="text-center font-mono text-[0.72rem]">
                  {r.rank}
                </Td>
                <Td>
                  <span className="flex items-center gap-2.5">
                    <LeagueLogo
                      name={r.teamName}
                      logoUrl={r.logoUrl}
                      size={26}
                    />
                    <span className="truncate text-[0.82rem] font-bold">
                      {r.teamName}
                    </span>
                    {r.isChampion && (
                      <span
                        className="chip font-mono"
                        style={{
                          borderColor: "var(--color-amber)",
                          color: "var(--color-amber)",
                          fontSize: "0.6rem",
                        }}
                        title="Won the final"
                      >
                        champion
                      </span>
                    )}
                    {mine && !r.isChampion && (
                      <span
                        className="font-mono text-[0.62rem]"
                        style={{ color: "var(--color-accent)" }}
                      >
                        you
                      </span>
                    )}
                  </span>
                </Td>
                <Num>{r.played}</Num>
                <Num>{r.won}</Num>
                <Num>{r.drawn}</Num>
                <Num>{r.lost}</Num>
                <Num
                  tone={
                    r.legDiff > 0
                      ? "var(--color-good)"
                      : r.legDiff < 0
                        ? "var(--color-bad)"
                        : undefined
                  }
                >
                  {r.legDiff > 0 ? `+${r.legDiff}` : r.legDiff}
                </Num>
                <Td className="text-center font-mono text-[0.82rem] font-bold">
                  {r.points}
                </Td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Say the rule in words as well: the line shows WHERE the cut is, this
          says WHAT it is, and a screen reader gets only this one. */}
      {standings.qualifyMode && (
        <p
          className="border-t px-4 py-2.5 font-mono text-[0.66rem]"
          style={{
            borderColor: "var(--color-line)",
            color: "var(--color-ink-faint)",
          }}
        >
          {standings.qualifyMode === "TOP_N"
            ? `Top ${standings.qualifyValue} advance to the knockout.`
            : `Every team with ${standings.qualifyValue} or more wins advances.`}
        </p>
      )}
    </div>
  );
}

function Th({
  children,
  className = "",
  title,
}: {
  children: React.ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <th className={`px-3 py-2.5 font-normal ${className}`} title={title}>
      {children}
    </th>
  );
}

function Td({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <td className={`px-3 py-2.5 ${className}`}>{children}</td>;
}

function Num({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone?: string;
}) {
  return (
    <td
      className="px-3 py-2.5 text-center font-mono text-[0.76rem]"
      style={{ color: tone ?? "var(--color-ink-dim)" }}
    >
      {children}
    </td>
  );
}
