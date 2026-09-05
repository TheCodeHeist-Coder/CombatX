"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { BattleHistoryEntry } from "@repo/protocol";
import { AppShell } from "../../components/AppShell";
import { Spinner } from "../../components/atoms";
import { fetchMyBattles } from "../../lib/api";
import { useSession } from "../../lib/useSession";
import { useProfile } from "../../lib/useProfile";
import { modeLabel, titleCase } from "../../lib/format";
import { SignInGate } from "../../components/SignInGate";

/** The caller's battle history, newest first. */
export default function ArchivePage() {
  const { session, loaded } = useSession();
  const { profile } = useProfile(session);

  const [entries, setEntries] = useState<BattleHistoryEntry[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!session) return;
    let active = true;
    fetchMyBattles(session.token)
      .then((d) => active && setEntries(d.entries))
      .catch(() => active && setFailed(true));
    return () => {
      active = false;
    };
  }, [session]);

  return (
    <AppShell session={session} profile={profile}>
      <div className="mx-auto w-full max-w-4xl px-5 py-8 sm:px-7">
        <h1 className="mt-2 wordmark text-2xl font-bold uppercase tracking-wide">
          Archive
        </h1>
        <p
          className="mt-2 font-mono text-[0.8rem]"
          style={{ color: "var(--color-ink-dim)" }}
        >
          Every battle you have submitted code in. Sourced from your
          submissions — the durable record of participation.
        </p>

        {loaded && (!session || session.isGuest) ? (
          <SignInGate what="see your battle history" guest={!!session?.isGuest} />
        ) : failed ? (
          <p
            className="panel mt-6 p-5 font-mono text-[0.8rem]"
            style={{ color: "var(--color-bad)" }}
          >
            Could not load your history.
          </p>
        ) : !entries ? (
          <div className="mt-8 flex justify-center">
            <Spinner />
          </div>
        ) : entries.length === 0 ? (
          <Empty>
            No battles on record yet. Submit code in a battle and it will appear
            here.
          </Empty>
        ) : (
          <ul className="mt-6 flex flex-col gap-2">
            {entries.map((e) => (
              <HistoryRow key={e.battleId} entry={e} />
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="panel mt-6 p-5 font-mono text-[0.8rem]"
      style={{ color: "var(--color-ink-faint)" }}
    >
      {children}
    </p>
  );
}

function HistoryRow({ entry }: { entry: BattleHistoryEntry }) {
  const decided = entry.winnerSide != null;
  const won = decided && entry.winnerSide === entry.mySide;

  const verdict = !decided
    ? { text: "Unfinished", color: "var(--color-ink-faint)" }
    : won
      ? { text: "Victory", color: "var(--color-good)" }
      : { text: "Defeat", color: "var(--color-bad)" };

  return (
    <li className="panel step-card flex flex-wrap items-center gap-x-5 gap-y-2 p-4">
      <span
        className="w-20 shrink-0 font-mono text-[0.72rem] font-bold uppercase tracking-wider"
        style={{ color: verdict.color }}
      >
        {verdict.text}
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="min-w-0 truncate font-semibold">
            {entry.problemTitle ?? "Problem not assigned"}
          </span>
          {/*
            A league match is an ordinary battle, so without this it sat in
            the archive indistinguishable from a casual room-code game —
            someone could play a whole tournament and their record would say
            nothing about it.
          */}
          {entry.leagueName && (
            <Link
              href={`/leagues/${entry.leagueId}`}
              className="chip shrink-0 font-mono"
              style={{
                borderColor: "var(--color-amber)",
                color: "var(--color-amber)",
                fontSize: "0.6rem",
              }}
              title={`Part of ${entry.leagueName}`}
            >
              {entry.leagueRound && entry.leagueRound !== "GROUP"
                ? ROUND_SHORT[entry.leagueRound] ?? "league"
                : "league"}
            </Link>
          )}
        </span>
        <span className="label mt-0.5 block">
          {/*
            Who you played, not which side you sat on.

            "Team A" is an implementation detail of the arena; looking back at
            a match weeks later, the thing that identifies it is the opponent.
            Falls back to the side letter only when the seats were never
            persisted, which is the one case where no name exists.
          */}
          {entry.opponentNames.length > 0
            ? `vs ${entry.opponentNames.join(", ")}`
            : entry.mySide
              ? `Team ${entry.mySide}`
              : "No opponent"}
          {entry.teammateNames.length > 0 &&
            ` · with ${entry.teammateNames.join(", ")}`}
          {" · "}
          {entry.leagueName ? `${entry.leagueName} · ` : ""}
          {modeLabel(entry.mode)} · {titleCase(entry.difficulty)}
        </span>
      </span>

      <span className="font-mono text-[0.85rem] font-bold tabular-nums">
        {entry.myBestPassed}/{entry.totalTests || "—"}
      </span>

      <Link
        href={`/battle/${entry.battleId}`}
        className="btn btn-ghost px-3! py-1.5! text-[0.65rem]!"
      >
        Open
      </Link>
    </li>
  );
}

/**
 * Short labels for a knockout round, so a final reads as a final.
 *
 * A plain record rather than an exhaustive Record<LeagueRound, string>: the
 * round arrives as a string on the history entry (it is context, not a typed
 * discriminator), and an unrecognised value falls back to "league" rather
 * than failing to render.
 */
const ROUND_SHORT: Record<string, string> = {
  TIEBREAK: "decider",
  QUARTER_FINAL: "quarter-final",
  SEMI_FINAL: "semi-final",
  FINAL: "final",
};
