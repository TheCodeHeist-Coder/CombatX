import { prisma } from "@repo/db";
import type {
  BattleResultResponse,
  CreateBattleRequest,
  CreateBattleResponse,
  JoinBattleResponse,
  StandingRow,
} from "@repo/protocol";
import { conflict, notFound } from "../../http/errors.js";
import { generateRoomCode } from "../../roomCode.js";

/** How many times to retry room-code generation on a (rare) collision. */
const ROOM_CODE_RETRIES = 5;

/** Generate a room code that isn't already taken. */
async function uniqueRoomCode(): Promise<string> {
  let roomCode = generateRoomCode();
  for (let attempt = 0; attempt < ROOM_CODE_RETRIES; attempt++) {
    const existing = await prisma.battle.findUnique({ where: { roomCode } });
    if (!existing) return roomCode;
    roomCode = generateRoomCode();
  }
  return roomCode; // extremely unlikely; last generated code wins
}

/** Create a new battleground hosted by `hostUserId`. */
export async function createBattle(
  hostUserId: string,
  config: CreateBattleRequest,
): Promise<CreateBattleResponse> {
  const roomCode = await uniqueRoomCode();
  const battle = await prisma.battle.create({
    data: {
      roomCode,
      mode: config.mode,
      difficulty: config.difficulty,
      timeLimitSec: config.timeLimitSec,
      seed: `${roomCode}-${Date.now()}`,
      hostUserId,
      status: "LOBBY",
      teams: { create: [{ side: "A" }, { side: "B" }] },
    },
  });
  return { battleId: battle.id, roomCode: battle.roomCode };
}

/**
 * Confirm a battle is joinable by room code. Seat selection happens over the WS
 * connection; here we only validate the room and hand back its id so the client
 * can open the socket. Throws if the room is missing or already started.
 */
export async function joinBattle(roomCode: string): Promise<JoinBattleResponse> {
  const normalized = roomCode.toUpperCase();
  const battle = await prisma.battle.findUnique({
    where: { roomCode: normalized },
  });
  if (!battle) {
    throw notFound("No battle with that code");
  }
  if (battle.status !== "LOBBY" && battle.status !== "COUNTDOWN") {
    throw conflict("IN_PROGRESS", "Battle already started");
  }
  return { battleId: battle.id, roomCode: battle.roomCode };
}

/** Read the final result of a battle for the results screen. */
export async function getBattleResult(
  battleId: string,
): Promise<BattleResultResponse> {
  const battle = await prisma.battle.findUnique({
    where: { id: battleId },
    include: { result: true },
  });
  if (!battle) {
    throw notFound("Battle not found");
  }

  const standings =
    (battle.result?.standings as StandingRow[] | undefined) ?? [];
  return {
    battleId: battle.id,
    config: {
      mode: battle.mode,
      difficulty: battle.difficulty,
      timeLimitSec: battle.timeLimitSec,
    },
    winnerSide: battle.winnerSide ?? null,
    reason: battle.finishReason ?? null,
    standings,
    decidingSubmissionId: battle.result?.decidingSubmissionId ?? null,
  };
}
