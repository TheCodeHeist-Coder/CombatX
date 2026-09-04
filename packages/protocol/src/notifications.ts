import { z } from "zod";

/**
 * Notifications — telling someone something happened while they were away.
 *
 * The whole reason this exists: a league runs over days, and a host who
 * schedules your match at 9pm has no way to reach you. Before this, the only
 * way to find out was to open the league page and look, which means the
 * people most likely to miss a match are the ones not already watching.
 */

/**
 * What a notification is about. Mirrors the Prisma enum.
 *
 * Closed rather than free-form: each kind renders with its own icon and
 * wording, so an unknown kind would arrive as an unstyled row.
 */
export const NotificationKind = z.enum([
  "LEAGUE_FIXTURE_SCHEDULED",
  "LEAGUE_MATCH_STARTED",
  "LEAGUE_FIXTURE_RESULT",
  "LEAGUE_TIEBREAK_SCHEDULED",
  "LEAGUE_ROUND_DRAWN",
  "LEAGUE_FINISHED",
]);
export type NotificationKind = z.infer<typeof NotificationKind>;

export const NotificationView = z.object({
  id: z.string(),
  kind: NotificationKind,
  title: z.string(),
  body: z.string().nullable().default(null),
  /** Where clicking it goes. Null when there is nowhere useful to send them. */
  link: z.string().nullable().default(null),
  readAt: z.string().nullable().default(null),
  createdAt: z.string(),
});
export type NotificationView = z.infer<typeof NotificationView>;

export const NotificationsResponse = z.object({
  items: z.array(NotificationView).default([]),
  /** Drives the badge, so the client never has to count client-side. */
  unread: z.number().int().min(0).default(0),
});
export type NotificationsResponse = z.infer<typeof NotificationsResponse>;

/**
 * Marking notifications read.
 *
 * `ids` omitted means "all of them" — the usual case, when someone opens the
 * panel and has read everything by looking at it.
 */
export const MarkReadInput = z.object({
  ids: z.array(z.string()).optional(),
});
export type MarkReadInput = z.infer<typeof MarkReadInput>;
