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
