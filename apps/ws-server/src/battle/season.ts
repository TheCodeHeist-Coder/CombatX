/**
 * The running season, as ws-server sees it.
 *
 * Every finished battle stamps its rating-history rows with the season they
 * happened in, so a rating graph can later be drawn per season rather than as
 * one line across a reset — which would show a cliff at every rollover and
 * make the shape meaningless.
 *
 * Cached for the same reason badge rules are: the season changes when an admin
 * presses a button, not when a game event happens, so re-reading it on every
 * battle finish would be a round trip bought for nothing.
 *
 * A null result is normal and must stay harmless. No season has been started
 * on a fresh install, and battles have to keep working — `seasonId` is
 * nullable precisely so history written before seasons existed stays valid.
 */

import { prisma } from "@repo/db";

const TTL_MS = 30_000;

let cache: string | null = null;
let loadedAt = 0;
let inFlight: Promise<string | null> | null = null;

async function load(): Promise<string | null> {
  try {
    const season = await prisma.season.findFirst({
      where: { isActive: true },
      select: { id: true },
      // Newest wins if two were somehow left active; the service refuses to
      // create that state, but a stamped battle should never be ambiguous.
      orderBy: { startedAt: "desc" },
    });
    cache = season?.id ?? null;
    loadedAt = Date.now();
    return cache;
  } catch (err) {
    // A failed lookup must not fail the battle. Stamping is a nice-to-have;
    // the rating change itself is not.
    console.error("[season] lookup failed, stamping as null", err);
    return null;
  }
}

/** The id of the running season, or null when none is running. */
export async function activeSeasonId(): Promise<string | null> {
  if (Date.now() - loadedAt < TTL_MS) return cache;
  inFlight ??= load().finally(() => {
    inFlight = null;
  });
  return inFlight;
}
