/**
 * Near-duplicate detection for submitted problems.
 *
 * WHY THIS IS FUZZY AND NOT AN EQUALITY CHECK
 * -------------------------------------------
 * Nobody submits a byte-identical copy. They submit "Two Sum Pairs" when
 * "Two Sum" exists, or "Reverse a linked list." against "Reverse A Linked
 * List". An `=` comparison catches none of those, so it would pass every
 * real duplicate straight through to the reviewer.
 *
 * So the comparison is on a NORMALISED form (lowercased, punctuation dropped,
 * whitespace collapsed, stop-words removed) and scored by token overlap.
 *
 * WHY IT WARNS AND DOES NOT BLOCK
 * -------------------------------
 * Similarity is a guess. "Binary Search" and "Binary Search Tree Height" share
 * most of their tokens and are entirely different problems, while two genuinely
 * distinct authors can land on the same obvious title. Refusing a submission on
 * a guess means a correct problem is unpublishable and the author has no way to
 * argue. Warning puts a human in the loop: the author sees what it resembles
 * and decides, and the reviewer sees the same list at approval time.
 *
 * The one thing it does hard-block is an EXACT title match on a live problem,
 * where there is nothing to judge.
 */

import { prisma } from "@repo/db";
import type { DuplicateMatch } from "@repo/protocol";

/**
 * Words carrying no signal in a problem title.
 *
 * Kept short on purpose. Strip too much and "Count the Islands" and "Count the
 * Primes" collapse into the same token set, which manufactures duplicates
 * rather than finding them.
 */
const STOP_WORDS = new Set([
  "a", "an", "the", "of", "in", "on", "to", "for", "and", "or",
  "is", "are", "be", "with", "from", "at", "by", "into",
]);

/** Similarity at or above this on the title means "show the author". */
export const TITLE_WARN_THRESHOLD = 0.6;
/** Similarity at or above this on the statement body means the same. */
export const STATEMENT_WARN_THRESHOLD = 0.75;
/** How many near-matches are worth showing. Beyond this it is noise. */
const MAX_MATCHES = 5;

/**
 * Reduce text to comparable tokens.
 *
 * Exported for the tests: the normalisation IS the algorithm, and a change
 * here silently changes what counts as a duplicate.
 */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    // Drop anything that is not a letter, digit or space. Markdown syntax,
    // punctuation and code fences all carry no signal about the SUBJECT.
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 0 && !STOP_WORDS.has(w))
    .map(singular);
}

/**
 * Fold a trailing plural, so "Count Primes" and "Prime Count" match.
 *
 * Measured: without this those two score 0.33 and slip through, which is
 * exactly the duplicate this check exists to catch.
 *
 * Deliberately not a real stemmer. Porter would also fold "matching" to
 * "match" and "sorted" to "sort", which sounds better until it merges
 * "Sort an Array" with "Sorted Matrix Search". Plural-only is the smallest
 * rule that fixes the observed miss without inventing new collisions.
 */
function singular(word: string): string {
  if (word.length > 3 && word.endsWith("ies")) return `${word.slice(0, -3)}y`;
  // "sses" -> "ss" keeps "addresses" as "address" rather than "addresse".
  if (word.length > 4 && word.endsWith("sses")) return word.slice(0, -2);
  // Leave "ss" alone, or "class" becomes "clas".
  if (word.length > 3 && word.endsWith("s") && !word.endsWith("ss")) {
    return word.slice(0, -1);
  }
  return word;
}

/**
 * Jaccard similarity over token sets: shared tokens / total distinct tokens.
 *
 * Set-based rather than sequence-based because word ORDER is not meaningful
 * here — "Sum of Two Numbers" and "Two Numbers Sum" are the same problem.
 * Two empty inputs score 0, not 1: an empty title is not a duplicate of
 * another empty title, it is just missing.
 */
export function similarity(a: string, b: string): number {
  const setA = new Set(tokenize(a));
  const setB = new Set(tokenize(b));
  if (setA.size === 0 || setB.size === 0) return 0;

  let shared = 0;
  for (const token of setA) if (setB.has(token)) shared += 1;

  const union = setA.size + setB.size - shared;
  return union === 0 ? 0 : shared / union;
}

/** An exact match after normalisation — "Two Sum" vs "two sum!". */
export function isExactTitleMatch(a: string, b: string): boolean {
  const ta = tokenize(a).join(" ");
  const tb = tokenize(b).join(" ");
  return ta.length > 0 && ta === tb;
}

export interface DuplicateReport {
  /** True when something is close enough to be worth the author's attention. */
  duplicate: boolean;
  /** True only for an exact title collision, which is refused outright. */
  exact: boolean;
  matches: DuplicateMatch[];
}

/**
 * Compare a candidate against the existing bank.
 *
 * Scans APPROVED and PENDING problems — pending ones matter because two people
 * can submit the same idea in the same afternoon, and the second author should
 * hear about it before a reviewer reads both.
 *
 * DRAFT and REJECTED are excluded: a rejected problem is not in the arena, and
 * warning someone off a title that failed review helps nobody.
 */
export async function findDuplicates(
  title: string,
  statementMarkdown: string,
  excludeId?: string,
): Promise<DuplicateReport> {
  const candidates = await prisma.problem.findMany({
    where: {
      status: { in: ["APPROVED", "PENDING"] },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: {
      id: true,
      title: true,
      difficulty: true,
      statementMarkdown: true,
    },
  });

  const matches: DuplicateMatch[] = [];
  let exact = false;

  for (const row of candidates) {
    if (isExactTitleMatch(title, row.title)) {
      exact = true;
      matches.push({
        id: row.id,
        title: row.title,
        difficulty: row.difficulty,
        similarity: 1,
        reason: "TITLE",
      });
      continue;
    }

    const titleScore = similarity(title, row.title);
    if (titleScore >= TITLE_WARN_THRESHOLD) {
      matches.push({
        id: row.id,
        title: row.title,
        difficulty: row.difficulty,
        similarity: Number(titleScore.toFixed(2)),
        reason: "TITLE",
      });
      continue;
    }

    // Only worth comparing bodies when both are substantial. A one-line
    // statement matches many others on tokens alone without being a copy.
    if (statementMarkdown.length >= 80 && row.statementMarkdown.length >= 80) {
      const bodyScore = similarity(statementMarkdown, row.statementMarkdown);
      if (bodyScore >= STATEMENT_WARN_THRESHOLD) {
        matches.push({
          id: row.id,
          title: row.title,
          difficulty: row.difficulty,
          similarity: Number(bodyScore.toFixed(2)),
          reason: "STATEMENT",
        });
      }
    }
  }

  // Strongest first, so the author reads the most likely collision first.
  matches.sort((a, b) => b.similarity - a.similarity);

  return {
    duplicate: matches.length > 0,
    exact,
    matches: matches.slice(0, MAX_MATCHES),
  };
}
