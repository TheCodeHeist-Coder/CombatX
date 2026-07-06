import { config as loadDotenv } from "dotenv";

// Load local .env, then fall back to a repo-root .env for shared vars.
loadDotenv();
loadDotenv({ path: "../../.env" });

/** Environment configuration for ws-server. Fails fast if required vars missing. */
function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

export const env = {
  port: Number(process.env.WS_SERVER_PORT ?? 4002),
  host: process.env.WS_SERVER_HOST ?? "0.0.0.0",
  jwtSecret: required("JWT_SECRET"),
  redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379",
  // Comma-separated allowed origins for the health endpoint's CORS.
  corsOrigins: (process.env.CORS_ORIGINS ?? "http://localhost:3001").split(","),

  // --- Tunables -------------------------------------------------------------
  /** Lobby countdown before a battle begins (ms). */
  countdownMs: Number(process.env.COUNTDOWN_MS ?? 3000),
  /** How often the server broadcasts an authoritative timer correction (ms). */
  timerTickMs: Number(process.env.TIMER_TICK_MS ?? 1000),
  /** App-level idle timeout: drop a socket that misses this many pings (ms). */
  heartbeatTimeoutMs: Number(process.env.HEARTBEAT_TIMEOUT_MS ?? 30000),
  /** Max in-flight submissions a single user may have before being throttled. */
  maxPendingSubmissionsPerUser: Number(
    process.env.MAX_PENDING_SUBMISSIONS_PER_USER ?? 2,
  ),
};
