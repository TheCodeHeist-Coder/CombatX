import { prisma } from "@repo/db";
import {
  TEAM_SIZE_MODE,
  type CreateFixtureInput,
  type UpdateFixtureInput,
  type LeagueRound,
  type LeagueFixtureView,
  type LeagueLegView,
  type LeagueProblemOption,
  type StartLegResponse,
} from "@repo/protocol";
import { badRequest, conflict, notFound } from "../../http/errors.js";
import { generateRoomCode } from "../../roomCode.js";
import { requireHost } from "./leagues.service.js";
import {
  fixtureParticipants,
  notify,
} from "../notifications/notifications.service.js";

/**
 * Fixtures — the host pairing teams, and those pairings becoming real battles.
 *
 * HOW A FIXTURE BECOMES A MATCH
 * -----------------------------
 * A fixture is a tie; its legs are the battles that decide it. Scheduling
 * writes rows and nothing else — no battle exists until the host kicks a leg
 * off, which is what lets a whole round be planned in advance without holding
 * open a room per pairing.
 *
 * Kick-off creates an ordinary Battle with the two rosters pre-seated, and
 * from that moment the existing engine owns it: judging, the arena UI, the
 * results screen and the solutions debrief all work unchanged because it is
 * not a special kind of battle, it is a battle that a fixture happens to
 * point at.
 *
 * WHY LEAGUE BATTLES ARE UNRANKED
 * -------------------------------
 * Same reason room-code battles are. The host chooses who plays whom, so a
 * league that moved ladder rating would let two accounts trade wins by
 * scheduling each other. League standings are the league's own record; the
 * global ladder stays something only the matchmaker can move.
 */

/** Retry budget for room-code generation, matching battles.service. */
const ROOM_CODE_RETRIES = 5;

async function uniqueRoomCode(): Promise<string> {
  for (let attempt = 0; attempt < ROOM_CODE_RETRIES; attempt++) {
    const code = generateRoomCode();
    const taken = await prisma.battle.findUnique({
      where: { roomCode: code },
      select: { id: true },
    });
    if (!taken) return code;
  }
  return generateRoomCode(8);
}

/* -------------------------------------------------------------------------- */
/* Scheduling                                                                 */
/* -------------------------------------------------------------------------- */

export async function createFixture(
  userId: string,
  leagueId: string,
  input: CreateFixtureInput,
): Promise<LeagueFixtureView> {
  const league = await requireHost(userId, leagueId);
  // Both terminal states refuse new matches: a league that is over — however
  // it ended — must not grow a fixture that could never be played.
  if (league.status === "FINISHED") {
    throw conflict("LEAGUE_FINISHED", "This league is over.");
  }
  if (league.status === "CANCELLED") {
    throw conflict("LEAGUE_CANCELLED", "This league was called off.");
  }

  if (input.homeTeamId === input.awayTeamId) {
    throw badRequest("A team cannot play itself.");
  }

  const teams = await prisma.leagueTeam.findMany({
    where: { leagueId, id: { in: [input.homeTeamId, input.awayTeamId] } },
    include: { _count: { select: { members: true } } },
  });
  if (teams.length !== 2) {
    throw notFound("Both teams must be in this league.");
  }

  /*
   * Both rosters must be full before a fixture is scheduled.
   *
   * A battle seats exactly MODE_TEAM_SIZE players per side and will not start
   * short. Allowing a half-filled team to be scheduled would produce a
   * fixture that looks ready on the dashboard and then refuses to begin, with
   * the failure surfacing to the players rather than to the host who created
   * it. Better to refuse here, where the person who can fix it is standing.
   */
  const short = teams.filter((t) => t._count.members < league.teamSize);
  if (short.length > 0) {
    throw conflict(
      "TEAM_NOT_FULL",
      `${short.map((t) => t.name).join(" and ")} ${
        short.length === 1 ? "does not have" : "do not have"
      } ${league.teamSize} player${league.teamSize === 1 ? "" : "s"} yet.`,
    );
  }

  // A host-pinned problem must actually be playable. An unapproved or deleted
  // problem would fail at kick-off instead.
  const pinned = input.legs
    .map((l) => l.problemId)
    .filter((id): id is string => typeof id === "string" && id.length > 0);
  if (pinned.length > 0) {
    const found = await prisma.problem.count({
      where: { id: { in: pinned }, status: "APPROVED" },
    });
    if (found !== new Set(pinned).size) {
      throw badRequest("One of those problems is not available.");
    }
  }

  const fixture = await prisma.leagueFixture.create({
    data: {
      leagueId,
      round: input.round,
      homeTeamId: input.homeTeamId,
      awayTeamId: input.awayTeamId,
      timeLimitSec: input.timeLimitSec,
      difficulty: input.difficulty,
      scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
      legs: {
        create: input.legs.map((leg, i) => ({
          ordinal: i + 1,
          problemId: leg.problemId ?? null,
        })),
      },
    },
    include: FIXTURE_INCLUDE,
  });

  /*
   * Tell both rosters.
   *
   * After the fixture exists, not inside its transaction: a notification that
   * fails must never roll back the match it is announcing. `notify` swallows
   * its own errors for the same reason.
   */
  const view = toFixtureView(fixture);
  await notify({
    userIds: await fixtureParticipants(fixture.id),
    kind: "LEAGUE_FIXTURE_SCHEDULED",
    title: `${view.homeTeamName} vs ${view.awayTeamName}`,
    body: `A match has been scheduled in ${league.name}.`,
    link: `/leagues/${leagueId}`,
  });

  return view;
}

