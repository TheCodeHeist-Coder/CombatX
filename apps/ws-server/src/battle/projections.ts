import type {
  BattleSnapshot,
  BattleStatus,
  Language,
  PlayerView,
  PublicProblem,
  SampleTest,
  Side,
  SideProgress,
  SubmissionResultView,
} from "@repo/protocol";
import type { Problem, TestCase } from "@repo/db";
import type { LobbySeat, RoomSubmission } from "../types.js";

/**
 * Build the client-safe projection of a Problem. Strips HIDDEN tests entirely —
 * only SAMPLE tests are ever sent to clients — and exposes only the total count
 * so a client can render "x / total".
 */
export function toPublicProblem(
  problem: Problem,
  tests: TestCase[],
): PublicProblem {
  const sampleTests: SampleTest[] = tests
    .filter((t) => t.kind === "SAMPLE")
    .sort((a, b) => a.ordinal - b.ordinal)
    .map((t) => ({
      ordinal: t.ordinal,
      input: t.input,
      expectedOutput: t.expectedOutput,
    }));

  return {
    id: problem.id,
    title: problem.title,
    statementMarkdown: problem.statementMarkdown,
    constraints: problem.constraints,
    difficulty: problem.difficulty,
    allowedLanguages: problem.allowedLanguages as Language[],
    starterCode: problem.starterCode as Record<Language, string>,
    sampleTests,
    totalTests: tests.length,
  };
}

/** Roster row visible to everyone in the room. */
export function toPlayerView(
  seat: LobbySeat,
  hostUserId: string,
): PlayerView {
  return {
    userId: seat.userId,
    displayName: seat.displayName,
    side: seat.side,
    slot: seat.slot,
    ready: seat.ready,
    presence: seat.presence,
    isHost: seat.userId === hostUserId,
  };
}

/** Best passed-count per side (opponent-safe: no source, no per-user detail). */
export function toSideProgress(
  submissions: RoomSubmission[],
): SideProgress[] {
  return (["A", "B"] as const).map((side) => {
    const mine = submissions.filter((s) => s.side === side);
    let bestPassed = 0;
    let total = 0;
    for (const s of mine) {
      if (s.passed > bestPassed) {
        bestPassed = s.passed;
      }
      if (s.total > total) total = s.total;
    }
    return { side, bestPassed, total };
  });
}

/** A single submission result as broadcast to the room (never carries source). */
export function toSubmissionResultView(s: RoomSubmission): SubmissionResultView {
  return {
    submissionId: s.submissionId,
    userId: s.userId,
    side: s.side,
    status: s.status,
    passed: s.passed,
    total: s.total,
    timeMs: s.timeMs,
    errorMessage: s.errorMessage ?? null,
  };
}

/**
 * Assemble the full snapshot for a specific caller. Their OWN submission
 * results are included in full; opponents' are aggregated into progress only.
 */
export function buildSnapshot(args: {
  battleId: string;
  roomCode: string;
  status: BattleStatus;
  config: BattleSnapshot["config"];
  seats: LobbySeat[];
  hostUserId: string;
  problem: PublicProblem | null;
  serverStartAt: number | null;
  serverEndAt: number | null;
  serverNowMs: number;
  submissions: RoomSubmission[];
  forUserId: string;
  winnerSide: Side | null;
  finishReason: BattleSnapshot["finishReason"];
}): BattleSnapshot {
  const ownSubmissions = args.submissions
    .filter((s) => s.userId === args.forUserId)
    .map(toSubmissionResultView);

  return {
    battleId: args.battleId,
    roomCode: args.roomCode,
    status: args.status,
    config: args.config,
    players: args.seats.map((seat) => toPlayerView(seat, args.hostUserId)),
    problem: args.problem,
    serverStartAt: args.serverStartAt,
    serverEndAt: args.serverEndAt,
    serverNowMs: args.serverNowMs,
    progress: toSideProgress(args.submissions),
    ownSubmissions,
    winnerSide: args.winnerSide,
    finishReason: args.finishReason,
  };
}
