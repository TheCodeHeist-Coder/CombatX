import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/client/client.js";

export * from "../generated/client/client.js";

/**
 * Singleton Prisma client. In dev, hang it off globalThis so hot-reload doesn't
 * exhaust the connection pool by creating a client per reload.
 *
 * Prisma 7 requires a driver adapter — we use the node-postgres adapter and
 * read the connection string from DATABASE_URL.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("Missing required env var: DATABASE_URL");
  }
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

export const prisma: PrismaClient = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
