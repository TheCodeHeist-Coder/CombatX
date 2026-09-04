import type { Request, Response } from "express";
import { MarkReadInput } from "@repo/protocol";
import type { AuthedRequest } from "../../middleware/auth.js";
import { badRequest } from "../../http/errors.js";
import { listNotifications, markRead } from "./notifications.service.js";

/** GET /me/notifications — the caller's notifications and unread count. */
export async function getNotifications(
  req: Request,
  res: Response,
): Promise<void> {
  const { claims } = req as AuthedRequest;
  res.send(await listNotifications(claims.userId));
}

/**
 * POST /me/notifications/read — mark them read.
 *
 * Omitting `ids` marks everything, which is the usual case: someone opened
 * the panel and has read the lot by looking at it.
 */
export async function postMarkRead(
  req: Request,
  res: Response,
): Promise<void> {
  const { claims } = req as AuthedRequest;
  const parsed = MarkReadInput.safeParse(req.body ?? {});
  if (!parsed.success) {
    throw badRequest(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  res.send(await markRead(claims.userId, parsed.data.ids));
}
