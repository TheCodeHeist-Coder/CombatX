/**
 * Public runtime endpoints. These are inlined at build time by Next from the
 * NEXT_PUBLIC_* env, with sane localhost defaults for `pnpm dev`.
 */
export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4001";

export const WS_URL =
  process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:4002/ws";
