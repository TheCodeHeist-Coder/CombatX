import { MODE_TEAM_SIZE, type Mode, type Side } from "@repo/protocol";

export interface LobbyPlayer {
  userId: string;
  side: Side | null;
  slot: number | null;
  ready: boolean;
}

/** Slots per side for the mode. */
export function teamSize(mode: Mode): number {
  return MODE_TEAM_SIZE[mode];
}

/** Is (side, slot) a valid, currently-free seat for this mode? */
export function isSlotAvailable(
  players: LobbyPlayer[],
  mode: Mode,
  side: Side,
  slot: number,
  forUserId: string,
): boolean {
  if (slot < 0 || slot >= teamSize(mode)) return false;
  return !players.some(
    (p) => p.userId !== forUserId && p.side === side && p.slot === slot,
  );
}

/** Count players seated on a side. */
export function sideCount(players: LobbyPlayer[], side: Side): number {
  return players.filter((p) => p.side === side && p.slot !== null).length;
}

/**
 * A battle can start only when: both sides have at least one seated player,
 * the two sides have EQUAL size (fairness), and every seated player is ready.
 */
export function canStart(players: LobbyPlayer[]): boolean {
  const seated = players.filter((p) => p.side !== null && p.slot !== null);
  const a = seated.filter((p) => p.side === "A");
  const b = seated.filter((p) => p.side === "B");
  if (a.length === 0 || b.length === 0) return false;
  if (a.length !== b.length) return false;
  return seated.every((p) => p.ready);
}

/** Reason a battle cannot start, or null if it can. Useful for UI/error text. */
export function startBlockedReason(players: LobbyPlayer[]): string | null {
  const seated = players.filter((p) => p.side !== null && p.slot !== null);
  const a = seated.filter((p) => p.side === "A").length;
  const b = seated.filter((p) => p.side === "B").length;
  if (a === 0 || b === 0) return "Both sides need at least one player.";
  if (a !== b) return "Teams must be equal size.";
  if (!seated.every((p) => p.ready)) return "All players must be ready.";
  return null;
}
