"use client";

import { use, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  CreateFixtureInput,
  LeagueDetailResponse,
  LeagueFixtureView,
  LeagueStandingsResponse,
} from "@repo/protocol";
import { AppShell } from "../../../components/AppShell";
import { ErrorBanner, Spinner } from "../../../components/atoms";
import {
  BackToLeagues,
  FormatChip,
  JoinCode,
  LeagueLogo,
  LeagueStatusChip,
  VisibilityChip,
} from "../../../components/leagues/LeagueBits";
import { TeamsPanel } from "../../../components/leagues/TeamsPanel";
import { FixturesPanel } from "../../../components/leagues/FixturesPanel";
import { ScheduleMatch } from "../../../components/leagues/ScheduleMatch";
import { StandingsTable } from "../../../components/leagues/StandingsTable";
import { RoundDraw } from "../../../components/leagues/RoundDraw";
import {
  ApiCallError,
  cancelLeagueFixture,
  createLeagueFixture,
  createLeagueTeam,
  fetchLeague,
  joinLeagueTeam,
  leaveLeagueTeam,
  fetchLeagueStandings,
  generateLeagueRound,
  scheduleLeagueTiebreak,
  startLeagueLeg,
  updateLeagueFixture,
  updateLeagueTeam,
  updateLeague,
} from "../../../lib/api";
import { useSession } from "../../../lib/useSession";
import { useProfile } from "../../../lib/useProfile";

/**
 * One league: its teams, its matches, and the host's controls.
 *
 * EVERY MUTATION REFETCHES
 * ------------------------
 * Joining a team changes the standings, the fixture eligibility and your own
 * row all at once, and kicking off a leg changes a fixture's status. Patching
 * the local copy would mean re-deriving all of that on the client, in a
 * second implementation of rules the server already owns. A refetch is one
 * indexed query and cannot disagree with the server.
 */
