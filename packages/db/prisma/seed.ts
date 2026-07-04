import { PrismaClient, Difficulty, TestKind } from "../generated/client/index.js";

const prisma = new PrismaClient();

/**
 * Problems use a stdin -> stdout contract so the judge (Piston) can run any
 * language uniformly: the program reads input from stdin and prints the answer
 * to stdout. Starter code wires up stdin reading for the player.
 */

interface SeedTest {
  input: string;
  expectedOutput: string;
  kind: TestKind;
}

interface SeedProblem {
  title: string;
  difficulty: Difficulty;
  statementMarkdown: string;
  constraints: string;
  starterPython: string;
  tests: SeedTest[];
}

const PROBLEMS: SeedProblem[] = [
  {
    title: "Sum of Two Numbers",
    difficulty: "EASY",
    statementMarkdown: [
      "Read two integers `a` and `b` from standard input (space-separated on one line)",
      "and print their sum.",
      "",
      "**Input:** a single line with two integers.",
      "",
      "**Output:** a single integer — the sum.",
    ].join("\n"),
    constraints: "-10^9 <= a, b <= 10^9",
    starterPython: [
      "import sys",
      "",
      "def solve():",
      "    a, b = map(int, sys.stdin.readline().split())",
      "    # TODO: print the sum of a and b",
      "    print(a + b)",
      "",
      "solve()",
    ].join("\n"),
    tests: [
      { kind: "SAMPLE", input: "2 3", expectedOutput: "5" },
      { kind: "SAMPLE", input: "-1 1", expectedOutput: "0" },
      { kind: "HIDDEN", input: "1000000000 1000000000", expectedOutput: "2000000000" },
      { kind: "HIDDEN", input: "-1000000000 -5", expectedOutput: "-1000000005" },
      { kind: "HIDDEN", input: "0 0", expectedOutput: "0" },
    ],
  },
  {
    title: "Reverse a String",
    difficulty: "EASY",
    statementMarkdown: [
      "Read a single line string `s` and print it reversed.",
      "",
      "**Input:** one line containing the string (may contain spaces).",
      "",
      "**Output:** the reversed string.",
    ].join("\n"),
    constraints: "1 <= len(s) <= 10^5",
    starterPython: [
      "import sys",
      "",
      "def solve():",
      "    s = sys.stdin.readline().rstrip('\\n')",
      "    # TODO: print s reversed",
      "    print(s[::-1])",
      "",
      "solve()",
    ].join("\n"),
    tests: [
      { kind: "SAMPLE", input: "hello", expectedOutput: "olleh" },
      { kind: "SAMPLE", input: "racecar", expectedOutput: "racecar" },
      { kind: "HIDDEN", input: "CombateOne", expectedOutput: "enOetabmoC" },
      { kind: "HIDDEN", input: "a b c", expectedOutput: "c b a" },
      { kind: "HIDDEN", input: "z", expectedOutput: "z" },
    ],
  },
  {
    title: "Count Vowels",
    difficulty: "MEDIUM",
    statementMarkdown: [
      "Given a lowercase string `s`, count how many characters are vowels",
      "(`a`, `e`, `i`, `o`, `u`) and print the count.",
      "",
      "**Input:** one line, the string `s`.",
      "",
      "**Output:** a single integer — the number of vowels.",
    ].join("\n"),
    constraints: "1 <= len(s) <= 10^5, s contains only lowercase letters",
    starterPython: [
      "import sys",
      "",
      "def solve():",
      "    s = sys.stdin.readline().rstrip('\\n')",
      "    # TODO: count and print the number of vowels in s",
      "    print(sum(1 for c in s if c in 'aeiou'))",
      "",
      "solve()",
    ].join("\n"),
    tests: [
      { kind: "SAMPLE", input: "hello", expectedOutput: "2" },
      { kind: "SAMPLE", input: "xyz", expectedOutput: "0" },
      { kind: "HIDDEN", input: "aeiou", expectedOutput: "5" },
      { kind: "HIDDEN", input: "combateone", expectedOutput: "5" },
      { kind: "HIDDEN", input: "rhythm", expectedOutput: "0" },
      { kind: "HIDDEN", input: "programming", expectedOutput: "3" },
    ],
  },
];

async function main() {
  console.log("Seeding problems...");

  // Idempotent: wipe test cases + problems, then re-insert. Safe for a dev seed.
  await prisma.testCase.deleteMany({});
  await prisma.problem.deleteMany({});

  for (const p of PROBLEMS) {
    const created = await prisma.problem.create({
      data: {
        title: p.title,
        difficulty: p.difficulty,
        statementMarkdown: p.statementMarkdown,
        constraints: p.constraints,
        allowedLanguages: ["PYTHON"],
        starterCode: { PYTHON: p.starterPython },
        timeLimitDefaultSec: 600,
        testCases: {
          create: p.tests.map((t, i) => ({
            kind: t.kind,
            input: t.input,
            expectedOutput: t.expectedOutput,
            ordinal: i,
          })),
        },
      },
    });
    console.log(`  + ${created.title} (${created.difficulty}) — ${p.tests.length} tests`);
  }

  console.log(`Done. Seeded ${PROBLEMS.length} problems.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
