import { Redis } from "ioredis";
import { env } from "./env.js";

/**
 * Redis connections. We keep them separate by role because a connection in
 * Redis "subscribe" mode cannot issue normal commands, and BullMQ requires a
 * connection with `maxRetriesPerRequest: null`.
 */

/** General-purpose connection (BullMQ-compatible). */
export function makeRedis(): Redis {
  return new Redis(env.redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
}

/** A dedicated connection for pub/sub subscribing. */
export function makeSubscriber(): Redis {
  return new Redis(env.redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
}
