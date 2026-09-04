import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildLeagueTable,
  contestedPlaces,
  hasAmbiguousCut,
  nextRoundFor,
  qualifyingTeams,
  seedPairings,
  type FixtureResult,
} from "./leagueStandings.js";

const fx = (
  home: string,
  away: string,
  hs: number,
  as: number,
): FixtureResult => ({
  homeTeamId: home,
  awayTeamId: away,
  homeScore: hs,
  awayScore: as,
  winnerTeamId: hs > as ? home : as > hs ? away : null,
});

/* --- the table ----------------------------------------------------------- */

test("a team that has not played still appears, on zero", () => {
  const t = buildLeagueTable(["a", "b", "c"], [fx("a", "b", 2, 0)]);
  const c = t.find((r) => r.teamId === "c")!;
  assert.equal(c.played, 0);
  assert.equal(c.points, 0);
  assert.equal(t.length, 3);
});

test("a win is three points, a draw is one each", () => {
  const t = buildLeagueTable(["a", "b"], [fx("a", "b", 2, 0)]);
  assert.equal(t.find((r) => r.teamId === "a")!.points, 3);
  assert.equal(t.find((r) => r.teamId === "b")!.points, 0);

  const d = buildLeagueTable(["a", "b"], [fx("a", "b", 1, 1)]);
  assert.equal(d.find((r) => r.teamId === "a")!.points, 1);
  assert.equal(d.find((r) => r.teamId === "b")!.points, 1);
  assert.equal(d.find((r) => r.teamId === "a")!.drawn, 1);
});

test("legs are counted for both sides of a match", () => {
  const t = buildLeagueTable(["a", "b"], [fx("a", "b", 2, 1)]);
  const a = t.find((r) => r.teamId === "a")!;
  const b = t.find((r) => r.teamId === "b")!;
  assert.equal(a.legsWon, 2);
  assert.equal(a.legsLost, 1);
  assert.equal(a.legDiff, 1);
  assert.equal(b.legsWon, 1);
  assert.equal(b.legsLost, 2);
  assert.equal(b.legDiff, -1);
});

test("points beat leg difference", () => {
  // b racks up legs but loses; a wins narrowly twice.
  const t = buildLeagueTable(
    ["a", "b", "c"],
    [fx("a", "c", 2, 1), fx("a", "b", 2, 1), fx("b", "c", 3, 0)],
  );
  assert.equal(t[0]!.teamId, "a", "a has 6 points and must top the table");
});

test("leg difference breaks a tie on points", () => {
  const t = buildLeagueTable(
    ["a", "b", "c", "d"],
    [fx("a", "c", 3, 0), fx("b", "d", 2, 1)],
  );
  // a and b both won once; a's leg difference is better.
  assert.equal(t[0]!.teamId, "a");
  assert.equal(t[1]!.teamId, "b");
});

test("the order is stable when teams are completely level", () => {
  const results = [fx("x", "p", 2, 0), fx("y", "q", 2, 0)];
  const first = buildLeagueTable(["x", "y", "p", "q"], results).map(
    (r) => r.teamId,
  );
  // Same inputs in a different order must give the same table — otherwise it
  // reshuffles between page loads with no match played.
  const second = buildLeagueTable(["q", "y", "p", "x"], [...results].reverse())
    .map((r) => r.teamId);
  assert.deepEqual(first, second);
});

test("ranks are 1-based and sequential", () => {
  const t = buildLeagueTable(["a", "b", "c"], [fx("a", "b", 2, 0)]);
  assert.deepEqual(t.map((r) => r.rank), [1, 2, 3]);
});

test("a result naming an unknown team is ignored, not fatal", () => {
  const t = buildLeagueTable(["a", "b"], [fx("a", "ghost", 2, 0), fx("a", "b", 1, 0)]);
  assert.equal(t.find((r) => r.teamId === "a")!.played, 1);
});

/* --- qualification ------------------------------------------------------- */

const table4 = () =>
  buildLeagueTable(
    ["a", "b", "c", "d"],
    [
      fx("a", "b", 2, 0), // a 3pts
      fx("a", "c", 2, 0), // a 6pts
      fx("b", "c", 2, 1), // b 3pts
      fx("c", "d", 2, 0), // c 3pts (but worse legs)
    ],
  );

test("TOP_N takes the best N", () => {
  const q = qualifyingTeams(table4(), { mode: "TOP_N", value: 2 });
  assert.equal(q.length, 2);
  assert.equal(q[0]!.teamId, "a");
});

