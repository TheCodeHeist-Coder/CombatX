import type { NextFunction, Request, Response } from "express";
import { verifyGuestToken, type GuestClaims } from "@repo/auth";
import { env } from "../env.js";
import { sendError, unauthorized } from "../http/errors.js";

/** An authenticated request carries the verified guest claims. */
export interface AuthedRequest<
  P = Record<string, string>,
  ResBody = unknown,
  ReqBody = unknown,
> extends Request<P, ResBody, ReqBody> {
  claims: GuestClaims;
}

/** Verify a bearer token without throwing; returns claims or null. */
export async function verifyBearer(
  authHeader: string | undefined,
): Promise<GuestClaims | null> {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice("Bearer ".length);
  try {
    return await verifyGuestToken(token, env.jwtSecret);
  } catch {
    return null;
  }
}

/**
 * Express middleware: require a valid guest token. On success, attaches
 * `req.claims` and calls next(); otherwise responds 401. Downstream handlers
 * cast `req` to AuthedRequest to read the claims.
 */
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const claims = await verifyBearer(req.headers.authorization);
  if (!claims) {
    sendError(res, unauthorized());
    return;
  }
  (req as AuthedRequest).claims = claims;
  next();
}
