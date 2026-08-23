import { prisma } from "@repo/db";
import { signGuestToken } from "@repo/auth";
import {
  normalizeAvatar,
  type AvatarChoice,
  type GuestAuthResponse,
} from "@repo/protocol";
import { env } from "../../env.js";

/**
 * Auth business logic. Creates a guest identity and issues a signed session
 * token. Pure domain logic — no Express types leak in here.
 */
export async function createGuest(
  displayName: string,
  avatar?: Partial<AvatarChoice>,
): Promise<GuestAuthResponse> {
  const user = await prisma.user.create({
    data: {
      displayName,
      avatarId: avatar?.avatarId ?? null,
      avatarColor: avatar?.avatarColor ?? null,
    },
  });

  // A guest who skipped the picker still needs a stable look, so fall back to
  // one seeded from their id rather than leaving the field empty.
  const chosen = normalizeAvatar(user.avatarId, user.avatarColor, user.id);

  const token = await signGuestToken(
    { userId: user.id, displayName: user.displayName },
    env.jwtSecret,
  );

  return {
    token,
    userId: user.id,
    displayName: user.displayName,
    avatarId: chosen.avatarId,
    avatarColor: chosen.avatarColor,
  };
}
