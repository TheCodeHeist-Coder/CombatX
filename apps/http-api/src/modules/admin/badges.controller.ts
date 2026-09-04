import type { Request, Response } from "express";
import {
  AdminBadgeCreate,
  AdminBadgeInput,
  AdminBadgePreviewRequest,
  type AdminBadgePreviewResponse,
  type AdminBadgeRecalcResponse,
  type AdminBadgesResponse,
} from "@repo/protocol";
import { prisma } from "@repo/db";
import {
  describeRule,
  ruleMet,
  TIERS,
  tierFor,
  type BadgeCondition,
  type BadgeRule,
  type RuleContext,
} from "@repo/game";
import { badRequest, conflict, notFound } from "../../http/errors.js";
import {
  listRules,
  listRulesForAdmin,
  seedDefaults,
} from "../ranking/badgeRules.service.js";

/** GET /admin/badges — every rule, with holder counts. */
export async function getAdminBadges(
  _req: Request,
  res: Response,
): Promise<void> {
  const body: AdminBadgesResponse = await listRulesForAdmin();
  res.json(body);
}

/**
 * POST /admin/badges — define a new badge.
 *
 * The key is permanent from here on: UserBadge rows reference it, so changing
 * it later would orphan every award. The API accepts it only at creation.
 */
export async function postAdminBadge(
  req: Request,
  res: Response,
): Promise<void> {
  const parsed = AdminBadgeCreate.safeParse(req.body);
  if (!parsed.success) {
    throw badRequest(parsed.error.issues[0]?.message ?? "Invalid badge");
  }
  const input = parsed.data;
  validateProgressFrom(input.progressFrom, input.conditions.length);

  const clash = await prisma.badgeRule.findUnique({ where: { key: input.key } });
  if (clash) throw conflict("KEY_TAKEN", "A badge with that key already exists.");

  await prisma.badgeRule.create({
    data: { ...input, conditions: input.conditions as unknown as object[] },
  });
  res.json(await listRulesForAdmin());
}

/**
 * PUT /admin/badges/:key — edit a badge.
 *
 * Everything except the key is editable, including the conditions. Players who
 * already hold the badge KEEP it: an award is a historical fact, and revoking
 * on a threshold change would punish people for an operator's tuning. The
 * recalculate endpoint is the explicit way to re-apply rules if that is wanted.
 */
export async function putAdminBadge(
  req: Request,
  res: Response,
): Promise<void> {
  const key = String(req.params.key ?? "");
  const parsed = AdminBadgeInput.safeParse(req.body);
  if (!parsed.success) {
    throw badRequest(parsed.error.issues[0]?.message ?? "Invalid badge");
  }
  const input = parsed.data;
  validateProgressFrom(input.progressFrom, input.conditions.length);

  const existing = await prisma.badgeRule.findUnique({ where: { key } });
  if (!existing) throw notFound("No badge with that key.");

  await prisma.badgeRule.update({
    where: { key },
    data: { ...input, conditions: input.conditions as unknown as object[] },
  });
  res.json(await listRulesForAdmin());
}

/**
 * DELETE /admin/badges/:key — remove a badge definition.
 *
 * Refused while anyone holds it. Deleting the definition would leave those
 * UserBadge rows pointing at nothing, so the badge would vanish from every
 * profile that earned it. Disabling is the reversible alternative, and the
 * error says so.
 */
export async function deleteAdminBadge(
  req: Request,
  res: Response,
): Promise<void> {
  const key = String(req.params.key ?? "");
  const existing = await prisma.badgeRule.findUnique({ where: { key } });
  if (!existing) throw notFound("No badge with that key.");

  const holders = await prisma.userBadge.count({ where: { badgeKey: key } });
  if (holders > 0) {
    throw conflict(
      "BADGE_IN_USE",
      `${holders} player${holders === 1 ? " holds" : "s hold"} this badge. Disable it instead of deleting it.`,
    );
  }

  await prisma.badgeRule.delete({ where: { key } });
  res.json(await listRulesForAdmin());
}

/** POST /admin/badges/seed — restore any missing shipped defaults. */
export async function postAdminBadgeSeed(
  _req: Request,
  res: Response,
): Promise<void> {
  await seedDefaults();
  res.json(await listRulesForAdmin());
}

/**
 * POST /admin/badges/preview — how many players would a rule match?
 *
 * Answers the question an operator actually has before saving: "if I set this
 * to 50, who gets it?". Reads every non-guest account, which is fine at this
 * scale and is an explicit, admin-only action rather than a hot path.
 */
export async function postAdminBadgePreview(
  req: Request,
  res: Response,
): Promise<void> {
  const parsed = AdminBadgePreviewRequest.safeParse(req.body);
  if (!parsed.success) {
    throw badRequest(parsed.error.issues[0]?.message ?? "Invalid conditions");
  }
  const conditions = parsed.data.conditions as BadgeCondition[];

  const users = await loadRuleContexts();
  const probe: BadgeRule = {
    key: "__preview", label: "", description: "", category: "MILESTONE",
    rarity: "COMMON", artKey: "", glyph: "", conditions,
    progressFrom: null, repeatEvery: null, enabled: true, sortOrder: 0,
  };

  const body: AdminBadgePreviewResponse = {
    matches: users.filter((u) => ruleMet(probe, u.ctx)).length,
    totalUsers: users.length,
    summary: describeRule(probe),
  };
  res.json(body);
}

