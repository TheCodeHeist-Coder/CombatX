import type { Response } from "express";
import type { ProfileResponse } from "@repo/protocol";
import { prisma } from "@repo/db";
import { notFound } from "../../http/errors.js";
import type { AuthedRequest } from "../../middleware/auth.js";

/**
 * GET /me — the authenticated caller's profile and progression.
 *
 * Reads straight from the User row: progression is written by ws-server when a
 * battle finishes, so this endpoint only reports, it never computes.
 */
export async function getMe(req: AuthedRequest, res: Response): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: req.claims.userId },
    select: {
      id: true,
      displayName: true,
      xp: true,
      wins: true,
      losses: true,
      winStreak: true,
      bestStreak: true,
    },
  });

  if (!user) throw notFound("No such user.");

  const body: ProfileResponse = {
    userId: user.id,
    displayName: user.displayName,
    xp: user.xp,
    wins: user.wins,
    losses: user.losses,
    winStreak: user.winStreak,
    bestStreak: user.bestStreak,
  };

  res.json(body);
}
