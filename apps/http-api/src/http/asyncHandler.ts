import type { Request, Response } from "express";
import { sendError } from "./errors.js";

/**
 * Wrap an async controller so any thrown error (including HttpError) is turned
 * into a proper JSON error response instead of an unhandled rejection. Generic
 * over the request type so controllers can declare typed params/body.
 */
export function asyncHandler<Req extends Request>(
  fn: (req: Req, res: Response) => Promise<unknown>,
): (req: Req, res: Response) => void {
  return (req, res) => {
    fn(req, res).catch((err) => sendError(res, err));
  };
}
