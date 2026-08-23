import { z } from "zod";

/**
 * The pixel-art avatar catalogue.
 *
 * Both the client (to draw the picker) and the server (to validate what gets
 * stored) need the same list, so it lives in the protocol package rather than
 * in the web app. Ids are stable strings — never re-order or re-key them, or
 * existing users' saved avatars would silently point at a different character.
 *
 * The artwork itself is drawn client-side from `packages/../PIXEL_ART` sprite
 * maps; this module only owns the identifiers and the palette.
 */

export const AVATAR_IDS = [
  "flame",
  "parrot",
  "ghost",
  "agent",
  "pizza",
  "banana",
  "crystal",
  "mushroom",
  "mask",
  "penguin",
  "frog",
  "bunny",
  "bear",
  "squid",
  "roll",
  "shades",
  "rocket",
  "bolt",
  "blob",
  "dino",
  "skull",
  "chick",
  "crab",
  "spectre",
] as const;

export const AvatarId = z.enum(AVATAR_IDS);
export type AvatarId = z.infer<typeof AvatarId>;

/** The eight selectable avatar background colours, in picker order. */
export const AVATAR_COLORS = [
  "#2f6fd0", // blue
  "#5b4bc4", // indigo
  "#2e8b6b", // green
  "#3f4655", // slate
  "#c0392b", // red
  "#e08a2a", // orange
  "#d9c9a8", // sand
  "#1c1f27", // near-black
] as const;

export const AvatarColor = z.enum(AVATAR_COLORS);
export type AvatarColor = z.infer<typeof AvatarColor>;

/** What a player picked. Both fields are always present once chosen. */
export const AvatarChoice = z.object({
  avatarId: AvatarId,
  avatarColor: AvatarColor,
});
export type AvatarChoice = z.infer<typeof AvatarChoice>;

export const DEFAULT_AVATAR: AvatarChoice = {
  avatarId: "frog",
  avatarColor: "#2f6fd0",
};

/**
 * Deterministic avatar for a user who has not picked one.
 *
 * Seeded by user id so an un-chosen avatar is at least *stable* — the same
 * player looks the same to everyone, and across reloads, without a write.
 */
export function avatarForSeed(seed: string): AvatarChoice {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const n = Math.abs(h);
  return {
    avatarId: AVATAR_IDS[n % AVATAR_IDS.length]!,
    avatarColor: AVATAR_COLORS[(n >>> 8) % AVATAR_COLORS.length]!,
  };
}

/**
 * Coerce possibly-stale stored values into a valid choice.
 *
 * Stored avatars come from the database, where an older release may have
 * written an id this build no longer knows. Falling back to the seeded default
 * keeps the UI rendering instead of throwing on an unknown key.
 */
export function normalizeAvatar(
  avatarId: string | null | undefined,
  avatarColor: string | null | undefined,
  seed: string,
): AvatarChoice {
  const fallback = avatarForSeed(seed);
  const id = AvatarId.safeParse(avatarId);
  const color = AvatarColor.safeParse(avatarColor);
  return {
    avatarId: id.success ? id.data : fallback.avatarId,
    avatarColor: color.success ? color.data : fallback.avatarColor,
  };
}