/**
 * Edit a scheduled fixture.
 *
 * WHAT CANNOT BE CHANGED, AND WHY
 * -------------------------------
 * The TEAMS. Swapping who is playing after both rosters have been told to
 * turn up is not an edit, it is a different match — the host cancels and
 * schedules that instead, so the people affected are told.
 *
 * A leg that has already been PLAYED. Its battle is a real match with real
 * submissions; rewriting which problem it was supposed to be would make the
 * record disagree with what happened. Played legs are kept exactly as they
 * are and the edit applies only to the unplayed tail.
 *
 * A COMPLETED fixture, at all — the result is settled.
 */
export async function updateFixture(
  userId: string,
  leagueId: string,
  fixtureId: string,
  input: UpdateFixtureInput,
): Promise<LeagueFixtureView> {
  await requireHost(userId, leagueId);

  const fixture = await prisma.leagueFixture.findFirst({
    where: { id: fixtureId, leagueId },
    include: { legs: { orderBy: { ordinal: "asc" } } },
  });
  if (!fixture) throw notFound("Fixture not found.");
  if (fixture.status === "COMPLETED") {
    throw conflict("FIXTURE_COMPLETED", "That match is already decided.");
  }
  if (fixture.status === "CANCELLED") {
    throw conflict("FIXTURE_CANCELLED", "That match was called off.");
  }

  // A pinned problem must still be playable, exactly as at creation.
  const pinned = (input.legs ?? [])
    .map((l) => l.problemId)
    .filter((id): id is string => typeof id === "string" && id.length > 0);
  if (pinned.length > 0) {
    const found = await prisma.problem.count({
      where: { id: { in: pinned }, status: "APPROVED" },
    });
    if (found !== new Set(pinned).size) {
      throw badRequest("One of those problems is not available.");
    }
  }

  const played = fixture.legs.filter((l) => l.battleId !== null);

  await prisma.$transaction(async (tx) => {
    await tx.leagueFixture.update({
      where: { id: fixtureId },
      data: {
        ...(input.timeLimitSec !== undefined && {
          timeLimitSec: input.timeLimitSec,
        }),
        ...(input.difficulty !== undefined && { difficulty: input.difficulty }),
        ...(input.scheduledAt !== undefined && {
          scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
        }),
      },
    });

    if (input.legs) {
      /*
       * The submitted list must be at least as long as what has been played:
       * otherwise the host is asking to delete a match that happened.
       */
      if (input.legs.length < played.length) {
        throw conflict(
          "LEGS_ALREADY_PLAYED",
          `${played.length} problem${played.length === 1 ? " has" : "s have"} already been played, so the match cannot be shortened below that.`,
        );
      }

      // Replace only the unplayed tail; played legs keep their battles.
      await tx.leagueFixtureLeg.deleteMany({
        where: { fixtureId, battleId: null },
      });
      for (let i = played.length; i < input.legs.length; i++) {
        await tx.leagueFixtureLeg.create({
          data: {
            fixtureId,
            ordinal: i + 1,
            problemId: input.legs[i]?.problemId ?? null,
          },
        });
      }
    }
  });

  const fresh = await prisma.leagueFixture.findUniqueOrThrow({
    where: { id: fixtureId },
    include: FIXTURE_INCLUDE,
  });
  return toFixtureView(fresh);
}

