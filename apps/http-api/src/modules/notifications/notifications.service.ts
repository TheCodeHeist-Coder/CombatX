import { prisma } from "@repo/db";
import type {
  NotificationKind,
  NotificationsResponse,
  NotificationView,
} from "@repo/protocol";

/**
 * Notifications: writing them, and reading them back.
 *
 * WHY DELIVERY IS BEST-EFFORT
 * ---------------------------
 * Every `notify` call happens alongside something that actually matters — a
 * fixture being scheduled, a match kicking off. If writing the notification
 * fails, the fixture must still exist. So notify never throws into its
 * caller: a lost notification is a small harm, and a scheduling call that
 * rolls back because a notification row failed is a much larger one.
 */

/** How many to hand back. Enough to scroll, not enough to be a page. */
const LIMIT = 40;

/**
 * How long a notification is kept.
 *
 * A league notification is only useful while the league is live; keeping
 * years of them makes the list unusable and the table unbounded. Trimming on
 * write keeps it self-maintaining with no scheduled job to forget about.
 */
const KEEP_PER_USER = 60;

export interface NotifyInput {
  userIds: string[];
  kind: NotificationKind;
  title: string;
  body?: string | null;
  link?: string | null;
}

/**
 * Tell some people about something.
 *
 * De-duplicates the recipient list, because the natural way to build one —
 * "everyone in both teams" — produces a repeat whenever somebody is in both,
 * and nobody wants the same line twice.
 */
export async function notify(input: NotifyInput): Promise<void> {
  const userIds = [...new Set(input.userIds)].filter(Boolean);
  if (userIds.length === 0) return;

  try {
    await prisma.notification.createMany({
      data: userIds.map((userId) => ({
        userId,
        kind: input.kind,
        title: input.title,
        body: input.body ?? null,
        link: input.link ?? null,
      })),
    });
    await trim(userIds);
  } catch (err) {
    // Deliberately swallowed — see the note at the top of this file.
    console.error("notification write failed", err);
  }
}

/** Drop anything past the keep limit, oldest first. */
async function trim(userIds: string[]): Promise<void> {
  for (const userId of userIds) {
    const total = await prisma.notification.count({ where: { userId } });
    if (total <= KEEP_PER_USER) continue;
    const stale = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      skip: KEEP_PER_USER,
      select: { id: true },
    });
    if (stale.length > 0) {
      await prisma.notification.deleteMany({
        where: { id: { in: stale.map((s) => s.id) } },
      });
    }
  }
}

/** The caller's notifications, newest first, plus the unread count. */
export async function listNotifications(
  userId: string,
): Promise<NotificationsResponse> {
  const [rows, unread] = await Promise.all([
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: LIMIT,
    }),
    prisma.notification.count({ where: { userId, readAt: null } }),
  ]);

  const items: NotificationView[] = rows.map((n) => ({
    id: n.id,
    kind: n.kind,
    title: n.title,
    body: n.body,
    link: n.link,
    readAt: n.readAt?.toISOString() ?? null,
    createdAt: n.createdAt.toISOString(),
  }));

  return { items, unread };
}

/**
 * Mark notifications read.
 *
 * The userId is part of the WHERE, not merely checked first — so a caller
 * passing somebody else's notification ids changes nothing rather than
 * marking another person's list read.
 */
export async function markRead(
  userId: string,
  ids?: string[],
): Promise<{ unread: number }> {
  await prisma.notification.updateMany({
    where: {
      userId,
      readAt: null,
      ...(ids && ids.length > 0 ? { id: { in: ids } } : {}),
    },
    data: { readAt: new Date() },
  });
  return { unread: await prisma.notification.count({ where: { userId, readAt: null } }) };
}

/* -------------------------------------------------------------------------- */
/* League helpers                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Everyone playing in a league fixture.
 *
 * Both rosters, which is exactly who needs to know about the match. The host
 * is NOT included by default: they caused the event, and telling someone
 * about the thing they just did is noise. They are added explicitly where it
 * genuinely matters (a match finishing, say).
 */
export async function fixtureParticipants(
  fixtureId: string,
): Promise<string[]> {
  const fixture = await prisma.leagueFixture.findUnique({
    where: { id: fixtureId },
    select: {
      homeTeam: { select: { members: { select: { userId: true } } } },
      awayTeam: { select: { members: { select: { userId: true } } } },
    },
  });
  if (!fixture) return [];
  return [
    ...fixture.homeTeam.members.map((m) => m.userId),
    ...fixture.awayTeam.members.map((m) => m.userId),
  ];
}

/** Everyone on a given team. */
export async function teamMembers(teamId: string): Promise<string[]> {
  const rows = await prisma.leagueTeamMember.findMany({
    where: { teamId },
    select: { userId: true },
  });
  return rows.map((r) => r.userId);
}

/** Everyone playing in a league, across every team. */
export async function leagueParticipants(leagueId: string): Promise<string[]> {
  const rows = await prisma.leagueTeamMember.findMany({
    where: { team: { leagueId } },
    select: { userId: true },
  });
  return rows.map((r) => r.userId);
}
