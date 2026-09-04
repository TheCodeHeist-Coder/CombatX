import type { Response } from "express";
import type {
  BattleHistoryEntry,
  BattleHistoryResponse,
  Side,
  StandingRow,
} from "@repo/protocol";
import { prisma } from "@repo/db";
import type { AuthedRequest } from "../../middleware/auth.js";

const LIMIT = 30;

/**
 * GET /me/battles — the caller's battle history.
 *
 * Keyed off Submission, not TeamMember: seats live in ws-server's memory and
 * are never persisted, so a submission is the only durable proof that a user
 * took part in a battle. A player who never submitted therefore has no history
 * row, which is the honest answer — we have no record of them playing.
 */
export async function getMyBattles(
  req: AuthedRequest,
  res: Response,
): Promise<void> {
  const userId = req.claims.userId;

  const mine = await prisma.submission.findMany({
    where: { userId },
    select: {
      battleId: true,
      teamSide: true,
      passedCount: true,
      totalCount: true,
      submittedAt: true,
    },
    orderBy: { submittedAt: "desc" },
  });

  if (mine.length === 0) {
    const empty: BattleHistoryResponse = { entries: [] };
    res.json(empty);
    return;
  }

  // Collapse to one row per battle, keeping the best passed-count — the same
  // figure the scoring rules use to decide the outcome.
  const perBattle = new Map<
    string,
    { side: Side; bestPassed: number; total: number; at: Date }
  >();
  for (const s of mine) {
    const cur = perBattle.get(s.battleId);
    if (!cur || s.passedCount > cur.bestPassed) {
      perBattle.set(s.battleId, {
        side: s.teamSide,
        bestPassed: s.passedCount,
        total: s.totalCount,
        at: cur?.at ?? s.submittedAt,
      });
    }
  }

  const battleIds = [...perBattle.keys()].slice(0, LIMIT);

  const battles = await prisma.battle.findMany({
    where: { id: { in: battleIds } },
    select: {
      id: true,
      roomCode: true,
      mode: true,
      difficulty: true,
      status: true,
      winnerSide: true,
      finishReason: true,
      createdAt: true,
      serverEndAt: true,
      problem: {
        select: { title: true, _count: { select: { testCases: true } } },
      },
      result: { select: { standings: true, createdAt: true } },
      // The league this battle belonged to, when it was a fixture leg.
      leagueLeg: {
        select: {
          fixture: {
            select: {
              round: true,
              league: { select: { id: true, name: true } },
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const entries: BattleHistoryEntry[] = battles.map((b) => {
    const m = perBattle.get(b.id)!;

    // Prefer the authoritative standings row when the battle finished.
    let bestPassed = m.bestPassed;
    let total = m.total;
    const standings = b.result?.standings as StandingRow[] | undefined;
    const row = Array.isArray(standings)
      ? standings.find((s) => s.side === m.side)
      : undefined;
    if (row) {
      bestPassed = row.bestPassed;
      total = row.total;
    }

    return {
      battleId: b.id,
      roomCode: b.roomCode,
      mode: b.mode,
      difficulty: b.difficulty,
      status: b.status,
      mySide: m.side,
      winnerSide: b.winnerSide,
      reason: b.finishReason,
      problemTitle: b.problem?.title ?? null,
      myBestPassed: bestPassed,
      totalTests: total || b.problem?._count.testCases || 0,
      finishedAt: (b.result?.createdAt ?? b.serverEndAt)?.toISOString() ?? null,
      createdAt: b.createdAt.toISOString(),
      leagueId: b.leagueLeg?.fixture.league.id ?? null,
      leagueName: b.leagueLeg?.fixture.league.name ?? null,
      leagueRound: b.leagueLeg?.fixture.round ?? null,
    };
  });

  const body: BattleHistoryResponse = { entries };
  res.json(body);
}
