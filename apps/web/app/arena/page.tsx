"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { BattleHistoryEntry } from "@repo/protocol";
import { AppShell } from "../../components/AppShell";
import { Launcher } from "../../components/Launcher";
import { Spinner } from "../../components/atoms";
import { fetchMyBattles } from "../../lib/api";
import { useSession } from "../../lib/useSession";
import { useProfile } from "../../lib/useProfile";
import { modeLabel, titleCase } from "../../lib/format";
import { SignInGate } from "../../components/SignInGate";

/** Battle phases that are still joinable / in-flight. */
const LIVE_STATUSES = new Set(["LOBBY", "COUNTDOWN", "IN_PROGRESS"]);

/**
 * The Arena entry point.
 *
 * The live combat screen lives at /battle/[id] — you cannot have an arena
 * without a room. So this page does the two things that get you there: resume
 * any battle of yours that is still live, or launch a fresh one.
 */
export default function ArenaPage() {
  const { session, loaded, refresh } = useSession();
  const { profile } = useProfile(session);
  const router = useRouter();

  const [battles, setBattles] = useState<BattleHistoryEntry[] | null>(null);

  useEffect(() => {
    if (!session) return;
    let active = true;
    fetchMyBattles(session.token)
      .then((d) => active && setBattles(d.entries))
      .catch(() => active && setBattles([]));
    return () => {
      active = false;
    };
  }, [session]);

  const live = battles?.filter((b) => LIVE_STATUSES.has(b.status)) ?? [];

  return (
    <AppShell session={session} profile={profile} rail>
      <div className="mx-auto w-full max-w-4xl px-5 py-8 sm:px-7">
        <p className="eyebrow">Sector // arena</p>
        <h1 className="mt-2 font-mono text-2xl font-bold uppercase tracking-tight">
          Arena
        </h1>
        <p
          className="mt-2 font-mono text-[0.8rem]"
          style={{ color: "var(--color-ink-dim)" }}
        >
          Deploy into live combat. Resume a battle already in progress, or open
          a new room.
        </p>

        {loaded && !session ? (
          <SignInGate what="deploy into a battle" onReady={refresh} />
        ) : (
          <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1fr]">
            {/* Resume live battles */}
            <section>
              <h2 className="label mb-3">Active engagements</h2>

              {!battles ? (
                <div className="panel flex h-32 items-center justify-center">
                  <Spinner />
                </div>
              ) : live.length === 0 ? (
                <div
                  className="panel flex h-32 flex-col items-center justify-center gap-1 p-5 text-center"
                  style={{ color: "var(--color-ink-faint)" }}
                >
                  <span className="font-mono text-[0.8rem]">
                    No active engagements.
                  </span>
                  <span className="font-mono text-[0.7rem]">
                    Launch one to deploy.
                  </span>
                </div>
              ) : (
                <ul className="flex flex-col gap-2">
                  {live.map((b) => (
                    <li
                      key={b.battleId}
                      className="panel step-card flex items-center gap-3 p-4"
                    >
                      <span
                        className="pulse-soft h-2 w-2 shrink-0 rounded-full"
                        style={{ background: "var(--color-accent)" }}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold">
                          {b.problemTitle ?? "In lobby"}
                        </p>
                        <p className="label mt-0.5">
                          {modeLabel(b.mode)} · {titleCase(b.difficulty)} · Room{" "}
                          {b.roomCode} · {statusLabel(b.status)}
                        </p>
                      </div>
                      <Link
                        href={`/battle/${b.battleId}`}
                        className="btn btn-primary px-3! py-1.5! text-[0.65rem]!"
                      >
                        Re-enter
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Launch new */}
            <section className="panel p-5">
              <h2 className="label mb-4">Deploy new battle</h2>
              {session && (
                <Launcher
                  session={session}
                  onEnterBattle={(id) => router.push(`/battle/${id}`)}
                />
              )}
            </section>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function statusLabel(status: string): string {
  switch (status) {
    case "LOBBY":
      return "Awaiting players";
    case "COUNTDOWN":
      return "Starting";
    case "IN_PROGRESS":
      return "Live";
    default:
      return titleCase(status);
  }
}