/** Call off a fixture. Legs that already played keep their battles. */
export async function cancelFixture(
  userId: string,
  leagueId: string,
  fixtureId: string,
): Promise<void> {
  await requireHost(userId, leagueId);
  const fixture = await prisma.leagueFixture.findFirst({
    where: { id: fixtureId, leagueId },
    select: { id: true, status: true },
  });
  if (!fixture) throw notFound("Fixture not found.");
  if (fixture.status === "COMPLETED") {
    throw conflict(
      "FIXTURE_COMPLETED",
      "That match is already decided and cannot be cancelled.",
    );
  }
  await prisma.leagueFixture.update({
    where: { id: fixtureId },
    data: { status: "CANCELLED" },
  });
}

/* -------------------------------------------------------------------------- */
/* Kick-off                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Start a leg: create its battle with both rosters already seated.
 *
 * Idempotent. A leg that already has a battle returns that battle rather than
 * making a second one — the host clicking twice, or two host tabs, must not
 * produce two rooms for one leg.
 *
 * Seating happens HERE rather than being left to the lobby because the teams
 * are already known. A league match should not require eight people to find
 * the right seat in a room; they open the battle and they are in it.
 */
export async function startLeg(
  userId: string,
  leagueId: string,
  fixtureId: string,
  legId: string,
): Promise<StartLegResponse> {
  const league = await requireHost(userId, leagueId);
  // A called-off league cannot open new battles. Legs already played keep
  // their battles — those are matches people actually fought.
  if (league.status === "CANCELLED") {
    throw conflict("LEAGUE_CANCELLED", "This league was called off.");
  }

  const leg = await prisma.leagueFixtureLeg.findFirst({
    where: { id: legId, fixtureId, fixture: { leagueId } },
    include: {
      battle: { select: { id: true, roomCode: true } },
      fixture: {
        include: {
          homeTeam: { include: { members: { orderBy: { joinedAt: "asc" } } } },
          awayTeam: { include: { members: { orderBy: { joinedAt: "asc" } } } },
        },
      },
    },
  });
  if (!leg) throw notFound("That match leg does not exist.");

  // Already kicked off — hand back the same room.
  if (leg.battle) {
    return { battleId: leg.battle.id, roomCode: leg.battle.roomCode };
  }

  if (leg.fixture.status === "CANCELLED") {
    throw conflict("FIXTURE_CANCELLED", "That match was called off.");
  }
  if (leg.fixture.status === "COMPLETED") {
    throw conflict(
      "FIXTURE_COMPLETED",
      "That match is already decided.",
    );
  }

  /*
   * Legs are played in order.
   *
   * A series is decided by a majority, so leg 3 can be meaningless before
   * leg 2 has been played. Starting out of order would also make the "is this
   * tie decided?" arithmetic depend on which legs happen to exist rather than
   * on the score.
   */
  const earlier = await prisma.leagueFixtureLeg.findFirst({
    where: { fixtureId, ordinal: { lt: leg.ordinal }, battleId: null },
    select: { ordinal: true },
    orderBy: { ordinal: "asc" },
  });
  if (earlier) {
    throw conflict(
      "OUT_OF_ORDER",
      `Play problem ${earlier.ordinal} first.`,
    );
  }

  const mode = TEAM_SIZE_MODE[league.teamSize];
  if (!mode) {
    throw badRequest("This league has an unsupported team size.");
  }

  const home = leg.fixture.homeTeam.members.slice(0, league.teamSize);
  const away = leg.fixture.awayTeam.members.slice(0, league.teamSize);
  if (home.length < league.teamSize || away.length < league.teamSize) {
    throw conflict(
      "TEAM_NOT_FULL",
      "Both teams need a full roster before this can start.",
    );
  }

  const roomCode = await uniqueRoomCode();

  const battle = await prisma.$transaction(async (tx) => {
    const created = await tx.battle.create({
      data: {
        roomCode,
        mode,
        difficulty: leg.fixture.difficulty,
        timeLimitSec: leg.fixture.timeLimitSec,
        seed: `${roomCode}-${Date.now()}`,
        hostUserId: userId,
        status: "LOBBY",
        // Never ranked — see the note at the top of this file.
        isRanked: false,
        // A host-pinned problem rides here; a null means the engine picks at
        // kick-off, which is the "surprise me" case the host asked for.
        assignedProblemId: leg.problemId,
        teams: {
          create: [
            {
              side: "A",
              members: {
                create: home.map((m, i) => ({ userId: m.userId, slot: i })),
              },
            },
            {
              side: "B",
              members: {
                create: away.map((m, i) => ({ userId: m.userId, slot: i })),
              },
            },
          ],
        },
      },
      select: { id: true, roomCode: true },
    });

    await tx.leagueFixtureLeg.update({
      where: { id: legId },
      data: { battleId: created.id },
    });

    // The tie is under way from the first kick-off.
    if (leg.fixture.status === "SCHEDULED") {
      await tx.leagueFixture.update({
        where: { id: fixtureId },
        data: { status: "LIVE" },
      });
    }

    return created;
  });

  /*
   * The most time-critical notification in the product: the room is open NOW
   * and the clock is about to run. Everyone in the match is told, with a link
   * straight into the battle rather than to the league page.
   */
  await notify({
    userIds: await fixtureParticipants(fixtureId),
    kind: "LEAGUE_MATCH_STARTED",
    title: `${leg.fixture.homeTeam.name} vs ${leg.fixture.awayTeam.name} is live`,
    body: "Your match has started — join now.",
    link: `/battle/${battle.id}`,
  });

  return { battleId: battle.id, roomCode: battle.roomCode };
}

