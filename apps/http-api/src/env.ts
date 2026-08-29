/** Environment configuration for http-api. Fails fast if required vars missing. */
function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

export const env = {
  port: Number(process.env.HTTP_API_PORT ?? 4001),
  host: process.env.HTTP_API_HOST ?? "0.0.0.0",
  jwtSecret: required("JWT_SECRET"),
  // Comma-separated allowed origins for CORS (the web app + the admin app).
  corsOrigins: (
    process.env.CORS_ORIGINS ?? "http://localhost:3001,http://localhost:3002"
  ).split(","),
  /**
   * ws-server's internal HTTP base, used only to read the live connection
   * count for the admin dashboard. Never proxied to a browser.
   */
  wsServerUrl: process.env.WS_SERVER_INTERNAL_URL ?? "http://localhost:4002",
};
