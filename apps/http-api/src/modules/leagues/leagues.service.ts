import { prisma } from "@repo/db";
import {
  MAX_LEAGUE_TEAM_SIZE,
  MIN_LEAGUE_TEAM_SIZE,
  normalizeAvatar,
  type CreateLeagueInput,
  type CreateTeamInput,
  type LeagueCard,
  type LeagueDetailResponse,
  type LeagueListResponse,
  type LeagueMemberView,
  type LeagueStatus,
  type LeagueTeamView,
  type LeagueVisibility,
  type UpdateLeagueInput,
} from "@repo/protocol";
import { badRequest, conflict, forbidden, notFound } from "../../http/errors.js";
import { generateRoomCode } from "../../roomCode.js";
import { settleLeague, toFixtureView } from "./fixtures.service.js";

/**
 * Leagues — creation, membership and team formation.
 *
 * WHO IS ALLOWED TO DO WHAT
 * -------------------------
 * Three roles, checked here rather than in the controller so no route can
 * skip one by forgetting a guard:
 *
 *   HOST      — created the league. Edits it, schedules fixtures, kicks off
 *               legs, and is the only one who can delete it.
 *   MEMBER    — plays in a team in it. Reads the dashboard, and manages their
 *               own team if they are its captain.
 *   ANYONE    — may read a PUBLIC league and join it. A PRIVATE league is
 *               invisible without its code.
 *
 * A guest (room-code visitor with no account) cannot create or join anything:
 * a league runs over days and a guest's identity does not survive their token,
 * so a guest on a roster becomes an unreachable empty seat.
 */

/** How many leagues one person may host at once. */
const MAX_HOSTED_LEAGUES = 20;

/** Retry budget for join-code generation. */
const JOIN_CODE_RETRIES = 5;

/** A join code no league is using. */
async function uniqueJoinCode(): Promise<string> {
  for (let attempt = 0; attempt < JOIN_CODE_RETRIES; attempt++) {
    const code = generateRoomCode();
    const taken = await prisma.league.findUnique({
      where: { joinCode: code },
      select: { id: true },
    });
    if (!taken) return code;
  }
  // Five collisions against 31^6 means something is badly wrong; a longer
  // code still beats refusing to create the league.
  return generateRoomCode(8);
}

/** Refuse guests, with a message that says what to do about it. */
async function assertRealAccount(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isGuest: true },
  });
  if (!user) throw notFound("Account not found.");
  if (user.isGuest) {
    throw forbidden(
      "Leagues need a real account — a guest session expires before a league finishes.",
    );
  }
}

/* -------------------------------------------------------------------------- */
/* Creating and editing a league                                              */
/* -------------------------------------------------------------------------- */

export async function createLeague(
  hostUserId: string,
  input: CreateLeagueInput,
): Promise<LeagueCard> {
  await assertRealAccount(hostUserId);

  // Belt and braces: the schema bounds this too, but teamSize decides the
  // battle Mode and an out-of-range value would fail much later, inside a
  // fixture, with a far less obvious message.
  if (
    input.teamSize < MIN_LEAGUE_TEAM_SIZE ||
    input.teamSize > MAX_LEAGUE_TEAM_SIZE
  ) {
    throw badRequest("A team must have between one and four players.");
  }

  const hosted = await prisma.league.count({
    where: { hostUserId, status: { not: "FINISHED" } },
  });
  if (hosted >= MAX_HOSTED_LEAGUES) {
    throw conflict(
      "TOO_MANY_LEAGUES",
      `You are already running ${hosted} leagues. Finish one first.`,
    );
  }

  const league = await prisma.league.create({
    data: {
      name: input.name,
      description: input.description,
      logoUrl: input.logoUrl ?? null,
      visibility: input.visibility,
      teamSize: input.teamSize,
      maxTeams: input.maxTeams ?? null,
      joinCode: await uniqueJoinCode(),
      hostUserId,
      status: "OPEN",
    },
    include: LEAGUE_CARD_INCLUDE,
  });

  return toCard(league, true);
}

