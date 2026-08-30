import type { MedalTone } from "./Medal";

/**
 * Rarity -> medal metal.
 *
 * Mirrors the table in apps/web/components/ranking/Badges.tsx so the console's
 * preview shows the same medal the player will see. If one changes, change
 * both — a preview that lies is worse than no preview.
 */
export const RARITY_TONE: Record<string, MedalTone> = {
  COMMON: { base: "#7c8494", rimLight: "#aab2c0", rimDark: "#4a505c" },
  UNCOMMON: { base: "#3fa89e", rimLight: "#7fded4", rimDark: "#1f6b63" },
  RARE: { base: "#3d8fe0", rimLight: "#87c4ff", rimDark: "#1c4f85" },
  LEGENDARY: { base: "#e0632c", rimLight: "#ffb27a", rimDark: "#8a3410" },
};

/** Label colour beneath a medal, per rarity. */
export const RARITY_FG: Record<string, string> = {
  COMMON: "var(--color-ink-dim)",
  UNCOMMON: "#5cc9bd",
  RARE: "#6fb4f5",
  LEGENDARY: "#ff8a5c",
};
