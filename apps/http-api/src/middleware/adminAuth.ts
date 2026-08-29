import type { NextFunction, Request, Response } from "express";
import { prisma } from "@repo/db";
import { verifyAdminToken, type AdminClaims } from "@repo/auth";
import { env } from "../env.js";
import { sendError, unauthorized } from "../http/errors.js";

/** An admin request carries the verified admin claims. */
export interface AdminRequest<
  P = Record<string, string>,
  ResBody = unknown,
  ReqBody = unknown,
> extends Request<P, ResBody, ReqBody> {
  admin: AdminClaims;
}

/**
 * Require a valid super-admin session.
 *
 * Two gates, deliberately:
 *
 *  1. The token must verify against the ADMIN audience, so a player's JWT is
 *     rejected outright even though both are signed with the same secret.
 *  2. The user row is re-read and its role re-checked on EVERY request. A
 *     token alone is not enough — demoting someone in the database revokes
 *     their access immediately rather than whenever their token happens to
 *     expire.
 *
 * The second check costs one indexed lookup per admin request, which is
 * nothing at admin traffic volumes and is the difference between "revocable"
 * and "valid for eight hours no matter what".
 */
export async function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    sendError(res, unauthorized("Admin login required"));
    return;
  }

  let claims: AdminClaims;
  try {
    claims = await verifyAdminToken(header.slice("Bearer ".length), env.jwtSecret);
  } catch {
    sendError(res, unauthorized("Admin login required"));
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: claims.userId },
    select: { role: true },
  });
  if (user?.role !== "SUPER_ADMIN") {
    sendError(res, unauthorized("Admin login required"));
    return;
  }

  (req as AdminRequest).admin = claims;
  next();
}
