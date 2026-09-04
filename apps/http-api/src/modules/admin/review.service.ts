/**
 * Reviewing community-submitted problems.
 *
 * WHY THE BADGE AWARD LIVES HERE AND NOT IN THE BATTLE PIPELINE
 * ------------------------------------------------------------
 * Every other badge is earned by fighting, so ws-server awards them when a
 * battle finishes. An authoring badge is earned when an ADMIN approves
 * something, which happens with no battle in sight — so the award has to
 * happen at approval time or it would sit unearned until the author's next
 * fight.
 *
 * WHY IT UPSERTS INSTEAD OF CREATING
 * ----------------------------------
 * Problem Setter is repeatable: approving a second problem must turn "x1" into
 * "x2", not throw on the [userId, badgeKey] unique index. The battle path can
 * safely `create` because it filters to badges the player does not hold; here
 * the whole point is to touch a row that already exists.
 */

import { prisma } from "@repo/db";
import {
  ruleLevel,
  TIERS,
  tierFor,
  type BadgeRule,
  type RuleContext,
} from "@repo/game";
import { conflict, notFound } from "../../http/errors.js";
import { listRules } from "../ranking/badgeRules.service.js";

const MS_PER_DAY = 86_400_000;

/** Build the rule context for one user, after their counters have moved. */
async function ruleContextFor(userId: string): Promise<RuleContext | null> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      wins: true, losses: true, draws: true, xp: true, bestStreak: true,
      rankedBattles: true, upsetWins: true, perfectWins: true,
      easyWins: true, mediumWins: true, hardWins: true,
      distinctProblemsWon: true, signupOrdinal: true, createdAt: true,
      approvedProblems: true,
      rating: true, ratingRd: true, ratingVolatility: true,
    },
  });
  if (!u) return null;

  const rating = {
    rating: u.rating,
    rd: u.ratingRd,
    volatility: u.ratingVolatility,
  };
  const tier = tierFor(rating, u.rankedBattles);

  return {
    wins: u.wins, losses: u.losses, draws: u.draws, xp: u.xp,
    bestStreak: u.bestStreak, rankedBattles: u.rankedBattles,
    upsetWins: u.upsetWins, perfectWins: u.perfectWins,
    easyWins: u.easyWins, mediumWins: u.mediumWins, hardWins: u.hardWins,
    distinctProblemsWon: u.distinctProblemsWon,
    signupOrdinal: u.signupOrdinal,
    accountAgeDays: Math.max(
      0,
      Math.floor((Date.now() - u.createdAt.getTime()) / MS_PER_DAY),
    ),
    approvedProblemsAuthored: u.approvedProblems,
    rating,
    tierIndex: tier ? TIERS.findIndex((t) => t.key === tier.key) : -1,
  };
}

export interface AwardedBadge {
  key: string;
  label: string;
  /** The new multiplier. 1 for an ordinary badge, 2+ for a repeat. */
  count: number;
  /** True the first time this badge is held at all. */
  isNew: boolean;
}

/**
 * Bring one author's badges in line with their current stats.
 *
 * Awards what is newly earned and RAISES the count of a repeatable badge that
 * has levelled up. It never lowers a count and never revokes: a badge already
 * granted is history, and an admin un-approving a problem should not erase the
 * fact that it was once accepted.
 */
async function syncAuthorBadges(
  userId: string,
  rules: BadgeRule[],
): Promise<AwardedBadge[]> {
  const ctx = await ruleContextFor(userId);
  if (!ctx) return [];

  const held = await prisma.userBadge.findMany({
    where: { userId },
    select: { badgeKey: true, count: true },
  });
  const heldByKey = new Map(held.map((h) => [h.badgeKey, h.count]));

  const awarded: AwardedBadge[] = [];

  for (const rule of rules) {
    const level = ruleLevel(rule, ctx);
    if (level < 1) continue;

    const current = heldByKey.get(rule.key);
    if (current !== undefined && current >= level) continue;

    await prisma.userBadge.upsert({
      where: { userId_badgeKey: { userId, badgeKey: rule.key } },
      create: { userId, badgeKey: rule.key, count: level },
      // `set`, not `increment`: the level is derived from the author's total,
      // so it is already absolute. Incrementing would double-count a replay.
      update: { count: level },
    });

    awarded.push({
      key: rule.key,
      label: rule.label,
      count: level,
      isNew: current === undefined,
    });
  }

  return awarded;
}

export interface ReviewResult {
  id: string;
  status: "APPROVED" | "REJECTED";
  /** Badges the author gained or levelled up, for the admin's confirmation. */
  awarded: AwardedBadge[];
}

/**
 * Approve a submitted problem.
 *
 * The status flip and the author's counter move together in one transaction:
 * a problem that is live while its author's `approvedProblems` still says zero
 * would hand out the wrong badge level on the next approval.
 *
 * Badges are synced AFTER that transaction commits, because the sync reads the
 * counter back and must see the new value.
 */
export async function approveProblem(
  id: string,
  reviewerId: string,
): Promise<ReviewResult> {
  const problem = await prisma.problem.findUnique({
    where: { id },
    select: { status: true, authorId: true },
  });
  if (!problem) throw notFound("No such problem.");
  if (problem.status === "APPROVED") {
    throw conflict("ALREADY_APPROVED", "This problem is already live.");
  }

  await prisma.$transaction([
    prisma.problem.update({
      where: { id },
      data: {
        status: "APPROVED",
        reviewNote: null,
        reviewedAt: new Date(),
        reviewedById: reviewerId,
      },
    }),
    // Only a community submission moves the counter. An admin-authored problem
    // has no author, and self-approving should not mint authoring badges.
    ...(problem.authorId
      ? [
          prisma.user.update({
            where: { id: problem.authorId },
            data: { approvedProblems: { increment: 1 } },
          }),
        ]
      : []),
  ]);

  const awarded = problem.authorId
    ? await syncAuthorBadges(problem.authorId, await listRules())
    : [];

  return { id, status: "APPROVED", awarded };
}

/**
 * Reject a submitted problem, with a reason the author will read.
 *
 * The note is required. A rejection with no explanation gives the author
 * nothing to act on, and they will simply resubmit the same thing.
 */
export async function rejectProblem(
  id: string,
  reviewerId: string,
  reviewNote: string,
): Promise<ReviewResult> {
  const note = reviewNote.trim();
  if (note.length < 10) {
    throw conflict(
      "REASON_REQUIRED",
      "Give the author a reason — at least a sentence they can act on.",
    );
  }

  const problem = await prisma.problem.findUnique({
    where: { id },
    select: { status: true, _count: { select: { battles: true } } },
  });
  if (!problem) throw notFound("No such problem.");
  if (problem._count.battles > 0) {
    throw conflict(
      "PROBLEM_IN_USE",
      "This problem has been used in a battle and cannot be rejected now.",
    );
  }

  await prisma.problem.update({
    where: { id },
    data: {
      status: "REJECTED",
      reviewNote: note,
      reviewedAt: new Date(),
      reviewedById: reviewerId,
    },
  });

  return { id, status: "REJECTED", awarded: [] };
}
