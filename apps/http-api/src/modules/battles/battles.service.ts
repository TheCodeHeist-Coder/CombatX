import { prisma } from "@repo/db";
import {
  normalizeAvatar,
  type BattleResultResponse,
  type BattleSolutionsResponse,
  type CreateBattleRequest,
  type CreateBattleResponse,
  type JoinBattleResponse,
  type Difficulty,
  type Language,
  type PublicProblem,
  type SolutionEntry,
  type StandingRow,
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

/**
 * The client-safe projection of a problem.
 *
 * Mirrors ws-server's `toPublicProblem` rather than importing it: the two
 * services share no package, and this is a field mapping with one rule worth
 * coordinating — HIDDEN tests are stripped entirely and only the total count
 * is exposed, so a client can render "x / total" without seeing the cases.
 */
function toPublicProblem(
  problem: {
    id: string;
    title: string;
    statementMarkdown: string;
    constraints: string;
    difficulty: Difficulty;
    allowedLanguages: string[];
    starterCode: unknown;
  },
  tests: { kind: string; input: string; expectedOutput: string; ordinal: number }[],
): PublicProblem {
  return {
    id: problem.id,
    title: problem.title,
    statementMarkdown: problem.statementMarkdown,
    constraints: problem.constraints,
    difficulty: problem.difficulty,
    allowedLanguages: problem.allowedLanguages as Language[],
    starterCode: problem.starterCode as Record<Language, string>,
    sampleTests: tests
      .filter((t) => t.kind === "SAMPLE")
      .sort((a, b) => a.ordinal - b.ordinal)
      .map((t) => ({
        ordinal: t.ordinal,
        input: t.input,
        expectedOutput: t.expectedOutput,
      })),
    totalTests: tests.length,
  };
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
      // Room-code battles are never ranked: the host picks who gets the code,
      // so any rating movement here could be traded between two accounts.
      // Ranked battles come only from the matchmaker.
      isRanked: false,
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
    // The problem rides along so a debrief opened from a link or a reload can
    // show the question. Only revealed once the battle is over — see below.
    include: {
      result: true,
      problem: { include: { testCases: true } },
      // The roster, so the debrief can name each side by who played it.
      teams: {
        select: {
          side: true,
          members: { select: { user: { select: { username: true } } } },
        },
      },
    },
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
      isRanked: battle.isRanked,
    },
    winnerSide: battle.winnerSide ?? null,
    reason: battle.finishReason ?? null,
    standings,
    decidingSubmissionId: battle.result?.decidingSubmissionId ?? null,
    /*
     * The problem, but ONLY on a battle that has finished.
     *
     * A live battle's row is readable here too (the lobby polls it), and
     * handing back the statement then would let anyone with the battle id
     * read the question without being seated in the room.
     */
    problem:
      battle.status === "FINISHED" && battle.problem
        ? toPublicProblem(battle.problem, battle.problem.testCases)
        : null,
    rosters: battle.teams.map((t) => ({
      side: t.side,
      usernames: t.members.map((m) => m.user.username),
    })),
  };
}

/**
 * Read every player's source code for a FINISHED battle.
 *
 * The status check is the whole security boundary of this endpoint. While a
 * battle is live the arena deliberately never reveals opponent source — only a
 * pass-count — because it would be trivially copyable. Once the battle is over
 * that risk is gone, and reading how the other side solved it is the point of
 * the debrief, so the full room becomes readable.
 *
 * Returns each player's BEST submission (highest pass-count, earliest on a tie
 * — the same rule that decides the battle) rather than every attempt: the
 * debrief is for comparing finished solutions, not scrolling failed drafts.
 */
export async function getBattleSolutions(
  battleId: string,
): Promise<BattleSolutionsResponse> {
  const battle = await prisma.battle.findUnique({
    where: { id: battleId },
    include: { result: true },
  });
  if (!battle) {
    throw notFound("Battle not found");
  }
  if (battle.status !== "FINISHED") {
    throw conflict(
      "NOT_FINISHED",
      "Solutions are revealed once the battle is over.",
    );
  }

  const submissions = await prisma.submission.findMany({
    where: { battleId, status: "COMPLETED" },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          avatarId: true,
          avatarColor: true,
          imageUrl: true,
        },
      },
    },
    // Best first, then earliest — so the first row per user is their best.
    orderBy: [{ passedCount: "desc" }, { submittedAt: "asc" }],
  });

  const decidingId = battle.result?.decidingSubmissionId ?? null;

  const bestByUser = new Map<string, SolutionEntry>();
  for (const sub of submissions) {
    if (bestByUser.has(sub.userId)) continue;
    const avatar = normalizeAvatar(
      sub.user.avatarId,
      sub.user.avatarColor,
      sub.userId,
    );
    bestByUser.set(sub.userId, {
      submissionId: sub.id,
      userId: sub.userId,
      username: sub.user.username,
      avatarId: avatar.avatarId,
      avatarColor: avatar.avatarColor,
      imageUrl: sub.user.imageUrl,
      side: sub.teamSide,
      language: sub.language as Language,
      sourceCode: sub.sourceCode,
      passed: sub.passedCount,
      total: sub.totalCount,
      timeMs: sub.runtimeMs,
      submittedAt: sub.submittedAt.toISOString(),
      isDeciding: sub.id === decidingId,
    });
  }

  const entries = [...bestByUser.values()].sort(
    (a, b) => b.passed - a.passed || a.submittedAt.localeCompare(b.submittedAt),
  );

  return { battleId, entries };
}
