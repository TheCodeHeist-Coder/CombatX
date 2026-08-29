import { SignJWT, jwtVerify } from "jose";

/**
 * Claims carried by a session JWT.
 *
 * `username` is embedded because ws-server seats players straight from the
 * claims — it must not have to hit the database on every connection. It is the
 * battle-facing identity, so a rename re-mints the token (see PATCH /me).
 */
export interface SessionClaims {
  userId: string;
  username: string;
}

const ISSUER = "combateone";
const AUDIENCE = "combateone-web";

function secretKey(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

/** Sign a session token (default 7-day expiry). */
export async function signSessionToken(
  claims: SessionClaims,
  secret: string,
  expiresIn: string = "7d",
): Promise<string> {
  return new SignJWT({ username: claims.username })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(claims.userId)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(secretKey(secret));
}

/** Verify a session token and return its claims. Throws if invalid/expired. */
export async function verifySessionToken(
  token: string,
  secret: string,
): Promise<SessionClaims> {
  const { payload } = await jwtVerify(token, secretKey(secret), {
    issuer: ISSUER,
    audience: AUDIENCE,
  });
  if (!payload.sub || typeof payload.username !== "string") {
    throw new Error("Malformed token claims");
  }
  return { userId: payload.sub, username: payload.username };
}

export { hashPassword, verifyPassword } from "./password.js";

/* --- Admin session -------------------------------------------------------- */

const ADMIN_AUDIENCE = "combateone-admin";

/** Claims carried by a super-admin session JWT. */
export interface AdminClaims {
  userId: string;
  email: string;
}

/**
 * Sign an admin session token.
 *
 * Deliberately a DIFFERENT audience from the player token, and verified with
 * `verifyAdminToken` only. A player's JWT therefore cannot be replayed against
 * an admin endpoint even though both are signed with the same secret — the
 * audience check rejects it before any handler runs.
 *
 * Short-lived by default: an admin session is a standing key to every user's
 * data, so it should expire in hours, not the week a player token gets.
 */
export async function signAdminToken(
  claims: AdminClaims,
  secret: string,
  expiresIn: string = "8h",
): Promise<string> {
  return new SignJWT({ email: claims.email, adm: true })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(claims.userId)
    .setIssuer(ISSUER)
    .setAudience(ADMIN_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(secretKey(secret));
}

/** Verify an admin token. Throws if invalid, expired, or not an admin token. */
export async function verifyAdminToken(
  token: string,
  secret: string,
): Promise<AdminClaims> {
  const { payload } = await jwtVerify(token, secretKey(secret), {
    issuer: ISSUER,
    audience: ADMIN_AUDIENCE,
  });
  if (!payload.sub || typeof payload.email !== "string" || payload.adm !== true) {
    throw new Error("Malformed admin token claims");
  }
  return { userId: payload.sub, email: payload.email };
}
