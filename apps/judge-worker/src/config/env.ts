/** Environment configuration for judge-worker. Fails fast if required vars missing. */
function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

export const env = {
  redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379",

  /**
   * Piston execution API base URL. Defaults to the public emkc instance; point
   * this at a self-hosted Piston for production (isolation + no rate limits).
   * `required` so a misconfigured deploy fails loudly rather than silently
   * hammering the public endpoint.
   */
  pistonUrl: required("PISTON_URL"),

  // --- Tunables -------------------------------------------------------------
  /** Concurrent jobs this worker processes. */
  concurrency: Number(process.env.JUDGE_CONCURRENCY ?? 4),
  /**
   * Per-test wall-clock limit sent to Piston (ms). Must not exceed the Piston
   * instance's own configured cap (a stock Piston caps run_timeout at 3000ms;
   * raise both together on a self-hosted instance for heavier problems).
   */
  runTimeoutMs: Number(process.env.JUDGE_RUN_TIMEOUT_MS ?? 3000),
  /** Per-test compile limit sent to Piston (ms). Stock Piston caps this at 10000. */
  compileTimeoutMs: Number(process.env.JUDGE_COMPILE_TIMEOUT_MS ?? 10000),
  /** Max stdout bytes we keep from a run (guards memory / huge prints). */
  maxOutputBytes: Number(process.env.JUDGE_MAX_OUTPUT_BYTES ?? 65536),
  /** How long to wait on a Piston HTTP call before giving up (ms). */
  httpTimeoutMs: Number(process.env.JUDGE_HTTP_TIMEOUT_MS ?? 20000),
};
