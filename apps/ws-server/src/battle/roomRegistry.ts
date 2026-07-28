import { prisma } from "@repo/db";
import type { BattleConfig } from "@repo/protocol";
import { BattleRoom } from "./battleRoom.js";
import type { JudgePipeline } from "../infra/judgeQueue.js";

/**
 * Owns the set of live BattleRooms. Rooms are lazily hydrated from Postgres on
 * first connection and evicted when their last socket leaves.
 */
export class RoomRegistry {
  private readonly rooms = new Map<string, BattleRoom>();
  /** In-flight hydrations, so concurrent hellos share ONE room, not a race. */
  private readonly hydrating = new Map<string, Promise<BattleRoom | null>>();

  constructor(private readonly judge: JudgePipeline) {}

  /**
   * Get the live room for a battle, hydrating it from the DB if needed. Returns
   * null if the battle doesn't exist or has already ended.
   *
   * Hydration is deduped: if two connections for the same battle arrive at once
   * (the common case — both players open sockets together), they await the same
   * hydration promise and end up in the SAME room rather than each creating one.
   */
  async get(battleId: string): Promise<BattleRoom | null> {
    const existing = this.rooms.get(battleId);
    if (existing) return existing;

    const inFlight = this.hydrating.get(battleId);
    if (inFlight) return inFlight;

    const promise = this.hydrate(battleId).finally(() => {
      this.hydrating.delete(battleId);
    });
    this.hydrating.set(battleId, promise);
    return promise;
  }

  private async hydrate(battleId: string): Promise<BattleRoom | null> {
    // Re-check the cache in case a room was created while we queued.
    const cached = this.rooms.get(battleId);
    if (cached) return cached;

    const battle = await prisma.battle.findUnique({ where: { id: battleId } });
    if (!battle) return null;
    if (battle.status === "FINISHED" || battle.status === "ABANDONED") {
      return null;
    }

    const config: BattleConfig = {
      mode: battle.mode,
      difficulty: battle.difficulty,
      timeLimitSec: battle.timeLimitSec,
    };

    const room = new BattleRoom({
      battleId: battle.id,
      roomCode: battle.roomCode,
      hostUserId: battle.hostUserId,
      config,
      seed: battle.seed,
      // A room only lives in memory while people are connected; on cold
      // hydration we always resume from the lobby so players can (re)seat.
      status: battle.status === "COUNTDOWN" ? "LOBBY" : battle.status,
      judge: this.judge,
      onEmpty: (id) => this.evict(id),
    });
    this.rooms.set(battle.id, room);

    // A battle that was mid-fight when its room fell out of memory keeps its
    // problem and clock only in the DB. Restore them so a reconnecting player
    // lands in a live arena rather than a permanent "revealing the problem".
    if (battle.status === "IN_PROGRESS") {
      await room.resumeInProgress({
        assignedProblemId: battle.assignedProblemId,
        serverStartAt: battle.serverStartAt,
        serverEndAt: battle.serverEndAt,
      });
    }

    return room;
  }

  /** Route a judge result to its room (if still live). */
  async routeResult(battleId: string, result: Parameters<BattleRoom["applyJudgeResult"]>[0]): Promise<void> {
    const room = this.rooms.get(battleId);
    if (!room) return;
    await room.applyJudgeResult(result);
  }

  private evict(battleId: string): void {
    const room = this.rooms.get(battleId);
    if (!room) return;
    // Guard against a race: a socket may have reconnected between the empty
    // signal and this call.
    if (room.hasConnections()) return;
    room.dispose();
    this.rooms.delete(battleId);
  }

  disposeAll(): void {
    for (const room of this.rooms.values()) room.dispose();
    this.rooms.clear();
  }
}
