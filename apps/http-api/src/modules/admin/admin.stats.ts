import { prisma } from "@repo/db";
import type { AdminOverviewResponse, DailyCount } from "@repo/protocol";
import { env } from "../../env.js";

/** How many days the dashboard's trend charts cover. */
const TREND_DAYS = 14;

/** Midnight today, in the server's timezone. */
function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function daysAgo(n: number): Date {
  const d = startOfToday();
  d.setDate(d.getDate() - n);
  return d;
}

/**
 * Ask ws-server how many players are connected right now.
 *
 * Returns null rather than throwing when ws-server is unreachable: the whole
 * dashboard should not 500 because one optional number is unavailable, and the
 * UI renders "—" for a null. The timeout matters — without it a hung ws-server
 * would hang every admin page load.
 */
async function fetchOnlineNow(): Promise<number | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(`${env.wsServerUrl}/internal/stats`, {
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const body = (await res.json()) as { onlinePlayers?: unknown };
    return typeof body.onlinePlayers === "number" ? body.onlinePlayers : null;
  } catch {
    return null;
  }
}

/**
 * Bucket timestamps into a dense day-by-day series.
 *
 * Dense matters: grouping in SQL returns no row for a day with zero activity,
 * and a sparkline that silently skips empty days misrepresents a quiet week as
 * a busy one.
 */
function toDailySeries(dates: Date[], days: number): DailyCount[] {
  const counts = new Map<string, number>();
  for (let i = days - 1; i >= 0; i--) {
    counts.set(daysAgo(i).toISOString().slice(0, 10), 0);
  }
  for (const date of dates) {
    const key = date.toISOString().slice(0, 10);
    if (counts.has(key)) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()].map(([day, count]) => ({ day, count }));
}

/** Every headline number on the admin dashboard. */
export async function getOverview(): Promise<AdminOverviewResponse> {
  const today = startOfToday();
  const weekAgo = daysAgo(7);
  const trendFrom = daysAgo(TREND_DAYS - 1);
  const monthAgo = daysAgo(30);

  const [
    totalUsers,
    guests,
    activeToday,
    activeWeek,
    signupsToday,
    signupsWeek,
    totalBattles,
    finishedBattles,
    inProgressBattles,
    battlesToday,
    battlesWeek,
    totalSubmissions,
    submissionsToday,
    totalViews,
    viewsToday,
    uniqueVisitors,
    topPaths,
    problemGroups,
    signupDates,
    battleDates,
    viewDates,
    onlineNow,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { isGuest: true } }),
    prisma.user.count({ where: { lastBattleAt: { gte: today } } }),
    prisma.user.count({ where: { lastBattleAt: { gte: weekAgo } } }),
    prisma.user.count({ where: { createdAt: { gte: today }, isGuest: false } }),
    prisma.user.count({ where: { createdAt: { gte: weekAgo }, isGuest: false } }),
    prisma.battle.count(),
    prisma.battle.count({ where: { status: "FINISHED" } }),
    prisma.battle.count({ where: { status: { in: ["LOBBY", "COUNTDOWN", "IN_PROGRESS"] } } }),
    prisma.battle.count({ where: { createdAt: { gte: today } } }),
    prisma.battle.count({ where: { createdAt: { gte: weekAgo } } }),
    prisma.submission.count(),
    prisma.submission.count({ where: { submittedAt: { gte: today } } }),
    prisma.pageView.count(),
    prisma.pageView.count({ where: { createdAt: { gte: today } } }),
    prisma.pageView
      .findMany({
        where: { createdAt: { gte: monthAgo } },
        distinct: ["visitorId"],
        select: { visitorId: true },
      })
      .then((rows) => rows.length),
    prisma.pageView.groupBy({
      by: ["path"],
      where: { createdAt: { gte: monthAgo } },
      _count: { path: true },
      orderBy: { _count: { path: "desc" } },
      take: 6,
    }),
    prisma.problem.groupBy({ by: ["difficulty"], _count: { difficulty: true } }),
    prisma.user.findMany({
      where: { createdAt: { gte: trendFrom }, isGuest: false },
      select: { createdAt: true },
    }),
    prisma.battle.findMany({
      where: { createdAt: { gte: trendFrom } },
      select: { createdAt: true },
    }),
    prisma.pageView.findMany({
      where: { createdAt: { gte: trendFrom } },
      select: { createdAt: true },
    }),
    fetchOnlineNow(),
  ]);

  const byDifficulty: Record<string, number> = {
    EASY: 0,
    MEDIUM: 0,
    HARD: 0,
  };
  let totalProblems = 0;
  for (const group of problemGroups) {
    byDifficulty[group.difficulty] = group._count.difficulty;
    totalProblems += group._count.difficulty;
  }

  return {
    users: {
      total: totalUsers,
      registered: totalUsers - guests,
      guests,
      onlineNow,
      activeToday,
      activeWeek,
      signupsToday,
      signupsWeek,
    },
    battles: {
      total: totalBattles,
      finished: finishedBattles,
      inProgress: inProgressBattles,
      today: battlesToday,
      week: battlesWeek,
    },
    submissions: { total: totalSubmissions, today: submissionsToday },
    traffic: {
      totalViews,
      viewsToday,
      uniqueVisitors30d: uniqueVisitors,
      topPaths: topPaths.map((p) => ({
        path: p.path,
        count: p._count.path,
      })),
    },
    problems: {
      total: totalProblems,
      byDifficulty: byDifficulty as AdminOverviewResponse["problems"]["byDifficulty"],
    },
    trend: {
      signups: toDailySeries(
        signupDates.map((r) => r.createdAt),
        TREND_DAYS,
      ),
      battles: toDailySeries(
        battleDates.map((r) => r.createdAt),
        TREND_DAYS,
      ),
      views: toDailySeries(
        viewDates.map((r) => r.createdAt),
        TREND_DAYS,
      ),
    },
  };
}
