import { SignJWT, jwtVerify } from "jose";

/** Claims carried by a guest session JWT. */
export interface GuestClaims {
  userId: string;
  displayName: string;
}

const ISSUER = "combateone";
const AUDIENCE = "combateone-web";

function secretKey(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

/** Sign a guest session token (default 7-day expiry). */
export async function signGuestToken(
  claims: GuestClaims,
  secret: string,
  expiresIn: string = "7d",
): Promise<string> {
  return new SignJWT({ displayName: claims.displayName })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(claims.userId)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(secretKey(secret));
}

/** Verify a guest token and return its claims. Throws if invalid/expired. */
export async function verifyGuestToken(
  token: string,
  secret: string,
): Promise<GuestClaims> {
  const { payload } = await jwtVerify(token, secretKey(secret), {
    issuer: ISSUER,
    audience: AUDIENCE,
  });
  if (!payload.sub || typeof payload.displayName !== "string") {
    throw new Error("Malformed token claims");
  }
  return { userId: payload.sub, displayName: payload.displayName };
}
