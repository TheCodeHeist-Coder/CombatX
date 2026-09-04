"use client";

import { useState } from "react";
import type { LeagueDetailResponse, LeagueTeamView } from "@repo/protocol";
import { Spinner } from "../atoms";
import { UserAvatar } from "../identity/UserIdentity";
import { LeagueLogo } from "./LeagueBits";
import type { Session } from "../../lib/session";

/**
 * The teams in a league: the standings table and the way in.
 *
 * ONE PANEL, NOT TWO
 * ------------------
 * Joining and the standings are the same list. A separate "available teams"
 * section would show the same rows twice and make it ambiguous which one you
 * are looking at once you have joined. Instead every team is one row, and the
 * row grows a Join button only when joining it is actually possible.
 */
export function TeamsPanel({
  detail,
  session,
  onCreate,
  onJoin,
  onLeave,
  working,
}: {
  detail: LeagueDetailResponse;
  session: Session | null;
  onCreate: (name: string) => void | Promise<void>;
  onJoin: (teamId: string) => void | Promise<void>;
  onLeave: (teamId: string, userId: string) => void | Promise<void>;
  working: string | null;
}) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");

  const { league, teams, myTeamId, isHost } = detail;
  const me = session && !session.isGuest ? session.userId : null;

  // Registration is only open in the OPEN state — the server agrees, so this
  // hides a button that would otherwise be refused rather than inventing a rule.
  const canRegister = league.status === "OPEN" && me !== null;
  const inATeam = myTeamId !== null;

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
        <div className="flex items-baseline gap-3">
          <h2 className="text-[1.05rem] font-bold">Teams</h2>
          <span
            className="font-mono text-[0.7rem]"
            style={{ color: "var(--color-ink-faint)" }}
          >
            {teams.length}
            {league.maxTeams !== null && ` / ${league.maxTeams}`}
          </span>
        </div>

        {canRegister && !inATeam && !creating && (
          <button
            className="btn btn-accent px-4! py-1.5! text-[0.72rem]!"
            onClick={() => setCreating(true)}
          >
            + Create a team
          </button>
        )}
      </div>

      {creating && (
        <div className="panel mb-3 flex flex-wrap items-end gap-3 p-4">
          <div className="min-w-0 flex-1">
            <label htmlFor="team-name" className="label">
              Team name
            </label>
            <input
              id="team-name"
              className="field mt-1.5 w-full"
              value={name}
              maxLength={40}
              placeholder="Segfault United"
              autoFocus
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <button
            className="btn btn-primary"
            disabled={name.trim().length < 2 || working === "create"}
            onClick={() => void onCreate(name.trim())}
          >
            {working === "create" ? <Spinner /> : "Create"}
          </button>
          <button
            className="btn btn-ghost"
            onClick={() => {
              setCreating(false);
              setName("");
            }}
          >
            Cancel
          </button>
        </div>
      )}

      {teams.length === 0 ? (
        <div className="panel p-8 text-center">
          <p
            className="font-mono text-[0.8rem]"
            style={{ color: "var(--color-ink-dim)" }}
          >
            No teams yet.
            {canRegister
              ? " Be the first to register one."
              : league.status === "OPEN"
                ? " Sign in to register one."
                : ""}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {teams.map((team) => (
            <TeamRow
              key={team.id}
              team={team}
              teamSize={league.teamSize}
              isMine={team.id === myTeamId}
              canJoin={canRegister && !inATeam && !team.isFull}
              canManage={isHost || team.captainUserId === me}
              me={me}
              onJoin={onJoin}
              onLeave={onLeave}
              working={working}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function TeamRow({
  team,
  teamSize,
  isMine,
  canJoin,
  canManage,
  me,
  onJoin,
  onLeave,
  working,
}: {
  team: LeagueTeamView;
  teamSize: number;
  isMine: boolean;
  canJoin: boolean;
  canManage: boolean;
  me: string | null;
  onJoin: (teamId: string) => void | Promise<void>;
  onLeave: (teamId: string, userId: string) => void | Promise<void>;
  working: string | null;
}) {
  const busy = working === team.id;

  return (
    <article
      className="panel p-4"
      style={
        isMine
          ? {
              borderColor: "var(--color-primary)",
              background:
                "color-mix(in srgb, var(--color-primary) 5%, transparent)",
            }
          : undefined
      }
    >
      <div className="flex flex-wrap items-center gap-3">
        <LeagueLogo name={team.name} logoUrl={team.logoUrl} size={36} />
        <h3 className="text-[0.92rem] font-bold">{team.name}</h3>

        {isMine && (
          <span
            className="chip font-mono"
            style={{
              borderColor: "var(--color-primary)",
              color: "var(--color-accent)",
              fontSize: "0.62rem",
            }}
          >
            your team
          </span>
        )}

        <span
          className="font-mono text-[0.68rem]"
          style={{
            color: team.isFull ? "var(--color-good)" : "var(--color-warn)",
          }}
        >
          {team.members.length}/{teamSize}
          {team.isFull ? " · ready" : " · needs players"}
        </span>

        {/* Record. Only shown once they have played, so an untouched league
            is not a wall of zeroes. */}
        {team.played > 0 && (
          <span
            className="font-mono text-[0.68rem]"
            style={{ color: "var(--color-ink-faint)" }}
          >
            {team.won}W · {team.lost}L
          </span>
        )}

        <div className="ml-auto flex gap-2">
          {canJoin && (
            <button
              className="btn btn-accent px-3! py-1.5! text-[0.7rem]!"
              onClick={() => void onJoin(team.id)}
              disabled={busy}
            >
              {busy ? <Spinner /> : "Join"}
            </button>
          )}
          {isMine && me && (
            <button
              className="btn btn-ghost px-3! py-1.5! text-[0.7rem]!"
              onClick={() => void onLeave(team.id, me)}
              disabled={busy}
            >
              Leave
            </button>
          )}
        </div>
      </div>

      {team.members.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {team.members.map((m) => (
            <span
              key={m.userId}
              className="flex items-center gap-1.5 rounded-full py-1 pl-1 pr-2.5"
              style={{
                background: "var(--color-surface-2)",
                border: "1px solid var(--color-line)",
              }}
            >
              <UserAvatar
                identity={{
                  username: m.username,
                  name: null,
                  avatarId: m.avatarId,
                  avatarColor: m.avatarColor,
                  imageUrl: m.imageUrl,
                }}
                size={20}
                rounded={999}
              />
              <span className="font-mono text-[0.68rem]">{m.username}</span>
              {m.isCaptain && (
                <span
                  className="font-mono text-[0.58rem] uppercase tracking-wider"
                  style={{ color: "var(--color-amber)" }}
                  title="Captain"
                >
                  C
                </span>
              )}
              {/* The captain and the host may remove someone else; everyone
                  removes themselves with the Leave button above. */}
              {canManage && m.userId !== me && (
                <button
                  className="ml-0.5 font-mono text-[0.7rem] leading-none"
                  style={{ color: "var(--color-ink-ghost)" }}
                  title={`Remove ${m.username}`}
                  onClick={() => void onLeave(team.id, m.userId)}
                >
                  ×
                </button>
              )}
            </span>
          ))}
        </div>
      )}
    </article>
  );
}
