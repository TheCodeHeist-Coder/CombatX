import { PrismaClient } from "../generated/client/index.js";

export * from "../generated/client/index.js";

/**
 * Singleton Prisma client. In dev, hang it off globalThis so hot-reload doesn't
 * exhaust the connection pool by creating a client per reload.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma: PrismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
