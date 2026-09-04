"use client";

import { useState } from "react";
import Link from "next/link";
import type {
  LeagueDetailResponse,
  LeagueFixtureView,
  LeagueLegView,
} from "@repo/protocol";
import { Spinner } from "../atoms";
import { FixtureStatusChip } from "./LeagueBits";

/**
 * The match list.
 *
 * WHAT A PLAYER SEES VERSUS WHAT A HOST SEES
 * ------------------------------------------
 * The same rows. The host additionally gets the kick-off and cancel controls,
 * because they are the only person who can use them — a player pressing
 * "start" would be refused by the server, and offering a button that always
 * fails is worse than not offering it.
 *
 * A player whose team is IN a match gets the one thing they need: a link into
 * the battle, the moment it exists.
 */
export function FixturesPanel({
  detail,
  isHost,
  myTeamId,
  onStartLeg,
  onCancel,
  working,
}: {
  detail: LeagueDetailResponse;
  isHost: boolean;
  myTeamId: string | null;
  onStartLeg: (fixtureId: string, legId: string) => void | Promise<void>;
  onCancel: (fixtureId: string) => void | Promise<void>;
  working: string | null;
}) {
  const { fixtures } = detail;

  if (fixtures.length === 0) {
    return (
      <div className="panel p-8 text-center">
        <p
          className="font-mono text-[0.8rem]"
          style={{ color: "var(--color-ink-dim)" }}
        >
          No matches scheduled yet.
          {isHost
            ? " Pair two full teams to create the first one."
            : " The host sets these up."}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {fixtures.map((fx) => (
        <FixtureCard
          key={fx.id}
          fixture={fx}
          isHost={isHost}
          myTeamId={myTeamId}
          onStartLeg={onStartLeg}
          onCancel={onCancel}
          working={working}
        />
      ))}
    </div>
  );
}

function FixtureCard({
  fixture,
  isHost,
  myTeamId,
  onStartLeg,
  onCancel,
  working,
}: {
  fixture: LeagueFixtureView;
  isHost: boolean;
  myTeamId: string | null;
  onStartLeg: (fixtureId: string, legId: string) => void | Promise<void>;
  onCancel: (fixtureId: string) => void | Promise<void>;
  working: string | null;
}) {
  const mine =
    myTeamId !== null &&
    (fixture.homeTeamId === myTeamId || fixture.awayTeamId === myTeamId);

  const homeWon = fixture.winnerTeamId === fixture.homeTeamId;
  const awayWon = fixture.winnerTeamId === fixture.awayTeamId;

  return (
    <article
      className="panel p-4"
      style={
        mine
          ? {
              borderColor: "var(--color-primary)",
              background:
                "color-mix(in srgb, var(--color-primary) 5%, transparent)",
            }
          : undefined
      }
    >
      <div className="flex flex-wrap items-center gap-3">
        {fixture.round !== "GROUP" && (
          <span
            className="chip font-mono"
            style={{
              borderColor: "var(--color-amber)",
              color: "var(--color-amber)",
              fontSize: "0.62rem",
            }}
          >
            {ROUND_LABEL[fixture.round]}
          </span>
        )}
        <FixtureStatusChip value={fixture.status} />
        <span
          className="font-mono text-[0.66rem]"
          style={{ color: "var(--color-ink-faint)" }}
        >
          {fixture.legs.length} problem{fixture.legs.length === 1 ? "" : "s"} ·{" "}
          {Math.round(fixture.timeLimitSec / 60)} min each
        </span>

        {isHost && fixture.status !== "COMPLETED" && (
          <button
            className="ml-auto font-mono text-[0.68rem] underline"
            style={{ color: "var(--color-ink-ghost)" }}
            onClick={() => void onCancel(fixture.id)}
          >
            Call off
          </button>
        )}
      </div>

      {/*
        The scoreline.

        Both numbers sit together in the middle, reading "1 - 0" as a single
        score rather than being tucked against their own team's name. With a
        number on each outer edge the eye pairs the wrong digit with the word
        "vs" and has to work out which side each belongs to; a conventional
        scoreline needs no working out at all.
      */}
      <div className="mt-3 flex items-center gap-3">
        <span
          className="min-w-0 flex-1 truncate text-right text-[0.9rem] font-bold"
          style={{
            color:
              fixture.status === "COMPLETED" && !homeWon
                ? "var(--color-ink-faint)"
                : "var(--color-ink)",
          }}
        >
          {fixture.homeTeamName}
        </span>

        <span className="flex shrink-0 items-center gap-1.5">
          <Score
            value={fixture.homeScore}
            won={homeWon}
            decided={fixture.status === "COMPLETED"}
          />
          <span
            className="font-mono text-[0.7rem]"
            style={{ color: "var(--color-ink-ghost)" }}
          >
            &ndash;
          </span>
          <Score
            value={fixture.awayScore}
            won={awayWon}
            decided={fixture.status === "COMPLETED"}
          />
        </span>

        <span
          className="min-w-0 flex-1 truncate text-[0.9rem] font-bold"
          style={{
            color:
              fixture.status === "COMPLETED" && !awayWon
                ? "var(--color-ink-faint)"
                : "var(--color-ink)",
          }}
        >
          {fixture.awayTeamName}
        </span>
      </div>

      {fixture.status !== "CANCELLED" && (
        <div className="mt-3 flex flex-col gap-1.5">
          {fixture.legs.map((leg) => (
            <LegRow
              key={leg.id}
              leg={leg}
              fixture={fixture}
              isHost={isHost}
              mine={mine}
              onStartLeg={onStartLeg}
              working={working}
            />
          ))}
        </div>
      )}
    </article>
  );
}

function Score({
  value,
  won,
  decided,
}: {
  value: number;
  won: boolean;
  decided: boolean;
}) {
  return (
    <span
      className="shrink-0 font-mono text-[1.1rem] font-bold"
      style={{
        color: won
          ? "var(--color-good)"
          : decided
            ? "var(--color-ink-faint)"
            : "var(--color-ink-dim)",
      }}
    >
      {value}
    </span>
  );
}

function LegRow({
  leg,
  fixture,
  isHost,
  mine,
  onStartLeg,
  working,
}: {
  leg: LeagueLegView;
  fixture: LeagueFixtureView;
  isHost: boolean;
  mine: boolean;
  onStartLeg: (fixtureId: string, legId: string) => void | Promise<void>;
  working: string | null;
}) {
  const busy = working === leg.id;
  const winnerName =
    leg.winnerTeamId === fixture.homeTeamId
      ? fixture.homeTeamName
      : leg.winnerTeamId === fixture.awayTeamId
        ? fixture.awayTeamName
        : null;

  return (
    <div
      className="flex flex-wrap items-center gap-2.5 rounded-[6px] px-2.5 py-2"
      style={{ background: "var(--color-surface-2)" }}
    >
      <span
        className="font-mono text-[0.66rem]"
        style={{ color: "var(--color-ink-ghost)" }}
      >
        {leg.ordinal}
      </span>

      {/*
        The problem TITLE, never its statement. A scheduled match is exactly
        the situation where someone would have time to go and prepare an
        answer, so the question itself stays sealed until kick-off.
      */}
      <span
        className="min-w-0 flex-1 truncate font-mono text-[0.72rem]"
        style={{
          color: leg.problemTitle
            ? "var(--color-ink-dim)"
            : "var(--color-ink-ghost)",
        }}
      >
        {leg.problemTitle ?? "Random problem"}
      </span>

      {leg.isFinished && winnerName && (
        <span
          className="font-mono text-[0.66rem]"
          style={{ color: "var(--color-good)" }}
        >
          {winnerName}
        </span>
      )}

      {/* Anyone in the match can walk into it once it exists; only the host
          can bring it into existence. */}
      {leg.battleId ? (
        (mine || isHost) && (
          <Link
            href={`/battle/${leg.battleId}`}
            className="btn btn-ghost px-3! py-1! text-[0.66rem]!"
          >
            {leg.isFinished ? "Result" : "Enter"}
          </Link>
        )
      ) : isHost && fixture.status !== "COMPLETED" ? (
        <button
          className="btn btn-accent px-3! py-1! text-[0.66rem]!"
          onClick={() => void onStartLeg(fixture.id, leg.id)}
          disabled={busy}
        >
          {busy ? <Spinner /> : "Start"}
        </button>
      ) : (
        <span
          className="font-mono text-[0.64rem]"
          style={{ color: "var(--color-ink-ghost)" }}
        >
          not started
        </span>
      )}
    </div>
  );
}

const ROUND_LABEL: Record<LeagueFixtureView["round"], string> = {
  GROUP: "group",
  QUARTER_FINAL: "quarter-final",
  SEMI_FINAL: "semi-final",
  FINAL: "final",
};