export async function updateLeague(
  userId: string,
  leagueId: string,
  input: UpdateLeagueInput,
): Promise<LeagueCard> {
  const league = await requireHost(userId, leagueId);

  // Note what is NOT settable here: teamSize. Teams have already formed
  // against it, so changing it would leave rosters that are over-full or
  // silently incomplete. It is fixed at creation, by design.
  const updated = await prisma.league.update({
    where: { id: league.id },
    data: {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.description !== undefined && {
        description: input.description,
      }),
      ...(input.logoUrl !== undefined && { logoUrl: input.logoUrl }),
      ...(input.visibility !== undefined && { visibility: input.visibility }),
      ...(input.maxTeams !== undefined && { maxTeams: input.maxTeams }),
      // Null clears the rule, turning a knockout back into a plain table.
      ...(input.qualification !== undefined && {
        qualifyMode: input.qualification?.mode ?? null,
        qualifyValue: input.qualification?.value ?? null,
      }),
      ...(input.status !== undefined && {
        status: input.status,
        // Finishing stamps the moment, so the standings have a date.
        // Both terminal states stamp the moment they ended, so a cancelled
        // league can say WHEN it was called off rather than looking live.
        ...((input.status === "FINISHED" || input.status === "CANCELLED") && {
          finishedAt: new Date(),
        }),
        ...(input.status !== "FINISHED" &&
          input.status !== "CANCELLED" && { finishedAt: null }),
      }),
    },
    include: LEAGUE_CARD_INCLUDE,
  });

  return toCard(updated, true);
}

export async function deleteLeague(
  userId: string,
  leagueId: string,
): Promise<void> {
  const league = await requireHost(userId, leagueId);
  // Teams, fixtures and legs cascade. The BATTLES a league produced do not:
  // they are real matches people played, they appear in personal histories,
  // and deleting the league that scheduled them would rewrite those. The leg
  // row is removed, the battle stays.
  await prisma.league.delete({ where: { id: league.id } });
}

/* -------------------------------------------------------------------------- */
/* Reading                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * The leagues page: what anyone can join, and what the caller is already in.
 *
 * PRIVATE leagues never appear in `open`. They surface in `mine` once the
 * caller is actually involved, which is the only way a private league should
 * ever be listed to someone.
 */
export async function listLeagues(
  userId: string | null,
): Promise<LeagueListResponse> {
  /*
   * Every PUBLIC league, in any state — including finished ones.
   *
   * The page filters by status client-side, and a filter that can only ever
   * show an empty list is worse than no filter at all. A finished league is
   * also still worth reading: it holds the final standings, which is the
   * record of a tournament people played in.
   */
  const open = await prisma.league.findMany({
    where: { visibility: "PUBLIC" },
    include: LEAGUE_CARD_INCLUDE,
    // Live leagues first, then the archive, each newest-first. A finished
    // league sinking below the ones you can still join is the right default
    // on a page whose job is to get people INTO a league.
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 100,
  });

  let mine: typeof open = [];
  if (userId) {
    mine = await prisma.league.findMany({
      where: {
        OR: [
          { hostUserId: userId },
          { teams: { some: { members: { some: { userId } } } } },
        ],
      },
      include: LEAGUE_CARD_INCLUDE,
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      take: 100,
    });
  }

  const mineIds = new Set(mine.map((l) => l.id));
  return {
    // A league the caller is already in belongs under "mine", not in the
    // browse list — offering to join something you are in is just noise.
    open: open.filter((l) => !mineIds.has(l.id)).map((l) => toCard(l, false)),
    mine: mine.map((l) => toCard(l, true)),
  };
}

/**
 * One league in full.
 *
 * Readable by anyone for a PUBLIC league; a PRIVATE one is readable only by
 * its host and its members. Somebody who has the code reaches it through
 * `joinLeagueByCode`, which is what turns them into a member.
 */