export default function LeaguePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { session, loaded } = useSession();
  const { profile } = useProfile(session);
  const router = useRouter();

  const [detail, setDetail] = useState<LeagueDetailResponse | null>(null);
  const [standings, setStandings] = useState<LeagueStandingsResponse | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [working, setWorking] = useState<string | null>(null);
  const [scheduling, setScheduling] = useState(false);
  /** The fixture being edited, when the host is editing one. */
  const [editingFixture, setEditingFixture] =
    useState<LeagueFixtureView | null>(null);

  const load = useCallback(async () => {
    try {
      // Both in one round trip's worth of waiting: the table and the fixtures
      // are read from the same settled state, so fetching them separately in
      // sequence could show a match as decided in one and pending in the other.
      const [d, s] = await Promise.all([
        fetchLeague(id, session?.token),
        fetchLeagueStandings(id, session?.token),
      ]);
      setDetail(d);
      setStandings(s);
      setError(null);
    } catch (e) {
      setError(
        e instanceof ApiCallError ? e.message : "Could not load the league.",
      );
    } finally {
      setBusy(false);
    }
  }, [id, session]);

  useEffect(() => {
    if (!loaded) return;
    void load();
  }, [loaded, load]);

  /*
   * Keep the page live while a match is being played.
   *
   * Battles finish in the ws-server, which knows nothing about leagues, so
   * nothing pushes a league result anywhere. Without this the scoreline is
   * frozen at whatever it was when the page loaded — everyone watching a
   * match sees a stale 0-0 until they think to reload.
   *
   * Only polls while something is actually LIVE, and never in a hidden tab,
   * so an idle league page costs nothing.
   */
  const hasLiveMatch = detail?.fixtures.some((f) => f.status === "LIVE") ?? false;

  useEffect(() => {
    if (!hasLiveMatch) return;
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 15_000);
    return () => clearInterval(timer);
  }, [hasLiveMatch, load]);

  /** Run a mutation, surface its error, and refetch. */
  async function act(key: string, fn: () => Promise<unknown>) {
    setWorking(key);
    setError(null);
    try {
      await fn();
      await load();
    } catch (e) {
      setError(
        e instanceof ApiCallError ? e.message : "That did not work.",
      );
    } finally {
      setWorking(null);
    }
  }

  const token = session && !session.isGuest ? session.token : null;

  async function startLeg(fixtureId: string, legId: string) {
    if (!token) return;
    setWorking(legId);
    setError(null);
    try {
      const { battleId } = await startLeagueLeg(token, id, fixtureId, legId);
      // Straight into the room. The host is a participant in most leagues,
      // and even when they are not, they want to see it has actually opened.
      router.push(`/battle/${battleId}`);
    } catch (e) {
      setError(
        e instanceof ApiCallError ? e.message : "Could not start the match.",
      );
      setWorking(null);
    }
  }

  return (
    <AppShell session={session} profile={profile}>
      <div className="mx-auto w-full max-w-5xl px-5 py-8 sm:px-7">
        {busy ? (
          <div className="flex justify-center py-20">
            <Spinner />
          </div>
        ) : !detail ? (
          <>
            <BackToLeagues />
            <div className="mt-4">
              <ErrorBanner message={error ?? "League not found."} />
            </div>
          </>
        ) : (
          <>
            {/* --- header --- */}
            <div className="flex flex-wrap items-start gap-4">
              <LeagueLogo
                name={detail.league.name}
                logoUrl={detail.league.logoUrl}
                size={64}
              />
              <div className="min-w-0 flex-1">
                <BackToLeagues />
                <h1 className="mt-2 text-2xl font-bold">
                  {detail.league.name}
                </h1>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <LeagueStatusChip value={detail.league.status} />
                  <VisibilityChip value={detail.league.visibility} />
                  <FormatChip teamSize={detail.league.teamSize} />
                  <span
                    className="font-mono text-[0.68rem]"
                    style={{ color: "var(--color-ink-faint)" }}
                  >
                    run by {detail.league.hostName}
                  </span>
                </div>
              </div>

              {/* The code is only ever sent to someone involved — see the
                  service, which nulls it for everyone else. */}
              {detail.league.joinCode && (
                <JoinCode code={detail.league.joinCode} />
              )}
            </div>

            {/*
              A called-off league still shows its teams and whatever was
              played, so without this banner the page reads as live and a
              player could sit waiting for a match that will never start.
            */}
            {detail.league.status === "CANCELLED" && (
              <div
                className="mt-4 rounded-[8px] border p-3"
                style={{
                  borderColor: "var(--color-bad)",
                  background:
                    "color-mix(in srgb, var(--color-bad) 8%, transparent)",
                }}
              >
                <p
                  className="font-mono text-[0.74rem]"
                  style={{ color: "var(--color-bad)" }}
                >
                  This league was called off. No further matches will be
                  played; everything already played is kept below.
                </p>
              </div>
            )}

            {detail.league.description && (
              <p
                className="mt-4 max-w-3xl font-mono text-[0.76rem] leading-[1.9]"
                style={{ color: "var(--color-ink-dim)" }}
              >
                {detail.league.description}
              </p>
            )}

            {/* --- host controls --- */}
            {detail.isHost && (
              <div className="mt-5 flex flex-wrap gap-2.5">
                {!scheduling && (
                  <button
                    className="btn btn-primary"
                    onClick={() => setScheduling(true)}
                    disabled={
                      detail.league.status === "FINISHED" ||
                      detail.league.status === "CANCELLED"
                    }
                  >
                    + Schedule a match
                  </button>
                )}
                {detail.league.status === "OPEN" && (
                  <button
                    className="btn btn-ghost"
                    onClick={() =>
                      void act("status", () =>
                        updateLeague(token!, id, { status: "RUNNING" }),
                      )
                    }
                    title="Stop new teams from registering"
                  >
                    Close registration
                  </button>
                )}
                {detail.league.status === "RUNNING" && (
                  <>
                    <button
                      className="btn btn-ghost"
                      onClick={() =>
                        void act("status", () =>
                          updateLeague(token!, id, { status: "OPEN" }),
                        )
                      }
                    >
                      Reopen registration
                    </button>
                    <button
                      className="btn btn-ghost"
                      onClick={() => {
                        if (
                          window.confirm(
                            "Finish this league? The standings become final.",
                          )
                        ) {
                          void act("status", () =>
                            updateLeague(token!, id, { status: "FINISHED" }),
                          );
                        }
                      }}
                    >
                      Finish league
                    </button>
                  </>
                )}

                {/*
                  Calling a league off is distinct from finishing it: an
                  abandoned league has no champion, so filing it as finished
                  would put a winner on something nobody won. Offered in both
                  live states, because a league can be abandoned before a
                  single match is played.
                */}
                {(detail.league.status === "OPEN" ||
                  detail.league.status === "RUNNING") && (
                  <button
                    className="btn btn-ghost"
                    style={{ color: "var(--color-bad)" }}
                    onClick={() => {
                      if (
                        window.confirm(
                          "Call off this league? It stops accepting teams and matches. Results already played are kept.",
                        )
                      ) {
                        void act("status", () =>
                          updateLeague(token!, id, { status: "CANCELLED" }),
                        );
                      }
                    }}
                  >
                    Cancel league
                  </button>
                )}
              </div>
            )}

            {error && (
              <div className="mt-5">
                <ErrorBanner message={error} />
              </div>
            )}

            {(scheduling || editingFixture) && token && (
              <div className="mt-5">
                <ScheduleMatch
                  key={editingFixture?.id ?? "new"}
                  teams={detail.teams}
                  token={token}
                  editing={editingFixture}
                  busy={working === "fixture"}
                  onCancel={() => {
                    setScheduling(false);
                    setEditingFixture(null);
                  }}
                  onCreate={async (input: CreateFixtureInput) => {
                    if (editingFixture) {
                      // An edit sends only what an edit may change — the teams
                      // are absent by design, so the server cannot be asked to
                      // swap who is playing.
                      await act("fixture", () =>
                        updateLeagueFixture(token, id, editingFixture.id, {
                          timeLimitSec: input.timeLimitSec,
                          difficulty: input.difficulty,
                          legs: input.legs,
                        }),
                      );
                      setEditingFixture(null);
                    } else {
                      await act("fixture", () =>
                        createLeagueFixture(token, id, input),
                      );
                      setScheduling(false);
                    }
                  }}
                />
              </div>
            )}

            {/*
              The champion, announced.

              A league that has been won should say so at the top, not leave
              it to be inferred from a highlighted row further down. This is
              the whole point of running the tournament.
            */}
            {standings?.championTeamName && (
              <div
                className="mt-6 rounded-[10px] border p-4 text-center"
                style={{
                  borderColor: "var(--color-amber)",
                  background:
                    "color-mix(in srgb, var(--color-amber) 10%, transparent)",
                }}
              >
                <p
                  className="font-mono text-[0.64rem] uppercase tracking-[0.2em]"
                  style={{ color: "var(--color-amber)" }}
                >
                  Champion
                </p>
                <p className="mt-1.5 text-[1.3rem] font-bold">
                  {standings.championTeamName}
                </p>
              </div>
            )}

            {/* --- standings --- */}
            {standings && standings.rows.length > 0 && (
              <div className="mt-8">
                <div className="mb-3 flex items-baseline gap-3">
                  <h2 className="text-[1.05rem] font-bold">Standings</h2>
                  <span
                    className="font-mono text-[0.7rem]"
                    style={{ color: "var(--color-ink-faint)" }}
                  >
                    group stage
                  </span>
                </div>
                <StandingsTable
                  standings={standings}
                  myTeamId={detail.myTeamId}
                />
              </div>
            )}

            {/* --- knockout controls, host only --- */}
            {detail.isHost &&
              token &&
              standings &&
              detail.league.status !== "CANCELLED" && (
                <div className="mt-6">
                  <RoundDraw
                    standings={standings}
                    busy={working === "round"}
                    onSetRule={(rule) =>
                      act("round", () =>
                        updateLeague(token, id, { qualification: rule }),
                      )
                    }
                    onDraw={() =>
                      act("round", () => generateLeagueRound(token, id))
                    }
                    onScheduleTiebreak={() =>
                      act("round", () => scheduleLeagueTiebreak(token, id))
                    }
                  />
                </div>
              )}

            {/* --- matches --- */}
            <div className="mt-8">
              <div className="mb-3 flex items-baseline gap-3">
                <h2 className="text-[1.05rem] font-bold">Matches</h2>
                <span
                  className="font-mono text-[0.7rem]"
                  style={{ color: "var(--color-ink-faint)" }}
                >
                  {detail.fixtures.length}
                </span>
              </div>
              <FixturesPanel
                detail={detail}
                isHost={detail.isHost}
                myTeamId={detail.myTeamId}
                working={working}
                onStartLeg={startLeg}
                onCancel={(fixtureId) =>
                  act(fixtureId, () =>
                    cancelLeagueFixture(token!, id, fixtureId),
                  )
                }
                onEdit={(fixture) => {
                  setEditingFixture(fixture);
                  setScheduling(false);
                }}
              />
            </div>

            {/* --- teams --- */}
            <div className="mt-10">
              <TeamsPanel
                detail={detail}
                session={session}
                working={working}
                onCreate={(name, logoUrl) =>
                  act("create", () =>
                    createLeagueTeam(token!, id, { name, logoUrl }),
                  )
                }
                onRename={(teamId, name, logoUrl) =>
                  act(teamId, () =>
                    updateLeagueTeam(token!, id, teamId, {
                      name,
                      // Only sent when a crest was actually chosen, so a
                      // rename does not clear an existing logo.
                      ...(logoUrl !== undefined && { logoUrl }),
                    }),
                  )
                }
                onJoin={(teamId) =>
                  act(teamId, () => joinLeagueTeam(token!, id, teamId))
                }
                onLeave={(teamId, userId) =>
                  act(teamId, () =>
                    leaveLeagueTeam(token!, id, teamId, userId),
                  )
                }
              />
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
