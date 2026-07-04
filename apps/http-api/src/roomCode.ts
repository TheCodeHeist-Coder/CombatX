import { randomInt } from "node:crypto";

// Unambiguous alphabet (no 0/O/1/I) for easy verbal sharing.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** Generate a random N-char room code. */
export function generateRoomCode(length = 6): string {
  let code = "";
  for (let i = 0; i < length; i++) {
    code += ALPHABET[randomInt(ALPHABET.length)];
  }
  return code;
}
