import type { Response } from "express";
import {
  normalizeAvatar,
  PROFILE_LINKS,
  UpdateProfileRequest,
  type ProfileResponse,
  type UpdateProfileResponse,
} from "@repo/protocol";
import { prisma } from "@repo/db";
import { signSessionToken } from "@repo/auth";
import { env } from "../../env.js";
import {
  badRequest,
  conflict,
  forbidden,
  notFound,
} from "../../http/errors.js";
import type { AuthedRequest } from "../../middleware/auth.js";

/** Columns every profile projection needs. */
const PROFILE_SELECT = {
  id: true,
  username: true,
  name: true,
  isGuest: true,
  email: true,
  avatarId: true,
  avatarColor: true,
  imageUrl: true,
  isPublic: true,
  bio: true,
  github: true,
  linkedin: true,
  twitter: true,
  codeforces: true,
  leetcode: true,
  codechef: true,
  hackerrank: true,
  website: true,
  xp: true,
  wins: true,
  losses: true,
  winStreak: true,
  bestStreak: true,
} as const;

type ProfileRow = {
  id: string;
  username: string;
  name: string | null;
  isGuest: boolean;
  email: string | null;
  avatarId: string | null;
  avatarColor: string | null;
  imageUrl: string | null;
  isPublic: boolean;
  bio: string | null;
  github: string | null;
  linkedin: string | null;
  twitter: string | null;
  codeforces: string | null;
  leetcode: string | null;
  codechef: string | null;
  hackerrank: string | null;
  website: string | null;
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
    username: user.username,
    name: user.name,
    isGuest: user.isGuest,
    email: user.email,
    avatarId: avatar.avatarId,
    avatarColor: avatar.avatarColor,
    imageUrl: user.imageUrl,
    isPublic: user.isPublic,
    bio: user.bio,
    github: user.github,
    linkedin: user.linkedin,
    twitter: user.twitter,
    codeforces: user.codeforces,
    leetcode: user.leetcode,
    codechef: user.codechef,
    hackerrank: user.hackerrank,
    website: user.website,
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
 * PATCH /me — change your username, name, avatar, photo, or profile.
 *
 * Every field is optional, so a caller can change just their avatar without
 * re-sending anything else. JWTs embed the username and ws-server seats
 * players from those claims, so a rename must re-mint the token; we always
 * return a fresh one and let the client swap its stored session wholesale.
 *
 * Email and password are deliberately NOT editable here — changing either is
 * a credential change that needs its own re-authentication flow.
 */
export async function patchMe(
  req: AuthedRequest,
  res: Response,
): Promise<void> {
  const parsed = UpdateProfileRequest.safeParse(req.body);
  if (!parsed.success) {
    throw badRequest(parsed.error.issues[0]?.message ?? "Invalid input");
  }

  // Guests have no Settings page and no identity worth persisting; refusing
  // here means the UI gate is not the only thing standing between a guest and
  // a username that would collide with a real account's profile slug.
  const me = await prisma.user.findUnique({
    where: { id: req.claims.userId },
    select: { isGuest: true },
  });
  if (me?.isGuest) {
    throw forbidden("Guests cannot edit a profile. Create an account first.");
  }

  const { username, ...rest } = parsed.data;

  // Zod strips unknown keys, so anything still present was genuinely sent —
  // which lets "did they change anything" be a key count rather than a
  // condition that has to grow a clause per field.
  if (Object.keys(parsed.data).length === 0) {
    throw badRequest("Nothing to update.");
  }

  // Text fields treat blank as "clear it", so they map to null rather than
  // being rejected the way a blank username would be.
  const blankToNull = <T extends string | null | undefined>(v: T) =>
    v === undefined ? undefined : ((v?.trim() || null) as string | null);

  try {
    const user = await prisma.user.update({
      where: { id: req.claims.userId },
      // Omitted keys are left untouched by Prisma, which is exactly the
      // partial-update semantics we want here.
      data: {
        ...(username
          ? { username, usernameLower: username.toLowerCase() }
          : {}),
        ...("name" in rest ? { name: blankToNull(rest.name) } : {}),
        ...(rest.avatarId ? { avatarId: rest.avatarId } : {}),
        ...(rest.avatarColor ? { avatarColor: rest.avatarColor } : {}),
        ...("imageUrl" in rest ? { imageUrl: rest.imageUrl ?? null } : {}),
        ...("isPublic" in rest ? { isPublic: rest.isPublic } : {}),
        ...("bio" in rest ? { bio: blankToNull(rest.bio) } : {}),
        // Every external handle behaves identically: blank clears it.
        ...Object.fromEntries(
          PROFILE_LINKS.filter((l) => l.key in rest).map((l) => [
            l.key,
            blankToNull(rest[l.key]),
          ]),
        ),
        ...("website" in rest ? { website: blankToNull(rest.website) } : {}),
      },
      select: PROFILE_SELECT,
    });

    const token = await signSessionToken(
      { userId: user.id, username: user.username },
      env.jwtSecret,
    );

    const body: UpdateProfileResponse = { token, profile: toProfile(user) };
    res.json(body);
  } catch (err) {
    // Same race as signup: the pre-check in the form can pass and the insert
    // still lose to a simultaneous claim on the same handle.
    const e = err as { code?: string; meta?: { target?: unknown } };
    if (e.code === "P2002") {
      throw conflict("USERNAME_TAKEN", "That username is taken.");
    }
    throw err;
  }
}
