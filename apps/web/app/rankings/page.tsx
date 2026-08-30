"use client";

import { useEffect, useState } from "react";
import type { LeaderboardEntry, LeaderboardResponse } from "@repo/protocol";
import { rankFor } from "@repo/game";
import { AppShell } from "../../components/AppShell";
import { Spinner } from "../../components/atoms";
import { fetchLeaderboard } from "../../lib/api";
import { useSession } from "../../lib/useSession";
import { useProfile } from "../../lib/useProfile";
import {
  NameStack,
  ProfileLink,
  UserAvatar,
} from "../../components/identity/UserIdentity";

/** Global XP leaderboard. Every figure is read from the database. */
export default function RankingsPage() {
  const { session } = useSession();
  const { profile } = useProfile(session);

  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    fetchLeaderboard(session?.token)
      .then((d) => active && setData(d))
      .catch(() => active && setFailed(true));
    return () => {
      active = false;
    };
  }, [session?.token]);

  const outsidePage =
    data?.me && !data.entries.some((e) => e.userId === data.me?.userId)
      ? data.me
      : null;

  return (
    <AppShell session={session} profile={profile}>
      <div className="mx-auto w-full max-w-4xl px-5 py-8 sm:px-7">
        <h1 className="mt-2 wordmark  text-2xl font-bold uppercase tracking-wide">
          Rankings
        </h1>
        <p
          className="mt-2 font-mono text-[0.8rem]"
          style={{ color: "var(--color-ink-dim)" }}
        >
          Ranked by career XP. Only operatives who have fought at least one
          battle appear.
        </p>

        {failed ? (
          <p
            className="panel mt-6 p-5 font-mono text-[0.8rem]"
            style={{ color: "var(--color-bad)" }}
          >
            Could not load the leaderboard.
          </p>
        ) : !data ? (
          <div className="mt-8 flex justify-center">
            <Spinner />
          </div>
        ) : data.entries.length === 0 ? (
          <p
            className="panel mt-6 p-5 font-mono text-[0.8rem]"
            style={{ color: "var(--color-ink-faint)" }}
          >
            No ranked operatives yet — finish a battle to appear here.
          </p>
        ) : (
          <div className="panel mt-6 overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr style={{ background: "var(--color-surface-2)" }}>
                  <Th>#</Th>
                  <Th>Operative</Th>
                  <Th>Rank</Th>
                  <Th align="right">XP</Th>
                  <Th align="right">W/L</Th>
                  <Th align="right">Best streak</Th>
                </tr>
              </thead>
              <tbody>
                {data.entries.map((e) => (
                  <Row
                    key={e.userId}
                    entry={e}
                    isMe={e.userId === session?.userId}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {outsidePage && (
          <>
            <p className="label mt-6">Your standing</p>
            <div className="panel mt-2 overflow-x-auto">
              <table className="w-full border-collapse">
                <tbody>
                  <Row entry={outsidePage} isMe />
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}

function Th({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      className="label border-b px-4 py-2.5"
      style={{ borderColor: "var(--color-line)", textAlign: align }}
    >
      {children}
    </th>
  );
}

function Row({ entry, isMe }: { entry: LeaderboardEntry; isMe: boolean }) {
  const tier = rankFor(entry.xp);
  return (
    <tr
      style={{
        background: isMe ? "var(--color-surface-2)" : undefined,
      }}
    >
      <Td>
        <span
          className="font-bold"
          style={{
            color:
              entry.rank <= 3 ? "var(--color-accent)" : "var(--color-ink-faint)",
          }}
        >
          {String(entry.rank).padStart(2, "0")}
        </span>
      </Td>
      <Td>
        <span className="flex items-center gap-2.5">
          <ProfileLink
            username={entry.username}
            className="flex min-w-0 items-center gap-2.5"
          >
            <UserAvatar identity={entry} size={26} rounded={6} />
            <NameStack identity={entry} usernameClassName="font-semibold" />
          </ProfileLink>
          {isMe && <span className="label">you</span>}
        </span>
      </Td>
      <Td>
        <span style={{ color: "var(--color-ink-dim)" }}>{tier.label}</span>
      </Td>
      <Td align="right">
        <span className="font-bold">{entry.xp}</span>
      </Td>
      <Td align="right">
        {entry.wins}/{entry.losses}
      </Td>
      <Td align="right">{entry.bestStreak}</Td>
    </tr>
  );
}

function Td({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <td
      className="border-b px-4 py-3 font-mono text-[0.82rem] tabular-nums"
      style={{ borderColor: "var(--color-line)", textAlign: align }}
    >
      {children}
    </td>
  );
}
