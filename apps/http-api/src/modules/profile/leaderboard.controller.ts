import type { Request, Response } from "express";
import type { LeaderboardEntry, LeaderboardResponse } from "@repo/protocol";
import { prisma } from "@repo/db";
import { verifyBearer } from "../../middleware/auth.js";

const PAGE_SIZE = 25;

/** Shape a User row into a leaderboard entry at a given 1-based rank. */
function toEntry(
  u: {
    id: string;
    displayName: string;
    xp: number;
    wins: number;
    losses: number;
    bestStreak: number;
  },
  rank: number,
): LeaderboardEntry {
  return {
    rank,
    userId: u.id,
    displayName: u.displayName,
    xp: u.xp,
    wins: u.wins,
    losses: u.losses,
    bestStreak: u.bestStreak,
  };
}

/**
 * GET /leaderboard — top operatives by XP.
 *
 * Public by design: XP, W/L and streaks are not secrets, and the results
 * screen already shows them. Auth is optional and only used to locate the
 * caller's own row, so a signed-in user can see their standing even when they
 * fall outside the returned page.
 */
export async function getLeaderboard(
  req: Request,
  res: Response,
): Promise<void> {
  const select = {
    id: true,
    displayName: true,
    xp: true,
    wins: true,
    losses: true,
    bestStreak: true,
  } as const;

  // Ties break by wins, then by name, so ordering is stable between calls.
  const orderBy = [
    { xp: "desc" as const },
    { wins: "desc" as const },
    { displayName: "asc" as const },
  ];

  // Only rank users who have actually played — a wall of 0 XP guests is noise.
  const where = { OR: [{ xp: { gt: 0 } }, { wins: { gt: 0 } }, { losses: { gt: 0 } }] };

  const top = await prisma.user.findMany({
    where,
    select,
    orderBy,
    take: PAGE_SIZE,
  });

  const entries = top.map((u, i) => toEntry(u, i + 1));

  // The caller's own row, if they are signed in.
  let mine: LeaderboardEntry | null = null;
  const claims = await verifyBearer(req.headers.authorization);
  if (claims) {
    const inPage = entries.find((e) => e.userId === claims.userId);
    if (inPage) {
      mine = inPage;
    } else {
      const self = await prisma.user.findUnique({
        where: { id: claims.userId },
        select,
      });
      if (self && (self.xp > 0 || self.wins > 0 || self.losses > 0)) {
        // Rank = how many users sort strictly above them, +1.
        const above = await prisma.user.count({
          where: {
            ...where,
            OR: [
              { xp: { gt: self.xp } },
              { xp: self.xp, wins: { gt: self.wins } },
            ],
          },
        });
        mine = toEntry(self, above + 1);
      }
    }
  }

  const body: LeaderboardResponse = { entries, me: mine };
  res.json(body);
}
