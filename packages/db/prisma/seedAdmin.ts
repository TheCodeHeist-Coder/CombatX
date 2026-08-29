import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "@repo/auth";
import { PrismaClient } from "../generated/client/client.js";

/**
 * Seed (or reset) the super-admin account.
 *
 * Run with `pnpm --filter @repo/db db:seed-admin`. Credentials come from the
 * environment so they are not committed to the repo:
 *
 *   SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD, SUPER_ADMIN_USERNAME
 *
 * Idempotent: running it again on an existing account resets that account's
 * password and re-asserts the role, rather than failing on the unique email.
 * That doubles as the password-reset path, since nothing in the app can change
 * an admin password.
 */

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const email = (process.env.SUPER_ADMIN_EMAIL ?? "").toLowerCase().trim();
const password = process.env.SUPER_ADMIN_PASSWORD ?? "";
const username = process.env.SUPER_ADMIN_USERNAME ?? "superadmin";

async function main(): Promise<void> {
  if (!email || !password) {
    throw new Error(
      "Set SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD before running this seed.",
    );
  }
  if (password.length < 12) {
    // Deliberately stricter than the player rule: this one account can read
    // every user's email and rewrite the problem set.
    throw new Error("SUPER_ADMIN_PASSWORD must be at least 12 characters.");
  }

  const passwordHash = await hashPassword(password);

  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash, role: "SUPER_ADMIN", isGuest: false },
    create: {
      email,
      passwordHash,
      username,
      usernameLower: username.toLowerCase(),
      role: "SUPER_ADMIN",
      // An admin is not a player: keep them off the public directory.
      isPublic: false,
    },
    select: { id: true, email: true, username: true, role: true },
  });

  console.log("Super admin ready:");
  console.log(`  email:    ${user.email}`);
  console.log(`  username: ${user.username}`);
  console.log(`  role:     ${user.role}`);
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
