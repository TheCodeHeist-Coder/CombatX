/**
 * Deterministic, seedable RNG so problem selection is reproducible and
 * auditable (seed = battleId) but unpredictable to clients.
 *
 * mulberry32 — small, fast, good enough for fair selection (not crypto).
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function next(): number {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Hash an arbitrary string seed (e.g. a battleId/cuid) into a uint32. */
export function hashSeed(seed: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Pick one item deterministically from a list given a string seed.
 * Returns null for an empty list.
 */
export function seededPick<T>(items: readonly T[], seed: string): T | null {
  if (items.length === 0) return null;
  const rand = mulberry32(hashSeed(seed));
  const idx = Math.floor(rand() * items.length);
  return items[idx] ?? null;
}
