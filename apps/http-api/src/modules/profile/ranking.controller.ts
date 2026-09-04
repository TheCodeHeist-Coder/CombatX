import type { Request, Response } from "express";
import type {
  BadgeShelfResponse,
  RatingHistoryResponse,
} from "@repo/protocol";
import { prisma } from "@repo/db";
import { notFound } from "../../http/errors.js";
import { verifyBearer } from "../../middleware/auth.js";
import {
  BADGE_STAT_SELECT,
  RATING_SELECT,
  toBadgeShelf,
  toRuleContext,
} from "../ranking/ranking.view.js";
import { listRules } from "../ranking/badgeRules.service.js";

/** How many rating points a graph gets. Enough for a season's shape. */
const HISTORY_LIMIT = 100;

const SHELF_SELECT = {
  id: true,
  isGuest: true,
  isPublic: true,
  ...RATING_SELECT,
  ...BADGE_STAT_SELECT,
} as const;

/**
 * GET /users/:username/badges — the full shelf, earned and locked.
 *
 * Public, subject to the same visibility rule as the profile itself: badges
 * are part of a profile, so a private one keeps them private. Locked badges
 * are included deliberately — showing what is still out there is most of what
 * makes a badge system motivating rather than decorative.
 */
export async function getBadgeShelf(
  req: Request,
  res: Response,
): Promise<void> {
  const username = String(req.params.username ?? "").toLowerCase();
  const user = await prisma.user.findUnique({
    where: { usernameLower: username },
    select: SHELF_SELECT,
  });

  if (!user || user.isGuest) throw notFound("No such user.");

  if (!user.isPublic) {
    const claims = await verifyBearer(req.headers.authorization);
    if (claims?.userId !== user.id) throw notFound("No such user.");
  }

  const held = await prisma.userBadge.findMany({
    where: { userId: user.id },
    select: { badgeKey: true, earnedAt: true, count: true },
  });

  // Read the admin-editable rules, so a badge retuned in the console shows
  // its new threshold and progress here immediately.
  const rules = await listRules();

  const body: BadgeShelfResponse = {
    badges: toBadgeShelf(rules, toRuleContext(user), held),
  };
  res.json(body);
}

/**
 * GET /users/:username/rating-history — points for the rating graph.
 *
 * Oldest first, so a client can plot it without reversing. Only ranked
 * battles produce rows, so this is exactly the set of battles that moved the
 * number — which is what makes it a usable answer to "why is my rating this?".
 */
export async function getRatingHistory(
  req: Request,
  res: Response,
): Promise<void> {
  const username = String(req.params.username ?? "").toLowerCase();
  const user = await prisma.user.findUnique({
    where: { usernameLower: username },
    select: { id: true, isGuest: true, isPublic: true },
  });

  if (!user || user.isGuest) throw notFound("No such user.");

  if (!user.isPublic) {
    const claims = await verifyBearer(req.headers.authorization);
    if (claims?.userId !== user.id) throw notFound("No such user.");
  }

  // Newest-first in the query so the LIMIT keeps the most recent window,
  // then reversed for plotting.
  const rows = await prisma.ratingHistory.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: HISTORY_LIMIT,
    select: {
      battleId: true,
      ratingBefore: true,
      ratingAfter: true,
      delta: true,
      score: true,
      opponentRating: true,
      createdAt: true,
    },
  });

  const body: RatingHistoryResponse = {
    points: rows.reverse().map((r) => ({
      battleId: r.battleId,
      ratingBefore: Math.round(r.ratingBefore),
      ratingAfter: Math.round(r.ratingAfter),
      delta: Math.round(r.delta),
      score: r.score,
      opponentRating:
        r.opponentRating === null ? null : Math.round(r.opponentRating),
      at: r.createdAt.toISOString(),
    })),
  };
  res.json(body);
}
