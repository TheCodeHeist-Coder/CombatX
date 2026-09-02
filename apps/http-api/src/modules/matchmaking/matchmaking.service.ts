/**
 * Ranked matchmaking.
 *
 * This is the structural half of the fairness design, and the more important
 * half. A rating formula can be perfect and still be worthless if players pick
 * their own opponents: two accounts in a private room can trade wins forever.
 *
 * So rating only moves in battles the SERVER paired. Room-code battles stay
 * exactly as they were — social, unranked, and useful for playing with a
 * friend — while the ladder is fed only by pairings nobody chose.
 *
 * The queue is a table rather than in-memory state because http-api may run
 * more than one instance, and a queue that lives in one process would pair
 * players only with whoever happened to hit the same node.
 */

import { prisma } from "@repo/db";
import type { Difficulty, QueueStatusResponse } from "@repo/protocol";
import { conflict } from "../../http/errors.js";
import { generateRoomCode } from "../../roomCode.js";

/**
 * How far apart two ratings may be, in points, and still be paired.
 *
 * The band is SYMMETRIC: a 1100-rated player meets roughly 850-1350. Centring
 * it matters more than its width. An uneven band — narrow below, wide above —
 * would make the average player the underdog in most of their matches, and
 * since rating is zero-sum that pushes the middle of the ladder steadily
 * downward for no reason anyone could see.
 *
 * It opens at ±250 immediately rather than starting tight and creeping there:
 * a queue this size has no spare density to be fussy with.
 *
 * It still widens with waiting time, because a player at an extreme rating
 * would otherwise wait forever for a mirror that may not exist. The cap is
 * ±450: beyond that a match stops being competitive, and Glicko-2 already pays
 * almost nothing for beating someone far weaker, so a lopsided pairing wastes
 * both players' time.
 *
 * The trade-off is explicit: with a cap this tight, a player at the very top
 * or bottom of the ladder can sit in the queue indefinitely when nobody near
 * them is online. That is the right failure — waiting is recoverable, a
 * meaningless match is not.
 */
const BASE_TOLERANCE = 250;
const TOLERANCE_PER_SEC = 4;
const MAX_TOLERANCE = 450;

/** Default battle length for a ranked match, in seconds. */
const RANKED_TIME_LIMIT_SEC = 900;

/** A queue entry older than this is stale — its client has gone. */
const STALE_AFTER_MS = 5 * 60_000;

function toleranceFor(waitedSec: number): number {
  return Math.min(MAX_TOLERANCE, BASE_TOLERANCE + waitedSec * TOLERANCE_PER_SEC);
}

/**
 * Join the ranked queue, or return the existing entry.
 *
 * Attempts a pairing immediately: with two players waiting, the second to
 * arrive is matched on their own request rather than waiting for a background
 * sweep, so a match is instant whenever one is possible.
 */
export async function joinQueue(
  userId: string,
  difficulty: Difficulty,
): Promise<QueueStatusResponse> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, isGuest: true, rating: true },
  });

  if (!user) throw conflict("NO_USER", "Account not found.");

  /**
   * Guests cannot queue. They have no credentials, cannot be looked up, and
   * their rating would vanish with their token — so a guest in the ranked
   * pool is an opponent whose record can never be held against them, which is
   * exactly the account a farmer would want.
   */
  if (user.isGuest) {
    throw conflict(
      "GUEST_NOT_RANKED",
      "Ranked battles need a registered account.",
    );
  }

  await clearStale();

  // Already waiting? Re-running the search is still worthwhile: an opponent
  // may have arrived since.
  const existing = await prisma.matchQueueEntry.findUnique({
    where: { userId },
  });

  if (!existing) {
    await prisma.matchQueueEntry.create({
      data: { userId, rating: user.rating, difficulty, mode: "ONE_V_ONE" },
    });
  } else if (existing.difficulty !== difficulty) {
    await prisma.matchQueueEntry.update({
      where: { userId },
      data: { difficulty, rating: user.rating, enqueuedAt: new Date() },
    });
  }

  const matched = await tryPair(userId);
  if (matched) return matched;

  return status(userId);
}

/** Leave the queue. Idempotent — leaving twice is not an error. */
export async function leaveQueue(userId: string): Promise<void> {
  await prisma.matchQueueEntry.deleteMany({ where: { userId } });
}

/**
 * Where the caller stands.
 *
 * Also attempts a pairing, so a client that is polling gets matched even when
 * the opponent who could pair with them joined while this client was idle.
 */
export async function status(userId: string): Promise<QueueStatusResponse> {
  const matched = await tryPair(userId);
  if (matched) return matched;

  const entry = await prisma.matchQueueEntry.findUnique({ where: { userId } });
  const queueSize = await prisma.matchQueueEntry.count();

  if (!entry) {
    return {
      queued: false,
      waitingSec: 0,
      difficulty: null,
      queueSize,
      matchedBattleId: null,
      matchedRoomCode: null,
    };
  }

  return {
    queued: true,
    waitingSec: Math.max(
      0,
      Math.floor((Date.now() - entry.enqueuedAt.getTime()) / 1000),
    ),
    difficulty: entry.difficulty,
    queueSize,
    matchedBattleId: null,
    matchedRoomCode: null,
  };
}