export async function getLeague(
  userId: string | null,
  leagueId: string,
  opts: { hasCode?: boolean } = {},
): Promise<LeagueDetailResponse> {
  /*
   * Bring the fixtures up to date before reading them.
   *
   * Battles finish in the ws-server, which knows nothing about leagues, so
   * nothing writes a league result at the moment it happens. Settling on read
   * is what closes that gap: by the time anyone looks at the dashboard, every
   * finished battle has been folded into its fixture. It is a no-op when
   * there is nothing new, so the common case costs one indexed query.
   */
  await settleLeague(leagueId);

  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    include: {
      ...LEAGUE_CARD_INCLUDE,
      teams: {
        include: {
          members: {
            include: {
              user: {
                select: {
                  id: true,
                  username: true,
                  avatarId: true,
                  avatarColor: true,
                  imageUrl: true,
                },
              },
            },
            orderBy: { joinedAt: "asc" },
          },
        },
        orderBy: { createdAt: "asc" },
      },
      fixtures: {
        include: {
          homeTeam: { select: { id: true, name: true } },
          awayTeam: { select: { id: true, name: true } },
          legs: {
            include: {
              problem: { select: { id: true, title: true } },
              battle: { select: { id: true, roomCode: true, status: true } },
            },
            orderBy: { ordinal: "asc" },
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!league) throw notFound("League not found.");

  const isHost = userId !== null && league.hostUserId === userId;
  const myTeam = userId
    ? league.teams.find((t) => t.members.some((m) => m.userId === userId))
    : undefined;
  const isMember = Boolean(myTeam);

  if (league.visibility === "PRIVATE" && !isHost && !isMember && !opts.hasCode) {
    // 404 rather than 403: confirming that a private league exists at a
    // guessed id is itself a small leak, and there is nothing useful the
    // caller can do with the distinction.
    throw notFound("League not found.");
  }

  // Fixtures decide the standings, so count them once and reuse.
  const record = new Map<string, { played: number; won: number; lost: number }>();
  for (const team of league.teams) {
    record.set(team.id, { played: 0, won: 0, lost: 0 });
  }
  for (const fx of league.fixtures) {
    if (fx.status !== "COMPLETED") continue;
    for (const teamId of [fx.homeTeamId, fx.awayTeamId]) {
      const row = record.get(teamId);
      if (!row) continue;
      row.played += 1;
      if (fx.winnerTeamId === teamId) row.won += 1;
      else if (fx.winnerTeamId !== null) row.lost += 1;
    }
  }

  const teams: LeagueTeamView[] = league.teams.map((t) => {
    const rec = record.get(t.id) ?? { played: 0, won: 0, lost: 0 };
    return {
      id: t.id,
      name: t.name,
      logoUrl: t.logoUrl,
      captainUserId: t.captainUserId,
      members: t.members.map((m): LeagueMemberView => {
        const avatar = normalizeAvatar(
          m.user.avatarId,
          m.user.avatarColor,
          m.userId,
        );
        return {
          userId: m.userId,
          username: m.user.username,
          avatarId: avatar.avatarId,
          avatarColor: avatar.avatarColor,
          imageUrl: m.user.imageUrl,
          isCaptain: m.userId === t.captainUserId,
        };
      }),
      isFull: t.members.length >= league.teamSize,
      played: rec.played,
      won: rec.won,
      lost: rec.lost,
    };
  });

  return {
    league: toCard(league, isHost || isMember),
    teams,
    fixtures: league.fixtures.map(toFixtureView),
    isHost,
    myTeamId: myTeam?.id ?? null,
  };
}

/**
 * Resolve a join code to a league.
 *
 * This is the ONLY way into a private league, so it is deliberately the only
 * endpoint that accepts a code. It does not enrol anyone by itself — it hands
 * back the league so the client can show it and let them pick or found a
 * team, which is where enrolment actually happens.
 */
export async function findLeagueByCode(
  userId: string | null,
  joinCode: string,
): Promise<LeagueDetailResponse> {
  const league = await prisma.league.findUnique({
    where: { joinCode: joinCode.trim().toUpperCase() },
    select: { id: true },
  });
  if (!league) throw notFound("No league with that code.");

  // Possessing the code IS the grant, so the private-league membership check
  // is skipped here — that check exists to stop someone browsing to a private
  // league they were never given, and this caller was given it.
  return getLeague(userId, league.id, { hasCode: true });
}

/* -------------------------------------------------------------------------- */
/* Teams                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Found a team and captain it.
 *
 * The caller joins their own team immediately — a team with no members is a
 * row nobody can use and the host would have to clean up by hand.
 */
export async function createTeam(
  userId: string,
  leagueId: string,
  input: CreateTeamInput,
): Promise<LeagueTeamView> {
  await assertRealAccount(userId);
  const league = await requireJoinable(userId, leagueId);

  if (league.maxTeams !== null) {
    const count = await prisma.leagueTeam.count({ where: { leagueId } });
    if (count >= league.maxTeams) {
      throw conflict("LEAGUE_FULL", "This league has all the teams it takes.");
    }
  }

  await assertNotAlreadyInATeam(userId, leagueId);

  try {
    const team = await prisma.leagueTeam.create({
      data: {
        leagueId,
        name: input.name,
        logoUrl: input.logoUrl ?? null,
        captainUserId: userId,
        members: { create: [{ userId }] },
      },
      include: TEAM_INCLUDE,
    });
    return toTeamView(team, league.teamSize);
  } catch (err) {
    // @@unique([leagueId, name]) — a duplicate name is a user mistake, not a
    // server fault, so it comes back as a conflict they can act on.
    if (isUniqueViolation(err)) {
      throw conflict(
        "NAME_TAKEN",
        "A team in this league already has that name.",
      );
    }
    throw err;
  }
}

/** Join an existing team, if it has room. */
export async function joinTeam(
  userId: string,
  leagueId: string,
  teamId: string,
): Promise<LeagueTeamView> {
  await assertRealAccount(userId);
  const league = await requireJoinable(userId, leagueId);
  await assertNotAlreadyInATeam(userId, leagueId);

  const team = await prisma.leagueTeam.findFirst({
    where: { id: teamId, leagueId },
    include: TEAM_INCLUDE,
  });
  if (!team) throw notFound("That team is not in this league.");

  if (team.members.length >= league.teamSize) {
    throw conflict(
      "TEAM_FULL",
      `That team already has its ${league.teamSize}.`,
    );
  }

  await prisma.leagueTeamMember.create({ data: { teamId, userId } });

  const fresh = await prisma.leagueTeam.findUniqueOrThrow({
    where: { id: teamId },
    include: TEAM_INCLUDE,
  });
  return toTeamView(fresh, league.teamSize);
}

/**
 * Leave a team, or be removed from it by its captain or the league host.
 *
 * The last member leaving takes the team with them: an empty roster cannot
 * play, and leaving it behind would let it be scheduled into a fixture that
 * can never kick off.
 *
 * A team that has already played is NOT removable this way — its results are
 * part of other teams' records.
 */
export async function leaveTeam(
  actorUserId: string,
  leagueId: string,
  teamId: string,
  targetUserId: string,
): Promise<void> {
  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    select: { id: true, hostUserId: true },
  });
  if (!league) throw notFound("League not found.");

  const team = await prisma.leagueTeam.findFirst({
    where: { id: teamId, leagueId },
    include: { members: true },
  });
  if (!team) throw notFound("That team is not in this league.");

  const isSelf = actorUserId === targetUserId;
  const isCaptain = team.captainUserId === actorUserId;
  const isHost = league.hostUserId === actorUserId;
  if (!isSelf && !isCaptain && !isHost) {
    throw forbidden("Only the captain or the league host can remove a player.");
  }
  if (!team.members.some((m) => m.userId === targetUserId)) {
    throw notFound("That player is not on this team.");
  }

  const playedFixture = await prisma.leagueFixture.findFirst({
    where: {
      leagueId,
      status: { in: ["LIVE", "COMPLETED"] },
      OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }],
    },
    select: { id: true },
  });

  const remaining = team.members.length - 1;

  if (remaining === 0) {
    if (playedFixture) {
      throw conflict(
        "TEAM_HAS_PLAYED",
        "This team has already played a match, so it cannot be disbanded.",
      );
    }
    await prisma.leagueTeam.delete({ where: { id: teamId } });
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.leagueTeamMember.delete({
      where: { teamId_userId: { teamId, userId: targetUserId } },
    });
    // The captain leaving hands the armband to whoever has been there
    // longest, rather than leaving a team nobody can manage.
    if (team.captainUserId === targetUserId) {
      const next = team.members
        .filter((m) => m.userId !== targetUserId)
        .sort((a, b) => a.joinedAt.getTime() - b.joinedAt.getTime())[0];
      if (next) {
        await tx.leagueTeam.update({
          where: { id: teamId },
          data: { captainUserId: next.userId },
        });
      }
    }
  });
}

