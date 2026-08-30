import type { Request, Response } from "express";
import {
  LeaderboardBoard,
  normalizeAvatar,
  type LeaderboardEntry,
  type LeaderboardResponse,
} from "@repo/protocol";
import { prisma } from "@repo/db";
import { PROVISIONAL_RD } from "@repo/game";
import { verifyBearer } from "../../middleware/auth.js";
import {
  BADGE_STAT_SELECT,
  RATING_SELECT,
  toBadgeViews,
  toRatingView,
  topBadges,
} from "../ranking/ranking.view.js";

const PAGE_SIZE = 25;

const SELECT = {
  id: true,
  username: true,
  usernameLower: true,
  name: true,
  avatarId: true,
  avatarColor: true,
  imageUrl: true,
  winStreak: true,
  ...RATING_SELECT,
  ...BADGE_STAT_SELECT,
} as const;

type Row = Awaited<ReturnType<typeof fetchRows>>[number];

async function fetchRows(args: Parameters<typeof prisma.user.findMany>[0]) {
  return prisma.user.findMany({ ...args, select: SELECT });
}

/** Shape a User row into a leaderboard entry at a given 1-based rank. */
function toEntry(u: Row, rank: number, badges: BadgeRows): LeaderboardEntry {
  const avatar = normalizeAvatar(u.avatarId, u.avatarColor, u.id);
  return {
    rank,
    userId: u.id,
    username: u.username,
    name: u.name,
    avatarId: avatar.avatarId,
    avatarColor: avatar.avatarColor,
    imageUrl: u.imageUrl,
    xp: u.xp,
    wins: u.wins,
    losses: u.losses,
    bestStreak: u.bestStreak,
    rating: toRatingView(u),
    badges: topBadges(toBadgeViews(badges.get(u.id) ?? [])),
  };
}

type BadgeRows = Map<string, { badgeKey: string; earnedAt: Date }[]>;

/** Fetch the badges for a page of users in one query. */
async function badgesFor(userIds: string[]): Promise<BadgeRows> {
  if (userIds.length === 0) return new Map();
  const rows = await prisma.userBadge.findMany({
    where: { userId: { in: userIds } },
    select: { userId: true, badgeKey: true, earnedAt: true },
    orderBy: { earnedAt: "desc" },
  });
  const map: BadgeRows = new Map();
  for (const r of rows) {
    const list = map.get(r.userId) ?? [];
    list.push({ badgeKey: r.badgeKey, earnedAt: r.earnedAt });
    map.set(r.userId, list);
  }
  return map;
}

/**
 * GET /leaderboard — the ladder.
 *
 * Two boards, because they answer genuinely different questions:
 *
 *   rating (default)  Skill. Glicko-2, zero-sum, only moves in matchmade
 *                     battles. Provisional players are withheld — a lucky 3-0
 *                     start must not outrank a proven record.
 *   xp                Career volume. Rises only, so a new player can climb it
 *                     by turning up rather than by beating anyone.
 *
 * Public by design: ratings, W/L and streaks are not secrets, and the results
 * screen already shows them. Auth is optional and used only to locate the
 * caller's own row, so a signed-in user can see their standing even when they
 * fall outside the returned page.
 */
export async function getLeaderboard(
  req: Request,
  res: Response,
): Promise<void> {
  const board =
    LeaderboardBoard.safeParse(req.query.board).data ?? "rating";

  /**
   * Only rank real accounts who have played. Guests are excluded outright:
   * they are throwaway identities that cannot be looked up or logged back
   * into, so a guest on the leaderboard is a dead row nobody can click.
   */
  const base = { isGuest: false as const };

  const where =
    board === "rating"
      ? // A placed rating means the deviation has come down far enough to
        // publish. Without this gate the top of the ladder would be whoever
        // most recently got lucky in their first three battles.
        { ...base, ratingRd: { lte: PROVISIONAL_RD }, rankedBattles: { gt: 0 } }
      : {
          ...base,
          OR: [{ xp: { gt: 0 } }, { wins: { gt: 0 } }, { losses: { gt: 0 } }],
        };

  /**
   * Rating sorts on `rating` with `ratingRd` ascending as the tie-break, which
   * approximates the conservative rating (rating - 2*rd) that the tiers use.
   * Sorting on the exact expression would need raw SQL; the gate above already
   * removes the wide-RD rows where the two orderings would actually differ.
   */
  const orderBy =
    board === "rating"
      ? [
          { rating: "desc" as const },
          { ratingRd: "asc" as const },
          { usernameLower: "asc" as const },
        ]
      : [
          { xp: "desc" as const },
          { wins: "desc" as const },
          { usernameLower: "asc" as const },
        ];

  const top = await fetchRows({ where, orderBy, take: PAGE_SIZE });
  const badges = await badgesFor(top.map((u) => u.id));
  const entries = top.map((u, i) => toEntry(u, i + 1, badges));

  // The caller's own row, if they are signed in.
  let mine: LeaderboardEntry | null = null;
  let meProvisional = false;

  const claims = await verifyBearer(req.headers.authorization);
  if (claims) {
    const inPage = entries.find((e) => e.userId === claims.userId);
    if (inPage) {
      mine = inPage;
    } else {
      const self = await prisma.user.findUnique({
        where: { id: claims.userId },
        select: SELECT,
      });

      if (self) {
        const placed =
          board === "rating"
            ? self.ratingRd <= PROVISIONAL_RD && self.rankedBattles > 0
            : self.xp > 0 || self.wins > 0 || self.losses > 0;

        if (placed) {
          // Rank = how many users sort strictly above them, +1.
          const above = await prisma.user.count({
            where:
              board === "rating"
                ? {
                    ...where,
                    OR: [
                      { rating: { gt: self.rating } },
                      { rating: self.rating, ratingRd: { lt: self.ratingRd } },
                    ],
                  }
                : {
                    ...where,
                    OR: [
                      { xp: { gt: self.xp } },
                      { xp: self.xp, wins: { gt: self.wins } },
                    ],
                  },
          });
          const selfBadges = await badgesFor([self.id]);
          mine = toEntry(self, above + 1, selfBadges);
        } else if (board === "rating") {
          // Signed in, but not yet placed. Say so rather than silently
          // omitting them, which reads as a bug.
          meProvisional = true;
        }
      }
    }
  }

  const body: LeaderboardResponse = {
    board,
    entries,
    me: mine,
    meProvisional,
  };
  res.json(body);
}
