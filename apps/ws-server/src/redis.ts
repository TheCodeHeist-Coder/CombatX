import IORedis from "ioredis";
import { env } from "./env.js";

/**
 * Redis connections. We keep them separate by role because a connection in
 * Redis "subscribe" mode cannot issue normal commands, and BullMQ requires a
 * connection with `maxRetriesPerRequest: null`.
 */

/** General-purpose connection (BullMQ-compatible). */
export function makeRedis(): IORedis {
  return new IORedis(env.redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
}

/** A dedicated connection for pub/sub subscribing. */
export function makeSubscriber(): IORedis {
  return new IORedis(env.redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
}
