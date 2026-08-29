import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { prisma } from "@repo/db";
import { asyncHandler } from "../../http/asyncHandler.js";
import { verifyBearer } from "../../middleware/auth.js";

/**
 * A page view, as the web app reports it.
 *
 * `path` is capped and stripped of any query string before storage: query
 * params routinely carry tokens, emails and search terms, none of which
 * belong in an analytics table.
 */
const TrackRequest = z.object({
  path: z.string().min(1).max(200),
  visitorId: z.string().min(8).max(64),
});

/** Keep only the path, never the query or fragment. */
function cleanPath(raw: string): string {
  const path = raw.split(/[?#]/)[0] ?? "/";
  return path.startsWith("/") ? path.slice(0, 200) : "/";
}

export const trackRoutes: Router = Router();

/**
 * POST /track — record one page view.
 *
 * Public and unauthenticated, because the whole point is counting visitors who
 * have no account. That makes it forgeable: anyone can inflate the counter.
 * That is an accepted trade for a first-party hit counter — it is a product
 * metric, not a billing input — and nothing downstream trusts it for anything
 * but display.
 *
 * Always answers 204, even on a bad body or a failed write: a analytics ping
 * must never surface an error to a visitor who is just loading a page.
 */
trackRoutes.post(
  "/track",
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = TrackRequest.safeParse(req.body);
    if (!parsed.success) {
      res.status(204).end();
      return;
    }

    // Attribute the view to a signed-in user when a token happens to be
    // present, but never require one.
    const claims = await verifyBearer(req.headers.authorization);

    try {
      await prisma.pageView.create({
        data: {
          path: cleanPath(parsed.data.path),
          visitorId: parsed.data.visitorId,
          userId: claims?.userId ?? null,
        },
      });
    } catch {
      // Swallowed on purpose: see the note above.
    }
    res.status(204).end();
  }),
);
