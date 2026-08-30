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
        <span className="block truncate font-semibold">
          {entry.problemTitle ?? "Problem not assigned"}
        </span>
        <span className="label mt-0.5 block">
          {modeLabel(entry.mode)} · {titleCase(entry.difficulty)} · Room{" "}
          {entry.roomCode}
          {entry.mySide && ` · Team ${entry.mySide}`}
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
