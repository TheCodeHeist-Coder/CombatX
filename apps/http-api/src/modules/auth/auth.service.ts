import { prisma } from "@repo/db";
import { hashPassword, signSessionToken, verifyPassword } from "@repo/auth";
import {
  normalizeAvatar,
  type AuthResponse,
  type GuestJoinRequest,
  type GuestJoinResponse,
  type LoginRequest,
  type SignupRequest,
} from "@repo/protocol";
import { randomUUID } from "node:crypto";
import { conflict, notFound, unauthorized } from "../../http/errors.js";
import { env } from "../../env.js";

/** Shape a user row into the auth response, filling in a seeded avatar. */
async function toAuthResponse(user: {
  id: string;
  email: string | null;
  username: string;
  name: string | null;
  isGuest: boolean;
  avatarId: string | null;
  avatarColor: string | null;
  imageUrl: string | null;
}): Promise<AuthResponse> {
  const chosen = normalizeAvatar(user.avatarId, user.avatarColor, user.id);
  const token = await signSessionToken(
    { userId: user.id, username: user.username },
    env.jwtSecret,
  );
  return {
    token,
    userId: user.id,
    username: user.username,
    isGuest: user.isGuest,
    name: user.name,
    email: user.email,
    avatarId: chosen.avatarId,
    avatarColor: chosen.avatarColor,
    imageUrl: user.imageUrl,
  };
}

/** True if the username is free. Case-insensitive, like the unique index. */
export async function isUsernameAvailable(
  username: string,
): Promise<boolean> {
  const existing = await prisma.user.findUnique({
    where: { usernameLower: username.toLowerCase() },
    select: { id: true },
  });
  return !existing;
}

/**
 * The next registration number, for the Pioneer badge.
 *
 * Counted over registered accounts only — guests are throwaway identities and
 * must not consume a founder slot. Deliberately NOT derived from createdAt at
 * read time: an ordinal assigned once is stable, whereas a derived rank would
 * silently shift for everyone if a row were ever restored or backdated.
 *
 * A race between two simultaneous signups can hand out the same number. That
 * is acceptable here: the ordinal decides a cosmetic badge, not an identity,
 * and the alternative (a sequence or a serialisable transaction) is real cost
 * for a tie that is invisible to both users.
 */
async function nextSignupOrdinal(): Promise<number> {
  return (await prisma.user.count({ where: { isGuest: false } })) + 1;
}

/**
 * Create an account.
 *
 * Uniqueness is checked up front for a clean field-level error, but the unique
 * indexes are the real guarantee: two simultaneous signups can both pass the
 * check and only one can win the insert, so P2002 is caught rather than left
 * to surface as a 500.
 */
export async function signup(input: SignupRequest): Promise<AuthResponse> {
  const email = input.email.toLowerCase().trim();
  const usernameLower = input.username.toLowerCase();
  const name = input.name?.trim() || null;

  try {
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: await hashPassword(input.password),
        username: input.username,
        usernameLower,
        name,
        avatarId: input.avatarId ?? null,
        avatarColor: input.avatarColor ?? null,
        signupOrdinal: await nextSignupOrdinal(),
      },
    });
    return await toAuthResponse(user);
  } catch (err) {
    const target = uniqueViolationTarget(err);
    if (target === "email") {
      throw conflict("EMAIL_TAKEN", "That email already has an account.");
    }
    if (target === "usernameLower") {
      throw conflict("USERNAME_TAKEN", "That username is taken.");
    }
    throw err;
  }
}

/**
 * Exchange credentials for a session token.
 *
 * A missing user and a wrong password return the identical error: telling them
 * apart would turn this endpoint into an account-enumeration oracle. The hash
 * is still verified against a dummy when the user is absent so the response
 * time does not leak existence either.
 */
export async function login(input: LoginRequest): Promise<AuthResponse> {
  const user = await prisma.user.findUnique({
    where: { email: input.email.toLowerCase().trim() },
  });

  // A guest row has no passwordHash, so it can never satisfy a login even if
  // someone guesses its (non-unique, non-secret) handle.
  const ok =
    user?.passwordHash != null
      ? await verifyPassword(input.password, user.passwordHash)
      : await verifyPassword(input.password, DUMMY_HASH);

  if (!user || !ok) {
    throw unauthorized("Incorrect email or password.");
  }
  return toAuthResponse(user);
}

/**
 * Create a throwaway identity for someone joining with a room code.
 *
 * The room code is validated FIRST and the whole thing fails if it is not a
 * joinable battle. That check is what keeps this from being an open endpoint
 * for minting unlimited credential-less users: you must already hold a valid
 * code for a battle that has not started.
 *
 * The resulting row is deliberately impoverished — no email, no password, no
 * public profile — so a guest cannot be mistaken for an account anywhere
 * downstream, and cannot log back in once the token lapses.
 */
export async function guestJoin(
  input: GuestJoinRequest,
): Promise<GuestJoinResponse> {
  const roomCode = input.roomCode.toUpperCase();
  const battle = await prisma.battle.findUnique({ where: { roomCode } });
  if (!battle) {
    throw notFound("No battle with that code");
  }
  if (battle.status !== "LOBBY" && battle.status !== "COUNTDOWN") {
    throw conflict("IN_PROGRESS", "Battle already started");
  }

  const user = await prisma.user.create({
    data: {
      username: input.displayName,
      // usernameLower is uniquely indexed, but a guest handle is not meant to
      // be unique — so it gets a suffixed value that will not collide with a
      // real account's slug or with another guest using the same name.
      usernameLower: `guest:${randomUUID()}`,
      isGuest: true,
      isPublic: false,
      avatarId: input.avatarId ?? null,
      avatarColor: input.avatarColor ?? null,
    },
  });

  return {
    auth: await toAuthResponse(user),
    battleId: battle.id,
    roomCode: battle.roomCode,
  };
}

/**
 * A real scrypt hash of a value nobody can supply, compared against when the
 * email is unknown so both branches of login do the same work. See login().
 */
const DUMMY_HASH = await hashPassword(
  "combatx::timing-equalizer::not-a-password",
);

/**
 * The column named by a Prisma P2002 unique violation, if that's what it is.
 *
 * Reads `meta.target` when present, but falls back to parsing the message:
 * the pg driver adapter reports P2002 with only `modelName` and the underlying
 * DriverAdapterError in `meta`, no `target` at all. Relying on `target` alone
 * silently turned every duplicate signup into a 500.
 */
function uniqueViolationTarget(err: unknown): string | null {
  if (typeof err !== "object" || err === null) return null;
  const e = err as {
    code?: string;
    message?: string;
    meta?: { target?: unknown };
  };
  if (e.code !== "P2002") return null;

  const target = e.meta?.target;
  if (Array.isArray(target) && target.length > 0) {
    return stripQuotes(String(target[0]));
  }
  if (typeof target === "string" && target) return stripQuotes(target);

  // e.g.: Unique constraint failed on the fields: (`"usernameLower"`)
  const match = /fields:\s*\(`?"?([A-Za-z0-9_]+)"?`?\)/.exec(e.message ?? "");
  return match?.[1] ?? null;
}

/** Column names arrive variously bare, quoted, or backticked. */
function stripQuotes(value: string): string {
  return value.replace(/[`"]/g, "");
}
