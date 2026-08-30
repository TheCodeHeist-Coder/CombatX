/**
 * Reading and writing admin-editable badge rules.
 *
 * The rules live in the database so an operator can retune them without a
 * deploy. This module is the only place that translates between the stored
 * rows and the pure rule type in @repo/game.
 *
 * SEEDING
 * -------
 * An empty table seeds itself from DEFAULT_BADGE_RULES on first read. That
 * makes a fresh install work with no setup step, and means the defaults are
 * genuinely the default rather than an empty badge system. Once seeded the
 * rows are authoritative: a later release changing the shipped defaults must
 * never silently revert an operator's tuning.
 */

import { prisma } from "@repo/db";
import {
  DEFAULT_BADGE_RULES,
  describeRule,
  type BadgeCondition,
  type BadgeRule,
} from "@repo/game";
import type { AdminBadgeRow } from "@repo/protocol";

/** A stored row, as Prisma returns it. */
interface StoredRule {
  key: string;
  label: string;
  description: string;
  category: string;
  rarity: string;
  artKey: string;
  glyph: string;
  conditions: unknown;
  progressFrom: number | null;
  enabled: boolean;
  sortOrder: number;
}

/**
 * Parse the stored JSON conditions defensively.
 *
 * The column is JSON, so it could in principle hold anything — a hand-edited
 * row, or a shape from an older release. A malformed condition is DROPPED
 * rather than throwing: one bad row must not take down every profile page on
 * the site. A rule left with no conditions is then never awarded, which is the
 * safe direction to fail.
 */
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

function toRule(row: StoredRule): BadgeRule {
  return {
    key: row.key,
    label: row.label,
    description: row.description,
    category: row.category,
    rarity: row.rarity,
    artKey: row.artKey,
    glyph: row.glyph,
    conditions: parseConditions(row.conditions),
    progressFrom: row.progressFrom,
    enabled: row.enabled,
    sortOrder: row.sortOrder,
  };
}

const SELECT = {
  key: true, label: true, description: true, category: true, rarity: true,
  artKey: true, glyph: true, conditions: true, progressFrom: true,
  enabled: true, sortOrder: true,
} as const;

/** Insert the shipped defaults. Idempotent — skips keys already present. */
export async function seedDefaults(): Promise<number> {
  const existing = new Set(
    (await prisma.badgeRule.findMany({ select: { key: true } })).map((r) => r.key),
  );
  const missing = DEFAULT_BADGE_RULES.filter((r) => !existing.has(r.key));
  if (missing.length === 0) return 0;

  await prisma.badgeRule.createMany({
    data: missing.map((r) => ({
      key: r.key, label: r.label, description: r.description,
      category: r.category, rarity: r.rarity, artKey: r.artKey, glyph: r.glyph,
      // Cast because Prisma types a Json column as its own InputJsonValue
      // union; the shape is already the validated BadgeCondition[].
      conditions: r.conditions as unknown as object[],
      progressFrom: r.progressFrom,
      enabled: r.enabled, sortOrder: r.sortOrder,
    })),
  });
  return missing.length;
}

/**
 * Every rule, seeding the defaults if the table is empty.
 *
 * Falls back to the in-code defaults if the database read fails outright, so a
 * transient outage degrades to "the shipped badges" rather than "no badges" —
 * which on a profile page would read as every player having lost everything.
 */
export async function listRules(): Promise<BadgeRule[]> {
  try {
    let rows = await prisma.badgeRule.findMany({
      select: SELECT,
      orderBy: [{ sortOrder: "asc" }, { key: "asc" }],
    });

    if (rows.length === 0) {
      await seedDefaults();
      rows = await prisma.badgeRule.findMany({
        select: SELECT,
        orderBy: [{ sortOrder: "asc" }, { key: "asc" }],
      });
    }

    return rows.map(toRule);
  } catch (err) {
    console.error("[badges] rule read failed, using defaults:", err);
    return DEFAULT_BADGE_RULES;
  }
}

/** Only the rules that are actually awarded. */
export async function listEnabledRules(): Promise<BadgeRule[]> {
  return (await listRules()).filter((r) => r.enabled);
}

/** The admin table: every rule, with how many players hold it. */
export async function listRulesForAdmin(): Promise<{
  rows: AdminBadgeRow[];
  empty: boolean;
}> {
  const before = await prisma.badgeRule.count();
  const rules = await listRules();

  const counts = await prisma.userBadge.groupBy({
    by: ["badgeKey"],
    _count: { badgeKey: true },
  });
  const holders = new Map(counts.map((c) => [c.badgeKey, c._count.badgeKey]));

  return {
    empty: before === 0,
    rows: rules.map((r) => ({
      key: r.key,
      label: r.label,
      description: r.description,
      category: r.category as AdminBadgeRow["category"],
      rarity: r.rarity as AdminBadgeRow["rarity"],
      artKey: r.artKey,
      glyph: r.glyph,
      conditions: r.conditions as AdminBadgeRow["conditions"],
      progressFrom: r.progressFrom,
      enabled: r.enabled,
      sortOrder: r.sortOrder,
      holders: holders.get(r.key) ?? 0,
      summary: describeRule(r),
    })),
  };
}
