import type { Request, Response } from "express";
import { LoginRequest, SignupRequest, Username } from "@repo/protocol";
import { badRequest } from "../../http/errors.js";
import { isUsernameAvailable, login, signup } from "./auth.service.js";

/**
 * Turn a Zod failure into the first field-level message.
 *
 * The signup form has four fields, so a generic "invalid input" would leave
 * the user guessing which one; Zod's own message already names the rule.
 */
function firstIssue(error: { issues: { message: string }[] }): string {
  return error.issues[0]?.message ?? "Invalid input";
}

/** POST /auth/signup — create an account and return a session token. */
export async function postSignup(req: Request, res: Response): Promise<void> {
  const parsed = SignupRequest.safeParse(req.body);
  if (!parsed.success) {
    throw badRequest(firstIssue(parsed.error));
  }
  res.send(await signup(parsed.data));
}

/** POST /auth/login — exchange email + password for a session token. */
export async function postLogin(req: Request, res: Response): Promise<void> {
  const parsed = LoginRequest.safeParse(req.body);
  if (!parsed.success) {
    throw badRequest(firstIssue(parsed.error));
  }
  res.send(await login(parsed.data));
}

/**
 * GET /auth/available?username=… — live uniqueness check for the signup form.
 *
 * Reports a malformed username as simply unavailable rather than 400: the
 * field is checked while the user is still typing, and an error state for
 * "not finished yet" reads as a failure when it is just an incomplete entry.
 */
export async function getUsernameAvailable(
  req: Request,
  res: Response,
): Promise<void> {
  const raw = typeof req.query.username === "string" ? req.query.username : "";
  const parsed = Username.safeParse(raw);
  if (!parsed.success) {
    res.send({ username: raw, available: false });
    return;
  }
  res.send({
    username: parsed.data,
    available: await isUsernameAvailable(parsed.data),
  });
}