/* -------------------------------------------------------------------------- */
/* Settling a tie                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Read every played leg of a fixture and settle the tie if it is decided.
 *
 * Pull rather than push: the battle engine is a separate service that knows
 * nothing about leagues, and teaching it would put league logic on the hot
 * path of every ordinary battle. Instead the league reads the battle results
 * it already owns pointers to, and the dashboard calls this when it loads.
 *
 * Safe to call at any time and as often as you like — it recomputes from the
 * battles and writes only when the answer has changed.
 */
export async function settleFixture(fixtureId: string): Promise<void> {
  const fixture = await prisma.leagueFixture.findUnique({
    where: { id: fixtureId },
    include: {
      legs: {
        include: { battle: { select: { status: true, winnerSide: true } } },
        orderBy: { ordinal: "asc" },
      },
    },
  });
  if (!fixture || fixture.status === "CANCELLED") return;

  let home = 0;
  let away = 0;
  const legWrites: { id: string; winnerTeamId: string | null }[] = [];

  for (const leg of fixture.legs) {
    if (!leg.battle || leg.battle.status !== "FINISHED") continue;
    // Side A is always the home team — see startLeg, which seats them there.
    const winner =
      leg.battle.winnerSide === "A"
        ? fixture.homeTeamId
        : leg.battle.winnerSide === "B"
          ? fixture.awayTeamId
          : null;
    if (winner === fixture.homeTeamId) home += 1;
    if (winner === fixture.awayTeamId) away += 1;
    if (leg.winnerTeamId !== winner) {
      legWrites.push({ id: leg.id, winnerTeamId: winner });
    }
  }

  const total = fixture.legs.length;
  const played = fixture.legs.filter(
    (l) => l.battle?.status === "FINISHED",
  ).length;
  const needed = Math.floor(total / 2) + 1;

  /*
   * The tie is over when one side cannot be caught, or when every leg has
   * been played.
   *
   * The "cannot be caught" half is what makes a best-of-three stop at 2-0
   * rather than demanding a dead third leg. The "all played" half settles an
   * even-length series, which can legitimately end level.
   */
  const decided = home >= needed || away >= needed || played === total;

  const winnerTeamId = !decided
    ? null
    : home > away
      ? fixture.homeTeamId
      : away > home
        ? fixture.awayTeamId
        : null;

  const nextStatus = decided ? "COMPLETED" : played > 0 ? "LIVE" : fixture.status;

  const statusChanged = nextStatus !== fixture.status;
  const winnerChanged = winnerTeamId !== fixture.winnerTeamId;

  if (!statusChanged && !winnerChanged && legWrites.length === 0) return;

  await prisma.$transaction(async (tx) => {
    for (const w of legWrites) {
      await tx.leagueFixtureLeg.update({
        where: { id: w.id },
        data: { winnerTeamId: w.winnerTeamId },
      });
    }
    if (statusChanged || winnerChanged) {
      await tx.leagueFixture.update({
        where: { id: fixtureId },
        data: {
          status: nextStatus,
          winnerTeamId,
          completedAt: decided ? new Date() : null,
        },
      });
    }
  });

  /*
   * Announce the result, but ONLY on the transition into COMPLETED.
   *
   * settleFixture is called on every dashboard read and is deliberately
   * idempotent, so notifying on "this fixture is complete" would re-announce
   * the same result on every page load forever. The guard is that the status
   * actually CHANGED in this call.
   */
  if (decided && nextStatus === "COMPLETED" && statusChanged) {
    const teams = await prisma.leagueFixture.findUnique({
      where: { id: fixtureId },
      select: {
        leagueId: true,
        homeTeam: { select: { id: true, name: true } },
        awayTeam: { select: { id: true, name: true } },
      },
    });
    if (teams) {
      const home = fixture.legs.filter(
        (l) => l.winnerTeamId === fixture.homeTeamId,
      ).length;
      const away = fixture.legs.filter(
        (l) => l.winnerTeamId === fixture.awayTeamId,
      ).length;
      const winnerName =
        winnerTeamId === teams.homeTeam.id
          ? teams.homeTeam.name
          : winnerTeamId === teams.awayTeam.id
            ? teams.awayTeam.name
            : null;
      await notify({
        userIds: await fixtureParticipants(fixtureId),
        kind: "LEAGUE_FIXTURE_RESULT",
        title: winnerName
          ? `${winnerName} won ${home}\u2013${away}`
          : `${teams.homeTeam.name} ${home}\u2013${away} ${teams.awayTeam.name} \u2014 drawn`,
        body: `${teams.homeTeam.name} vs ${teams.awayTeam.name} is decided.`,
        link: `/leagues/${teams.leagueId}`,
      });
    }
  }
}

