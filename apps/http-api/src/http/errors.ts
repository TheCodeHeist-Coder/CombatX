import type { Response } from "express";
import type { ApiError } from "@repo/protocol";

/**
 * A typed HTTP error. Controllers/services throw these; the central error
 * handler turns them into the `{ code, message }` JSON shape (protocol ApiError)
 * with the right status. This keeps every endpoint's error responses uniform.
 */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

// Convenience constructors for the codes this API uses.
export const badRequest = (message: string) => new HttpError(400, "BAD_REQUEST", message);
export const unauthorized = (message = "Login required") =>
  new HttpError(401, "UNAUTHORIZED", message);
export const notFound = (message: string) => new HttpError(404, "NOT_FOUND", message);
export const conflict = (code: string, message: string) =>
  new HttpError(409, code, message);

/** Serialize an HttpError (or any error) into the JSON error body + status. */
export function sendError(res: Response, err: unknown): void {
  if (res.headersSent) return;
  if (err instanceof HttpError) {
    const body: ApiError = { code: err.code, message: err.message };
    res.status(err.status).send(body);
    return;
  }
  console.error(err);
  const body: ApiError = { code: "INTERNAL", message: "Server error" };
  res.status(500).send(body);
}
