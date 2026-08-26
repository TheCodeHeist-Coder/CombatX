import type { Request, Response } from "express";
import { prisma } from "@repo/db";
import {
  normalizeAvatar,
  type PublicProfileResponse,
} from "@repo/protocol";
import { notFound } from "../../http/errors.js";
import { verifyBearer } from "../../middleware/auth.js";

/**
 * GET /users/:username — another player's profile.
 *
 * The privacy check is the whole security boundary here. A private profile
 * answers 404 rather than 403: a "forbidden" would confirm the account exists,
 * which turns this endpoint into a way to enumerate who has registered. As far
 * as a stranger can tell, a private profile and a nonexistent one are the same.
 *
 * You can always read your OWN profile through this route even while private,
 * so the "view my public page" link in settings shows you what you have.
 *
 * Auth is optional: public profiles are readable signed-out, and the token is
 * only consulted to spot the self case.
 */
export async function getPublicProfile(
  req: Request<{ username: string }>,
  res: Response,
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { usernameLower: req.params.username.toLowerCase() },
    select: {
      id: true,
      username: true,
      name: true,
      avatarId: true,
      avatarColor: true,
      imageUrl: true,
      isPublic: true,
      isGuest: true,
      bio: true,
      github: true,
      linkedin: true,
      twitter: true,
      codeforces: true,
      leetcode: true,
      codechef: true,
      hackerrank: true,
      website: true,
      createdAt: true,
      xp: true,
      wins: true,
      losses: true,
      winStreak: true,
      bestStreak: true,
    },
  });

  if (!user) throw notFound("No such user.");

  // A guest has no profile to show and never opted into one; treat the URL as
  // nonexistent rather than rendering an empty page for a throwaway identity.
  if (user.isGuest) throw notFound("No such user.");

  if (!user.isPublic) {
    const claims = await verifyBearer(req.headers.authorization);
    if (claims?.userId !== user.id) {
      throw notFound("No such user.");
    }
  }

  const avatar = normalizeAvatar(user.avatarId, user.avatarColor, user.id);
  const body: PublicProfileResponse = {
    userId: user.id,
    username: user.username,
    name: user.name,
    avatarId: avatar.avatarId,
    avatarColor: avatar.avatarColor,
    imageUrl: user.imageUrl,
    bio: user.bio,
    github: user.github,
    linkedin: user.linkedin,
    twitter: user.twitter,
    codeforces: user.codeforces,
    leetcode: user.leetcode,
    codechef: user.codechef,
    hackerrank: user.hackerrank,
    website: user.website,
    joinedAt: user.createdAt.toISOString(),
    xp: user.xp,
    wins: user.wins,
    losses: user.losses,
    winStreak: user.winStreak,
    bestStreak: user.bestStreak,
  };
  res.json(body);
}
