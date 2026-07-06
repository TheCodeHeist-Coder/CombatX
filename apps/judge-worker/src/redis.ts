import { Redis } from "ioredis";
import { env } from "./env.js";

/** BullMQ-compatible connection (requires maxRetriesPerRequest: null). */
export function makeRedis(): Redis {
  return new Redis(env.redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
}
