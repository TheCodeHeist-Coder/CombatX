import type { Response } from "express";
import {
  normalizeAvatar,
  UpdateProfileRequest,
  type ProfileResponse,
  type UpdateProfileResponse,
} from "@repo/protocol";
import { prisma } from "@repo/db";
import { signGuestToken } from "@repo/auth";
import { env } from "../../env.js";
import { badRequest, notFound } from "../../http/errors.js";
import type { AuthedRequest } from "../../middleware/auth.js";

/** Columns every profile projection needs. */
const PROFILE_SELECT = {
  id: true,
  displayName: true,
  avatarId: true,
  avatarColor: true,
  xp: true,
  wins: true,
  losses: true,
  winStreak: true,
  bestStreak: true,
} as const;

type ProfileRow = {
  id: string;
  displayName: string;
  avatarId: string | null;
  avatarColor: string | null;
  xp: number;
  wins: number;
  losses: number;
  winStreak: number;
  bestStreak: number;
};

function toProfile(user: ProfileRow): ProfileResponse {
  const avatar = normalizeAvatar(user.avatarId, user.avatarColor, user.id);
  return {
    userId: user.id,
    displayName: user.displayName,
    avatarId: avatar.avatarId,
    avatarColor: avatar.avatarColor,
    xp: user.xp,
    wins: user.wins,
    losses: user.losses,
    winStreak: user.winStreak,
    bestStreak: user.bestStreak,
  };
}

/**
 * GET /me — the authenticated caller's profile and progression.
 *
 * Reads straight from the User row: progression is written by ws-server when a
 * battle finishes, so this endpoint only reports, it never computes.
 */
export async function getMe(req: AuthedRequest, res: Response): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: req.claims.userId },
    select: PROFILE_SELECT,
  });

  if (!user) throw notFound("No such user.");

  res.json(toProfile(user));
}

/**
 * PATCH /me — change your display name and/or avatar.
 *
 * Every field is optional, so a caller can change just their avatar without
 * re-sending their name. Guest JWTs embed displayName and ws-server seats
 * players from those claims, so a rename must re-mint the token; we always
 * return a fresh one and let the client swap its stored session wholesale.
 */
export async function patchMe(
  req: AuthedRequest,
  res: Response,
): Promise<void> {
  const parsed = UpdateProfileRequest.safeParse(req.body);
  if (!parsed.success) {
    throw badRequest("Display name must be 1-24 characters.");
  }

  const displayName = parsed.data.displayName?.trim();
  if (displayName !== undefined && !displayName) {
    throw badRequest("Display name cannot be blank.");
  }

  const { avatarId, avatarColor } = parsed.data;
  if (displayName === undefined && !avatarId && !avatarColor) {
    throw badRequest("Nothing to update.");
  }

  const user = await prisma.user.update({
    where: { id: req.claims.userId },
    // Omitted keys are left untouched by Prisma, which is exactly the
    // partial-update semantics we want here.
    data: {
      ...(displayName !== undefined ? { displayName } : {}),
      ...(avatarId ? { avatarId } : {}),
      ...(avatarColor ? { avatarColor } : {}),
    },
    select: PROFILE_SELECT,
  });

  const token = await signGuestToken(
    { userId: user.id, displayName: user.displayName },
    env.jwtSecret,
  );

  const body: UpdateProfileResponse = { token, profile: toProfile(user) };
  res.json(body);
}
