import {
  randomBytes,
  scrypt as scryptCb,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCb) as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>;

/**
 * Password hashing on Node's built-in scrypt.
 *
 * scrypt rather than bcrypt/argon2 because those ship as native addons: they
 * need a compile or a prebuilt binary at install time, which is exactly what
 * kept failing on this project's Docker builds. scrypt is memory-hard, in the
 * standard library, and needs no toolchain.
 */

const SALT_BYTES = 16;
const KEY_BYTES = 64;

/** Hash a plaintext password into a self-describing `scrypt$salt$key` string. */
export async function hashPassword(plain: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const key = await scrypt(plain, salt, KEY_BYTES);
  return `scrypt$${salt.toString("base64")}$${key.toString("base64")}`;
}

/**
 * Check a plaintext password against a stored hash.
 *
 * Compared with timingSafeEqual so the duration of a failed check does not
 * leak how much of the hash matched. Returns false rather than throwing on a
 * malformed stored value — a corrupt row should deny the login, not 500.
 */
export async function verifyPassword(
  plain: string,
  stored: string,
): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;

  const salt = Buffer.from(parts[1]!, "base64");
  const expected = Buffer.from(parts[2]!, "base64");
  if (salt.length === 0 || expected.length === 0) return false;

  const actual = await scrypt(plain, salt, expected.length);
  return timingSafeEqual(actual, expected);
}
