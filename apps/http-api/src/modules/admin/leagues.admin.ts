import { prisma } from "@repo/db";
import type { AdminLeagueRow, AdminLeaguesResponse } from "@repo/protocol";
import { notFound } from "../../http/errors.js";

/**
 * Admin oversight of leagues.
 *
 * WHAT AN ADMIN CAN AND CANNOT DO
 * -------------------------------
 * See everything, including private leagues, and delete one. What they
 * deliberately CANNOT do is run somebody else's league — no scheduling, no
 * drawing rounds, no editing results. A league belongs to its host, and an
 * admin quietly changing a fixture would be indistinguishable to the players
 * from the host doing it.
 *
 * So this is moderation, not co-hosting: the lever is removal of something
 * abusive, not adjustment of something disagreeable.
 */

export async function listLeaguesForAdmin(
  limit = 100,
): Promise<AdminLeaguesResponse> {
  const rows = await prisma.league.findMany({
    include: {
      host: { select: { username: true } },
      _count: { select: { teams: true, fixtures: true } },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  const items: AdminLeagueRow[] = rows.map((l) => ({
    id: l.id,
    name: l.name,
    status: l.status,
    visibility: l.visibility,
    teamSize: l.teamSize,
    teamCount: l._count.teams,
    fixtureCount: l._count.fixtures,
    hostName: l.host.username,
    joinCode: l.joinCode,
    createdAt: l.createdAt.toISOString(),
  }));

  return { items, total: await prisma.league.count() };
}

/**
 * Remove a league entirely.
 *
 * Teams, fixtures and legs cascade. The BATTLES it produced do not: they are
 * real matches people played, they appear in personal histories, and deleting
 * the league that scheduled them would rewrite those records. The same
 * reasoning as a host deleting their own league.
 */
export async function deleteLeagueAsAdmin(leagueId: string): Promise<void> {
  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    select: { id: true },
  });
  if (!league) throw notFound("League not found.");
  await prisma.league.delete({ where: { id: leagueId } });
}
