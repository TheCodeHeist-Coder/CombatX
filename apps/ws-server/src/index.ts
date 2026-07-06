import "./config/loadEnv.js"; // must be first — loads .env before @repo/db reads it
import { createGameServer } from "./server.js";

const server = createGameServer();
await server.start();

async function shutdown(signal: string): Promise<void> {
  console.log(`\n${signal} received, shutting down ws-server...`);
  // Failsafe: force-exit if graceful drain hangs.
  setTimeout(() => process.exit(0), 5000).unref();
  await server.stop();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