/**
 * POST /admin/badges/recalculate — re-apply every rule to every player.
 *
 * Editing a threshold does not retroactively change anything on its own: the
 * award pass runs when a battle finishes. This is the deliberate "apply now"
 * action, and it reports exactly what moved so an operator can see the blast
 * radius of their edit.
 *
 * It AWARDS newly-qualifying badges and REVOKES ones whose rule no longer
 * holds — the only place in the system that revokes. That is why it is an
 * explicit button rather than something an edit triggers silently.
 */
export async function postAdminBadgeRecalculate(
  _req: Request,
  res: Response,
): Promise<void> {
  const rules = (await listRules()).filter((r) => r.enabled);
  const users = await loadRuleContexts();

  const held = await prisma.userBadge.findMany({
    select: { userId: true, badgeKey: true },
  });
  const heldByUser = new Map<string, Set<string>>();
  for (const h of held) {
    const set = heldByUser.get(h.userId) ?? new Set<string>();
    set.add(h.badgeKey);
    heldByUser.set(h.userId, set);
  }

  const toAward: { userId: string; badgeKey: string }[] = [];
  const toRevoke: { userId: string; badgeKey: string }[] = [];
  const awardedByBadge: Record<string, number> = {};

  for (const user of users) {
    const has = heldByUser.get(user.id) ?? new Set<string>();
    const qualifies = new Set(
      rules.filter((r) => ruleMet(r, user.ctx)).map((r) => r.key),
    );

    for (const key of qualifies) {
      if (!has.has(key)) {
        toAward.push({ userId: user.id, badgeKey: key });
        awardedByBadge[key] = (awardedByBadge[key] ?? 0) + 1;
      }
    }
    for (const key of has) {
      // Only revoke badges this pass actually knows about. A row whose rule
      // was deleted or disabled is left alone rather than stripped, so a
      // temporarily disabled badge does not wipe everyone's history.
      const known = rules.some((r) => r.key === key);
      if (known && !qualifies.has(key)) {
        toRevoke.push({ userId: user.id, badgeKey: key });
      }
    }
  }

  if (toAward.length > 0) {
    await prisma.userBadge.createMany({ data: toAward, skipDuplicates: true });
  }
  for (const r of toRevoke) {
    await prisma.userBadge.deleteMany({
      where: { userId: r.userId, badgeKey: r.badgeKey },
    });
  }

  const body: AdminBadgeRecalcResponse = {
    usersScanned: users.length,
    awarded: toAward.length,
    revoked: toRevoke.length,
    awardedByBadge,
  };
  res.json(body);
}

// --- helpers ---------------------------------------------------------------

/** Every non-guest account, shaped for rule evaluation. */
async function loadRuleContexts(): Promise<
  { id: string; ctx: RuleContext }[]
> {
  const now = Date.now();
  const rows = await prisma.user.findMany({
    where: { isGuest: false },
    select: {
      id: true, wins: true, losses: true, draws: true, xp: true,
      bestStreak: true, rankedBattles: true, upsetWins: true, perfectWins: true,
      easyWins: true, mediumWins: true, hardWins: true,
      distinctProblemsWon: true, signupOrdinal: true, createdAt: true,
      approvedProblems: true,
      rating: true, ratingRd: true, ratingVolatility: true,
    },
  });

  return rows.map((u) => {
    const rating = {
      rating: u.rating,
      rd: u.ratingRd,
      volatility: u.ratingVolatility,
    };
    const tier = tierFor(rating);
    return {
      id: u.id,
      ctx: {
        wins: u.wins, losses: u.losses, draws: u.draws, xp: u.xp,
        bestStreak: u.bestStreak, rankedBattles: u.rankedBattles,
        upsetWins: u.upsetWins, perfectWins: u.perfectWins,
        easyWins: u.easyWins, mediumWins: u.mediumWins, hardWins: u.hardWins,
        distinctProblemsWon: u.distinctProblemsWon,
        signupOrdinal: u.signupOrdinal,
        approvedProblemsAuthored: u.approvedProblems,
        accountAgeDays: Math.max(
          0,
          Math.floor((now - u.createdAt.getTime()) / 86_400_000),
        ),
        rating,
        tierIndex: tier ? TIERS.findIndex((t) => t.key === tier.key) : -1,
      },
    };
  });
}

/** A progress index must point at a condition that exists. */
function validateProgressFrom(
  progressFrom: number | null,
  conditionCount: number,
): void {
  if (progressFrom !== null && progressFrom >= conditionCount) {
    throw badRequest(
      "The progress condition must be one of the conditions above it.",
    );
  }
}