/* -------------------------------------------------------------------------- */
/* Guards and shaping                                                         */
/* -------------------------------------------------------------------------- */

/** The league, if this user hosts it. Throws otherwise. */
export async function requireHost(userId: string, leagueId: string) {
  const league = await prisma.league.findUnique({ where: { id: leagueId } });
  if (!league) throw notFound("League not found.");
  if (league.hostUserId !== userId) {
    throw forbidden("Only the league host can do that.");
  }
  return league;
}

/** The league, if it is currently accepting teams. */
async function requireJoinable(userId: string, leagueId: string) {
  const league = await prisma.league.findUnique({ where: { id: leagueId } });
  if (!league) throw notFound("League not found.");

  /*
   * An exhaustive switch, not a chain of ifs.
   *
   * OPEN is the ONLY joinable state, and writing it this way means a status
   * added later fails to compile here instead of silently defaulting to
   * "joinable" — which is the direction a mistake must never fall.
   */
  switch (league.status) {
    case "OPEN":
      return league;
    case "DRAFT":
      throw conflict("LEAGUE_NOT_OPEN", "This league is not open yet.");
    case "RUNNING":
      throw conflict(
        "REGISTRATION_CLOSED",
        "The host has closed registration for this league.",
      );
    case "FINISHED":
      throw conflict("LEAGUE_FINISHED", "This league is over.");
    case "CANCELLED":
      throw conflict("LEAGUE_CANCELLED", "This league was called off.");
    default: {
      const unreachable: never = league.status;
      throw conflict("LEAGUE_NOT_OPEN", `Unknown league state: ${unreachable}`);
    }
  }
}

