import { prisma } from "@repo/db";
import { hashPassword, signSessionToken, verifyPassword } from "@repo/auth";
import {
  normalizeAvatar,
  type AuthResponse,
  type LoginRequest,
  type SignupRequest,
} from "@repo/protocol";
import { conflict, unauthorized } from "../../http/errors.js";
import { env } from "../../env.js";

/** Shape a user row into the auth response, filling in a seeded avatar. */
async function toAuthResponse(user: {
  id: string;
  email: string;
  username: string;
  name: string | null;
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

  const ok = user
    ? await verifyPassword(input.password, user.passwordHash)
    : await verifyPassword(input.password, DUMMY_HASH);

  if (!user || !ok) {
    throw unauthorized("Incorrect email or password.");
  }
  return toAuthResponse(user);
}

/**
 * A real scrypt hash of a value nobody can supply, compared against when the
 * email is unknown so both branches of login do the same work. See login().
 */
const DUMMY_HASH = await hashPassword(
  "combatx::timing-equalizer::not-a-password",
);

/** The column named by a Prisma P2002 unique violation, if that's what it is. */
function uniqueViolationTarget(err: unknown): string | null {
  if (typeof err !== "object" || err === null) return null;
  const e = err as { code?: string; meta?: { target?: unknown } };
  if (e.code !== "P2002") return null;
  const target = e.meta?.target;
  if (Array.isArray(target)) return String(target[0] ?? "");
  return typeof target === "string" ? target : null;
}
