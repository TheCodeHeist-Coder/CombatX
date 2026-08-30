"use client";

import { useEffect, useState } from "react";
import type {
  LeaderboardBoard,
  LeaderboardEntry,
  LeaderboardResponse,
} from "@repo/protocol";
import { rankFor } from "@repo/game";
import { AppShell } from "../../components/AppShell";
import { Spinner } from "../../components/atoms";
import { BadgeRow } from "../../components/ranking/Badges";
import { fetchLeaderboard } from "../../lib/api";
import { useSession } from "../../lib/useSession";
import { useProfile } from "../../lib/useProfile";
import {
  NameStack,
  ProfileLink,
  UserAvatar,
} from "../../components/identity/UserIdentity";

/**
 * The ladder.
 *
 * Two boards, because "who is best" and "who has played most" are different
 * questions and one number cannot honestly answer both:
 *
 *   Rating  Glicko-2. Zero-sum, moves only in matchmade battles, and can fall.
 *   XP      Career volume. Rises only, so it rewards showing up.
 *
 * Rating is the default because it is the one that means something.
 */
export default function RankingsPage() {
  const { session } = useSession();
  const { profile } = useProfile(session);

  const [board, setBoard] = useState<LeaderboardBoard>("rating");
  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    setData(null);
    setFailed(false);
    fetchLeaderboard(session?.token, board)
      .then((d) => active && setData(d))
      .catch(() => active && setFailed(true));
    return () => {
      active = false;
    };
  }, [session?.token, board]);

  const outsidePage =
    data?.me && !data.entries.some((e) => e.userId === data.me?.userId)
      ? data.me
      : null;

  return (
    <AppShell session={session} profile={profile}>
      <div className="mx-auto w-full max-w-5xl px-5 py-8 sm:px-7">
        <p className="eyebrow">Module // rankings</p>
        <h1 className="mt-2 font-mono text-2xl font-bold uppercase tracking-tight">
          Rankings
        </h1>
        <p
          className="mt-2 max-w-2xl font-mono text-[0.8rem] leading-relaxed"
          style={{ color: "var(--color-ink-dim)" }}
        >
          {board === "rating"
            ? "Skill rating from ranked battles only. It moves both ways, and a rating is withheld until enough battles have been fought to be sure of it."
            : "Career XP — how much you have fought. Earned in every battle, ranked or not."}
        </p>

        <div className="mt-5 flex gap-1.5">
          <BoardTab
            active={board === "rating"}
            onClick={() => setBoard("rating")}
            label="Rating"
          />
          <BoardTab
            active={board === "xp"}
            onClick={() => setBoard("xp")}
            label="Career XP"
          />
        </div>

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
            {board === "rating"
              ? "No placed operatives yet — ranked battles decide this board."
              : "No ranked operatives yet — finish a battle to appear here."}
          </p>
        ) : (
          <div className="panel mt-4 overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr style={{ background: "var(--color-surface-2)" }}>
                  <Th>#</Th>
                  <Th>Operative</Th>
                  <Th>{board === "rating" ? "Tier" : "Rank"}</Th>
                  <Th align="right">
                    {board === "rating" ? "Rating" : "XP"}
                  </Th>
                  <Th align="right">W/L</Th>
                  <Th align="right">Streak</Th>
                </tr>
              </thead>
              <tbody>
                {data.entries.map((e) => (
                  <Row
                    key={e.userId}
                    entry={e}
                    board={board}
                    isMe={e.userId === session?.userId}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/*
          Signed in but not on the board yet. Saying so beats silently omitting
          them, which reads as a bug rather than a rule.
        */}
        {data?.meProvisional && (
          <p
            className="panel mt-4 p-4 font-mono text-[0.76rem]"
            style={{ color: "var(--color-ink-faint)" }}
          >
            You are still placing. Finish a few more ranked battles and your
            rating will appear here.
          </p>
        )}

        {outsidePage && (
          <>
            <p className="label mt-6">Your standing</p>
            <div className="panel mt-2 overflow-x-auto">
              <table className="w-full border-collapse">
                <tbody>
                  <Row entry={outsidePage} board={board} isMe />
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}

function BoardTab({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className="rounded-[7px] border px-3.5 py-1.5 font-mono text-[0.72rem] font-bold uppercase tracking-wide transition-colors"
      style={{
        borderColor: active ? "var(--color-primary)" : "var(--color-line)",
        background: active
          ? "color-mix(in srgb, var(--color-primary) 14%, transparent)"
          : "transparent",
        color: active ? "var(--color-primary)" : "var(--color-ink-faint)",
      }}
      aria-pressed={active}
    >
      {label}
    </button>
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

function Row({
  entry,
  board,
  isMe,
}: {
  entry: LeaderboardEntry;
  board: LeaderboardBoard;
  isMe: boolean;
}) {
  const xpRank = rankFor(entry.xp);
  return (
    <tr style={{ background: isMe ? "var(--color-surface-2)" : undefined }}>
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
        <span className="flex flex-col gap-1">
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
          {/* The rarest few, so a row shows what distinguishes someone
              rather than the First Blood everybody has. */}
          <BadgeRow badges={entry.badges} size="sm" />
        </span>
      </Td>
      <Td>
        <span style={{ color: "var(--color-ink-dim)" }}>
          {board === "rating"
            ? entry.rating.tierLabel ?? "Unranked"
            : xpRank.label}
        </span>
      </Td>
      <Td align="right">
        <span className="font-bold">
          {board === "rating" ? entry.rating.rating : entry.xp}
        </span>
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
