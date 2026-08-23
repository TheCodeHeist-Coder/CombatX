import type { Request, Response } from "express";
import { GuestAuthRequest } from "@repo/protocol";
import { badRequest } from "../../http/errors.js";
import { createGuest } from "./auth.service.js";

/** POST /auth/guest — validate input, create a guest, return the token. */
export async function postGuest(req: Request, res: Response): Promise<void> {
  const parsed = GuestAuthRequest.safeParse(req.body);
  if (!parsed.success) {
    throw badRequest("Invalid display name or avatar");
  }
  const { displayName, avatarId, avatarColor } = parsed.data;
  const result = await createGuest(displayName, { avatarId, avatarColor });
  res.send(result);
}
