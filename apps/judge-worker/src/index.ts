import "./config/loadEnv.js"; // must be first — loads .env before @repo/db reads it
import { JudgeWorker } from "./worker.js";

const worker = new JudgeWorker();

async function shutdown(signal: string): Promise<void> {
  console.log(`\n${signal} received, shutting down judge-worker...`);
  await worker.close();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