/**
 * Try to pair this user with someone else waiting.
 *
 * Returns the match when one is made, or null when nobody suitable is waiting.
 * Both entries are consumed inside a transaction with a re-check, so two
 * simultaneous requests cannot pair the same opponent into two battles.
 */
async function tryPair(userId: string): Promise<QueueStatusResponse | null> {
  const mine = await prisma.matchQueueEntry.findUnique({ where: { userId } });
  if (!mine) return null;

  const waitedSec = Math.max(
    0,
    Math.floor((Date.now() - mine.enqueuedAt.getTime()) / 1000),
  );
  const tolerance = toleranceFor(waitedSec);

  // The closest-rated opponent within tolerance, oldest first among equals so
  // nobody is starved by a steady stream of better-matched newcomers.
  const candidates = await prisma.matchQueueEntry.findMany({
    where: {
      userId: { not: userId },
      mode: mine.mode,
      difficulty: mine.difficulty,
      rating: { gte: mine.rating - tolerance, lte: mine.rating + tolerance },
    },
    orderBy: { enqueuedAt: "asc" },
    take: 20,
  });

  if (candidates.length === 0) return null;

  let best = candidates[0]!;
  let bestGap = Math.abs(best.rating - mine.rating);
  for (const c of candidates) {
    const gap = Math.abs(c.rating - mine.rating);
    if (gap < bestGap) {
      best = c;
      bestGap = gap;
    }
  }

  const roomCode = await uniqueRoomCode();

  /**
   * Consume both entries and create the battle atomically.
   *
   * deleteMany with both ids returns a count: if it is not 2, the opponent was
   * already paired by a concurrent request, so this attempt aborts and the
   * caller simply stays queued. This is what stops one player being placed in
   * two battles at once.
   */
  try {
    const result = await prisma.$transaction(async (tx) => {
      const removed = await tx.matchQueueEntry.deleteMany({
        where: { id: { in: [mine.id, best.id] } },
      });
      if (removed.count !== 2) return null;

      const battle = await tx.battle.create({
        data: {
          roomCode,
          mode: "ONE_V_ONE",
          difficulty: mine.difficulty,
          timeLimitSec: RANKED_TIME_LIMIT_SEC,
          seed: `${roomCode}-${Date.now()}`,
          // The host is nominal for a ranked battle — nobody invited anybody.
          hostUserId: userId,
          status: "LOBBY",
          isRanked: true,
          teams: {
            create: [
              { side: "A", members: { create: { userId, slot: 0 } } },
              {
                side: "B",
                members: { create: { userId: best.userId, slot: 0 } },
              },
            ],
          },
        },
        select: { id: true, roomCode: true },
      });

      return battle;
    });

    if (!result) return null;

    return {
      queued: false,
      waitingSec: waitedSec,
      difficulty: mine.difficulty,
      queueSize: await prisma.matchQueueEntry.count(),
      matchedBattleId: result.id,
      matchedRoomCode: result.roomCode,
    };
  } catch {
    // A unique-constraint race on the room code, or the opponent vanishing
    // mid-transaction. Staying queued is the correct outcome either way.
    return null;
  }
}

/**
 * Where a matched player finds their battle.
 *
 * A client that was matched while offline (or that missed the response) needs
 * to find the battle it was placed into. Looking for a recent ranked LOBBY
 * battle they are seated in answers that without a second "pending match"
 * table to keep in sync.
 */
export async function findAssignedBattle(
  userId: string,
): Promise<{ battleId: string; roomCode: string } | null> {
  const battle = await prisma.battle.findFirst({
    where: {
      isRanked: true,
      status: { in: ["LOBBY", "COUNTDOWN", "IN_PROGRESS"] },
      teams: { some: { members: { some: { userId } } } },
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, roomCode: true },
  });
  return battle ? { battleId: battle.id, roomCode: battle.roomCode } : null;
}

/** Drop entries whose client stopped polling, so they stop matching people. */
async function clearStale(): Promise<void> {
  await prisma.matchQueueEntry.deleteMany({
    where: { enqueuedAt: { lt: new Date(Date.now() - STALE_AFTER_MS) } },
  });
}

const ROOM_CODE_RETRIES = 5;

async function uniqueRoomCode(): Promise<string> {
  let roomCode = generateRoomCode();
  for (let attempt = 0; attempt < ROOM_CODE_RETRIES; attempt++) {
    const existing = await prisma.battle.findUnique({ where: { roomCode } });
    if (!existing) return roomCode;
    roomCode = generateRoomCode();
  }
  return roomCode;
}