test("TOP_N larger than the field returns everyone", () => {
  const q = qualifyingTeams(table4(), { mode: "TOP_N", value: 99 });
  assert.equal(q.length, 4);
});

test("TOP_N of zero qualifies nobody", () => {
  assert.equal(qualifyingTeams(table4(), { mode: "TOP_N", value: 0 }).length, 0);
});

test("WIN_COUNT qualifies everyone who reached the target, however many", () => {
  const t = buildLeagueTable(
    ["a", "b", "c", "d"],
    [
      fx("a", "d", 2, 0),
      fx("a", "c", 2, 0), // a: 2 wins
      fx("b", "c", 2, 0),
      fx("b", "d", 2, 0), // b: 2 wins
      fx("c", "d", 2, 0), // c: 1 win
    ],
  );
  const two = qualifyingTeams(t, { mode: "WIN_COUNT", value: 2 });
  assert.deepEqual(two.map((r) => r.teamId).sort(), ["a", "b"]);

  // The rule can legitimately qualify nobody.
  assert.equal(qualifyingTeams(t, { mode: "WIN_COUNT", value: 9 }).length, 0);
  // ...or everyone who has won at all.
  assert.equal(qualifyingTeams(t, { mode: "WIN_COUNT", value: 1 }).length, 3);
});

test("a cut through inseparable teams returns them all, and is reported", () => {
  // b and c are identical on every merit tie-break.
  const t = buildLeagueTable(
    ["a", "b", "c"],
    [fx("b", "a", 2, 0), fx("c", "a", 2, 0)],
  );
  const rule = { mode: "TOP_N" as const, value: 1 };
  const q = qualifyingTeams(t, rule);
  assert.equal(q.length, 2, "both level teams qualify rather than one by id");
  assert.equal(hasAmbiguousCut(t, rule), true);
});

test("a clean cut is not reported as ambiguous", () => {
  assert.equal(
    hasAmbiguousCut(table4(), { mode: "TOP_N", value: 1 }),
    false,
  );
});

test("WIN_COUNT is never ambiguous — the threshold is absolute", () => {
  const t = buildLeagueTable(["a", "b"], [fx("a", "b", 2, 0)]);
  assert.equal(hasAmbiguousCut(t, { mode: "WIN_COUNT", value: 1 }), false);
});

/* --- bracket seeding ----------------------------------------------------- */

test("seeding pairs first with last", () => {
  const { pairings, bye } = seedPairings(["1st", "2nd", "3rd", "4th"]);
  assert.equal(bye, null);
  assert.deepEqual(pairings, [
    { homeTeamId: "1st", awayTeamId: "4th" },
    { homeTeamId: "2nd", awayTeamId: "3rd" },
  ]);
});

test("an odd field gives the top seed a bye", () => {
  const { pairings, bye } = seedPairings(["1st", "2nd", "3rd"]);
  assert.equal(bye, "1st");
  assert.deepEqual(pairings, [{ homeTeamId: "2nd", awayTeamId: "3rd" }]);
});

test("a single qualifier is a bye, not a pairing", () => {
  const { pairings, bye } = seedPairings(["only"]);
  assert.deepEqual(pairings, []);
  assert.equal(bye, "only");
});

test("no qualifiers produces nothing at all", () => {
  const { pairings, bye } = seedPairings([]);
  assert.deepEqual(pairings, []);
  assert.equal(bye, null);
});

test("every qualified team appears exactly once", () => {
  for (const n of [2, 3, 4, 5, 6, 7, 8, 9]) {
    const ids = Array.from({ length: n }, (_, i) => `t${i}`);
    const { pairings, bye } = seedPairings(ids);
    const seen = [...pairings.flatMap((p) => [p.homeTeamId, p.awayTeamId])];
    if (bye) seen.push(bye);
    assert.deepEqual(
      seen.sort(),
      [...ids].sort(),
      `field of ${n} must place every team exactly once`,
    );
  }
});

/* --- round progression --------------------------------------------------- */

test("the next round is chosen by the size of the field", () => {
  assert.equal(nextRoundFor(8), "QUARTER_FINAL");
  assert.equal(nextRoundFor(6), "SEMI_FINAL");
  assert.equal(nextRoundFor(4), "SEMI_FINAL");
  assert.equal(nextRoundFor(3), "FINAL");
  assert.equal(nextRoundFor(2), "FINAL");
});

test("one team left means the competition is over", () => {
  assert.equal(nextRoundFor(1), null);
  assert.equal(nextRoundFor(0), null);
});