/**
 * One team per player per league.
 *
 * Cannot be a database constraint: uniqueness is over (leagueId, userId) and
 * leagueId lives on the parent team, so Postgres has nothing to index. This
 * is therefore the enforcement point, and every path that adds a member goes
 * through it.
 */
async function assertNotAlreadyInATeam(
  userId: string,
  leagueId: string,
): Promise<void> {
  const existing = await prisma.leagueTeamMember.findFirst({
    where: { userId, team: { leagueId } },
    select: { id: true },
  });
  if (existing) {
    throw conflict(
      "ALREADY_IN_TEAM",
      "You are already on a team in this league.",
    );
  }
}

/** Prisma's unique-constraint error, without importing the error class. */
function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "P2002"
  );
}

const LEAGUE_CARD_INCLUDE = {
  host: { select: { username: true } },
  _count: { select: { teams: true, fixtures: true } },
} as const;

const TEAM_INCLUDE = {
  members: {
    include: {
      user: {
        select: {
          id: true,
          username: true,
          avatarId: true,
          avatarColor: true,
          imageUrl: true,
        },
      },
    },
    orderBy: { joinedAt: "asc" },
  },
} as const;

type LeagueWithCounts = {
  id: string;
  name: string;
  description: string;
  logoUrl: string | null;
  joinCode: string;
  visibility: LeagueVisibility;
  status: LeagueStatus;
  teamSize: number;
  maxTeams: number | null;
  qualifyMode: "TOP_N" | "WIN_COUNT" | null;
  qualifyValue: number | null;
  createdAt: Date;
  host: { username: string };
  _count: { teams: number; fixtures: number };
};

/**
 * Shape a league row for the wire.
 *
 * `revealCode` is the access decision, made by the caller because only it
 * knows whether this person hosts or plays in the league. Defaulting to
 * hiding the code means a new call site leaks nothing by omission.
 */
function toCard(league: LeagueWithCounts, revealCode: boolean): LeagueCard {
  return {
    id: league.id,
    name: league.name,
    description: league.description,
    logoUrl: league.logoUrl,
    visibility: league.visibility,
    status: league.status,
    teamSize: league.teamSize,
    maxTeams: league.maxTeams,
    teamCount: league._count.teams,
    fixtureCount: league._count.fixtures,
    hostName: league.host.username,
    createdAt: league.createdAt.toISOString(),
    qualifyMode: league.qualifyMode,
    qualifyValue: league.qualifyValue,
    joinCode: revealCode ? league.joinCode : null,
  };
}

type TeamWithMembers = {
  id: string;
  name: string;
  logoUrl: string | null;
  captainUserId: string;
  members: {
    userId: string;
    user: {
      username: string;
      avatarId: string | null;
      avatarColor: string | null;
      imageUrl: string | null;
    };
  }[];
};

function toTeamView(team: TeamWithMembers, teamSize: number): LeagueTeamView {
  return {
    id: team.id,
    name: team.name,
    logoUrl: team.logoUrl,
    captainUserId: team.captainUserId,
    members: team.members.map((m): LeagueMemberView => {
      const avatar = normalizeAvatar(
        m.user.avatarId,
        m.user.avatarColor,
        m.userId,
      );
      return {
        userId: m.userId,
        username: m.user.username,
        avatarId: avatar.avatarId,
        avatarColor: avatar.avatarColor,
        imageUrl: m.user.imageUrl,
        isCaptain: m.userId === team.captainUserId,
      };
    }),
    isFull: team.members.length >= teamSize,
    played: 0,
    won: 0,
    lost: 0,
  };
}
