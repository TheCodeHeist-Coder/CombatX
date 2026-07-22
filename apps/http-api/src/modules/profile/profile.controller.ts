import type { Response } from "express";
import {
  UpdateProfileRequest,
  type ProfileResponse,
  type UpdateProfileResponse,
} from "@repo/protocol";
import { prisma } from "@repo/db";
import { signGuestToken } from "@repo/auth";
import { env } from "../../env.js";
import { badRequest, notFound } from "../../http/errors.js";
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

/**
 * PATCH /me — change your display name.
 *
 * Guest JWTs embed displayName and ws-server seats players from those claims,
 * so a rename must re-mint the token. We return both the new token and the
 * updated profile; the client swaps its stored session for them.
 */
export async function patchMe(
  req: AuthedRequest,
  res: Response,
): Promise<void> {
  const parsed = UpdateProfileRequest.safeParse(req.body);
  if (!parsed.success) {
    throw badRequest("Display name must be 1-24 characters.");
  }
  const displayName = parsed.data.displayName.trim();
  if (!displayName) throw badRequest("Display name cannot be blank.");

  const user = await prisma.user.update({
    where: { id: req.claims.userId },
    data: { displayName },
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

  const profile: ProfileResponse = {
    userId: user.id,
    displayName: user.displayName,
    xp: user.xp,
    wins: user.wins,
    losses: user.losses,
    winStreak: user.winStreak,
    bestStreak: user.bestStreak,
  };

  const token = await signGuestToken(
    { userId: user.id, displayName: user.displayName },
    env.jwtSecret,
  );

  const body: UpdateProfileResponse = { token, profile };
  res.json(body);
}
