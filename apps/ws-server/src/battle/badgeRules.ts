/**
 * Badge rules, as ws-server sees them.
 *
 * The award pass runs at the end of every battle, so it must not pay a
 * database round trip per player per battle. Rules change rarely — an admin
 * edit, not a game event — so they are cached for a short window and refreshed
 * lazily.
 *
 * The TTL is the whole design decision here: it is the longest an operator's
 * edit can take to reach live battles. Thirty seconds is short enough that an
 * admin who edits a rule and immediately plays a battle sees the new
 * behaviour, and long enough that a busy server is not re-reading the table on
 * every finish.
 */

import { prisma } from "@repo/db";
import { DEFAULT_BADGE_RULES, type BadgeCondition, type BadgeRule } from "@repo/game";

const TTL_MS = 30_000;

let cache: BadgeRule[] | null = null;
let loadedAt = 0;
/** In-flight load, so a burst of finishes shares one query. */
let inFlight: Promise<BadgeRule[]> | null = null;

/** Drop malformed conditions rather than throwing — see the API-side note. */
function parseConditions(raw: unknown): BadgeCondition[] {
  if (!Array.isArray(raw)) return [];
  const out: BadgeCondition[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const c = item as Record<string, unknown>;
    if (
      typeof c.metric === "string" &&
      (c.comparator === "gte" || c.comparator === "lte") &&
      typeof c.threshold === "number" &&
      Number.isFinite(c.threshold)
    ) {
      out.push({
        metric: c.metric as BadgeCondition["metric"],
        comparator: c.comparator,
        threshold: c.threshold,
      });
    }
  }
  return out;
}

async function load(): Promise<BadgeRule[]> {
  try {
    const rows = await prisma.badgeRule.findMany({
      where: { enabled: true },
      orderBy: [{ sortOrder: "asc" }, { key: "asc" }],
      select: {
        key: true, label: true, description: true, category: true,
        rarity: true, artKey: true, glyph: true, conditions: true,
        progressFrom: true, repeatEvery: true, enabled: true, sortOrder: true,
      },
    });

    // An empty table means nobody has seeded yet. Fall back to the shipped
    // set rather than awarding nothing: http-api seeds on its first read, and
    // in the meantime players should still earn the default badges.
    if (rows.length === 0) return DEFAULT_BADGE_RULES;

    return rows.map((r) => ({
      key: r.key,
      label: r.label,
      description: r.description,
      category: r.category,
      rarity: r.rarity,
      artKey: r.artKey,
      glyph: r.glyph,
      conditions: parseConditions(r.conditions),
      progressFrom: r.progressFrom,
      repeatEvery: r.repeatEvery,
      enabled: r.enabled,
      sortOrder: r.sortOrder,
    }));
  } catch (err) {
    // A failed read must not cost players their badges for this battle.
    console.error("[badges] rule read failed, using defaults:", err);
    return DEFAULT_BADGE_RULES;
  }
}

/** The enabled rules, cached for TTL_MS. */
export async function activeRules(): Promise<BadgeRule[]> {
  const now = Date.now();
  if (cache && now - loadedAt < TTL_MS) return cache;
  if (inFlight) return inFlight;

  inFlight = load()
    .then((rules) => {
      cache = rules;
      loadedAt = Date.now();
      return rules;
    })
    .finally(() => {
      inFlight = null;
    });

  return inFlight;
}

/** Drop the cache — used by tests. */
export function resetRuleCache(): void {
  cache = null;
  loadedAt = 0;
}