/** Settle every fixture in a league. Called when the dashboard is read. */
export async function settleLeague(leagueId: string): Promise<void> {
  const live = await prisma.leagueFixture.findMany({
    where: { leagueId, status: { in: ["SCHEDULED", "LIVE"] } },
    select: { id: true },
  });
  for (const f of live) {
    await settleFixture(f.id);
  }
}

/* -------------------------------------------------------------------------- */
/* Problem picker                                                             */
/* -------------------------------------------------------------------------- */

/**
 * The problems a host may pin to a leg.
 *
 * Titles and difficulties only, exactly as the Intel catalogue does, and for
 * the same reason: the host is often also a player, and a picker that showed
 * statements would hand them the questions before the match.
 */
export async function listProblemOptions(): Promise<LeagueProblemOption[]> {
  const rows = await prisma.problem.findMany({
    where: { status: "APPROVED" },
    select: { id: true, title: true, difficulty: true },
    orderBy: [{ difficulty: "asc" }, { title: "asc" }],
  });
  return rows;
}

/* -------------------------------------------------------------------------- */
/* Shaping                                                                    */
/* -------------------------------------------------------------------------- */

const FIXTURE_INCLUDE = {
  homeTeam: { select: { id: true, name: true } },
  awayTeam: { select: { id: true, name: true } },
  legs: {
    include: {
      problem: { select: { id: true, title: true } },
      battle: { select: { id: true, roomCode: true, status: true } },
    },
    orderBy: { ordinal: "asc" },
  },
} as const;

type FixtureRow = {
  id: string;
  // The enum, not a hand-written union: spelling the rounds out here meant a
  // new round (TIEBREAK) failed to compile at every call site instead of
  // simply being supported.
  round: LeagueRound;
  status: "SCHEDULED" | "LIVE" | "COMPLETED" | "CANCELLED";
  homeTeamId: string;
  awayTeamId: string;
  timeLimitSec: number;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  winnerTeamId: string | null;
  scheduledAt: Date | null;
  createdAt: Date;
  homeTeam: { id: string; name: string };
  awayTeam: { id: string; name: string };
  legs: {
    id: string;
    ordinal: number;
    problemId: string | null;
    winnerTeamId: string | null;
    problem: { id: string; title: string } | null;
    battle: { id: string; roomCode: string; status: string } | null;
  }[];
};

/**
 * Shape a fixture for the wire.
 *
 * Exported because the league dashboard builds fixtures in the same query it
 * builds everything else, and re-reading them here would double the work.
 */
export function toFixtureView(fixture: FixtureRow): LeagueFixtureView {
  const legs: LeagueLegView[] = fixture.legs.map((leg) => ({
    id: leg.id,
    ordinal: leg.ordinal,
    problemId: leg.problemId,
    problemTitle: leg.problem?.title ?? null,
    battleId: leg.battle?.id ?? null,
    roomCode: leg.battle?.roomCode ?? null,
    winnerTeamId: leg.winnerTeamId,
    isFinished: leg.battle?.status === "FINISHED",
  }));

  return {
    id: fixture.id,
    round: fixture.round,
    status: fixture.status,
    homeTeamId: fixture.homeTeamId,
    homeTeamName: fixture.homeTeam.name,
    awayTeamId: fixture.awayTeamId,
    awayTeamName: fixture.awayTeam.name,
    timeLimitSec: fixture.timeLimitSec,
    difficulty: fixture.difficulty,
    winnerTeamId: fixture.winnerTeamId,
    legs,
    homeScore: legs.filter((l) => l.winnerTeamId === fixture.homeTeamId).length,
    awayScore: legs.filter((l) => l.winnerTeamId === fixture.awayTeamId).length,
    scheduledAt: fixture.scheduledAt?.toISOString() ?? null,
    createdAt: fixture.createdAt.toISOString(),
  };
}