test("a four-team league goes straight to the semis, not the quarters", () => {
  // The whole point of sizing by field: no pointless rounds.
  assert.equal(nextRoundFor(4), "SEMI_FINAL");
});

/* --- deciders ------------------------------------------------------------ */

test("a clean cut contests nothing", () => {
  assert.equal(contestedPlaces(table4(), { mode: "TOP_N", value: 1 }), null);
  assert.equal(contestedPlaces(table4(), { mode: "TOP_N", value: 2 }), null);
});

test("two teams level for the last place contest exactly that place", () => {
  // a clear first; b and c must be identical on points AND legs.
  // b beats d 2-0; c beats d 2-0; a beats both b and c 1-0.
  const t = buildLeagueTable(
    ["a", "b", "c", "d"],
    [fx("a", "b", 1, 0), fx("a", "c", 1, 0), fx("b", "d", 2, 0), fx("c", "d", 2, 0)],
  );
  const b = t.find((r) => r.teamId === "b")!;
  const c = t.find((r) => r.teamId === "c")!;
  assert.equal(b.points, c.points, "precondition: b and c are level on points");
  assert.equal(b.legDiff, c.legDiff, "precondition: and on leg difference");

  const contested = contestedPlaces(t, { mode: "TOP_N", value: 2 });
  assert.ok(contested, "a cut through two level teams is contested");
  assert.deepEqual(contested.teamIds.sort(), ["b", "c"]);
  assert.equal(contested.places, 1, "they play for the single remaining place");
});

test("the team already through is NOT dragged into the decider", () => {
  const t = buildLeagueTable(
    ["a", "b", "c"],
    [fx("b", "a", 2, 0), fx("c", "a", 2, 0)],
  );
  // b and c are level and both ahead of a; with 1 place they contest it.
  const contested = contestedPlaces(t, { mode: "TOP_N", value: 1 })!;
  assert.deepEqual(contested.teamIds.sort(), ["b", "c"]);
  assert.ok(!contested.teamIds.includes("a"));
});

test("three teams level for two places is still a decider", () => {
  // b, c, d all beat a once and did nothing else — completely level.
  const t = buildLeagueTable(
    ["a", "b", "c", "d"],
    [fx("b", "a", 1, 0), fx("c", "a", 1, 0), fx("d", "a", 1, 0)],
  );
  const contested = contestedPlaces(t, { mode: "TOP_N", value: 2 })!;
  assert.deepEqual(contested.teamIds.sort(), ["b", "c", "d"]);
  assert.equal(contested.places, 2);
});

test("everyone level with places for all is not contested", () => {
  // Nobody has played: all four identical, and top-4 takes everyone.
  const t = buildLeagueTable(["a", "b", "c", "d"], []);
  assert.equal(contestedPlaces(t, { mode: "TOP_N", value: 4 }), null);
});

test("WIN_COUNT never produces a decider — the threshold is absolute", () => {
  const t = buildLeagueTable(
    ["a", "b", "c"],
    [fx("a", "c", 1, 0), fx("b", "c", 1, 0)],
  );
  // a and b are level, but the rule asks a yes/no question of each team.
  assert.equal(contestedPlaces(t, { mode: "WIN_COUNT", value: 1 }), null);
  assert.equal(hasAmbiguousCut(t, { mode: "WIN_COUNT", value: 1 }), false);
});

test("hasAmbiguousCut agrees with contestedPlaces", () => {
  const cases: [string[], FixtureResult[], number][] = [
    [["a", "b", "c"], [fx("b", "a", 2, 0), fx("c", "a", 2, 0)], 1],
    [["a", "b", "c", "d"], [fx("a", "b", 2, 0)], 2],
    [["a", "b"], [fx("a", "b", 2, 0)], 1],
  ];
  for (const [ids, results, value] of cases) {
    const t = buildLeagueTable(ids, results);
    const rule = { mode: "TOP_N" as const, value };
    assert.equal(
      hasAmbiguousCut(t, rule),
      contestedPlaces(t, rule) !== null,
      `the two must never disagree (top-${value} of ${ids.length})`,
    );
  }
});

test("a decider field always has more teams than places to give", () => {
  // Otherwise the play-off would be pointless — everyone in it would qualify.
  const t = buildLeagueTable(
    ["a", "b", "c", "d"],
    [fx("b", "a", 1, 0), fx("c", "a", 1, 0), fx("d", "a", 1, 0)],
  );
  for (const value of [1, 2, 3]) {
    const c = contestedPlaces(t, { mode: "TOP_N", value });
    if (c) assert.ok(c.teamIds.length > c.places, `top-${value}`);
  }
});
