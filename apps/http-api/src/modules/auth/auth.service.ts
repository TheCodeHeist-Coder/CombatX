import { prisma } from "@repo/db";
import { signGuestToken } from "@repo/auth";
import type { GuestAuthResponse } from "@repo/protocol";
import { env } from "../../env.js";

/**
 * Auth business logic. Creates a guest identity and issues a signed session
 * token. Pure domain logic — no Express types leak in here.
 */
export async function createGuest(
  displayName: string,
): Promise<GuestAuthResponse> {
  const user = await prisma.user.create({ data: { displayName } });
  const token = await signGuestToken(
    { userId: user.id, displayName: user.displayName },
    env.jwtSecret,
  );
  return { token, userId: user.id, displayName: user.displayName };
}
