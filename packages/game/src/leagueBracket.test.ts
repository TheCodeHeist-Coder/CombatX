import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildBracket,
  championOf,
  leagueProgress,
  teamPath,
  type BracketFixture,
} from "./leagueBracket.js";

const fx = (o: Partial<BracketFixture> & { round: string }): BracketFixture => ({
  id: o.id ?? `${o.round}-${o.homeTeamId ?? "h"}-${o.awayTeamId ?? "a"}`,
  status: o.status ?? "SCHEDULED",
  homeTeamId: o.homeTeamId ?? "h",
  homeTeamName: o.homeTeamName ?? "Home",
  awayTeamId: o.awayTeamId ?? "a",
  awayTeamName: o.awayTeamName ?? "Away",
  winnerTeamId: o.winnerTeamId ?? null,
  homeScore: o.homeScore ?? 0,
  awayScore: o.awayScore ?? 0,
  ...o,
});

test("a league with no knockout has no bracket", () => {
  // Three empty columns would promise a knockout the host may never draw.
  assert.deepEqual(buildBracket([fx({ round: "GROUP" })]), []);
});

test("group and tiebreak matches never appear as bracket columns", () => {
  const cols = buildBracket([
    fx({ round: "GROUP" }),
    fx({ round: "TIEBREAK" }),
    fx({ round: "FINAL" }),
  ]);
  assert.deepEqual(cols.map((c) => c.round), ["FINAL"]);
});

test("columns come back in playing order", () => {
  const cols = buildBracket([
    fx({ round: "FINAL" }),
    fx({ round: "QUARTER_FINAL" }),
    fx({ round: "SEMI_FINAL" }),
  ]);
  assert.deepEqual(
    cols.map((c) => c.round),
    ["QUARTER_FINAL", "SEMI_FINAL", "FINAL"],
  );
});

test("a cancelled fixture is not drawn", () => {
  const cols = buildBracket([
    fx({ round: "SEMI_FINAL", id: "keep" }),
    fx({ round: "SEMI_FINAL", id: "gone", status: "CANCELLED" }),
  ]);
  assert.deepEqual(cols[0]!.fixtures.map((f) => f.id), ["keep"]);
});

test("a round of only cancelled matches disappears entirely", () => {
  assert.deepEqual(
    buildBracket([fx({ round: "SEMI_FINAL", status: "CANCELLED" })]),
    [],
  );
});

test("the final always holds exactly one slot", () => {
  const cols = buildBracket([fx({ round: "FINAL" })]);
  assert.equal(cols[0]!.slots, 1);
});

test("an undrawn later round does not shrink an earlier one", () => {
  // Two semis exist; the final is not drawn. The semis keep both slots.
  const cols = buildBracket([
    fx({ round: "SEMI_FINAL", id: "s1" }),
    fx({ round: "SEMI_FINAL", id: "s2" }),
  ]);
  assert.equal(cols[0]!.slots, 2);
});

test("a half-drawn round is still sized by what it feeds", () => {
  /*
   * One semi drawn, and a final that needs two.
   *
   * The semis column reserves BOTH places. Sizing it to the single fixture
   * that exists centred that lone card against a full-height neighbour, and
   * its connector then ran into empty space instead of into the final — which
   * is exactly what a screenshot of a part-scheduled league showed.
   */
  const cols = buildBracket([
    fx({ round: "SEMI_FINAL", id: "s1" }),
    fx({ round: "FINAL", id: "f" }),
  ]);
  assert.equal(cols[0]!.slots, 2, "two semis feed one final");
  assert.equal(cols[0]!.fixtures.length, 1, "but only one is actually drawn");
});

test("a lone quarter still reserves the full round beside two semis", () => {
  const cols = buildBracket([
    fx({ round: "QUARTER_FINAL", id: "q1" }),
    fx({ round: "SEMI_FINAL", id: "s1" }),
    fx({ round: "SEMI_FINAL", id: "s2" }),
  ]);
  assert.deepEqual(cols.map((c) => c.slots), [4, 2, 1]);
  assert.equal(cols[0]!.fixtures.length, 1);
});

test("a full four-team bracket has 2 semis feeding 1 final", () => {
  const cols = buildBracket([
    fx({ round: "SEMI_FINAL", id: "s1" }),
    fx({ round: "SEMI_FINAL", id: "s2" }),
    fx({ round: "FINAL", id: "f" }),
  ]);
  assert.deepEqual(cols.map((c) => c.slots), [2, 1]);
});

test("a team's path reads in playing order", () => {
  const path = teamPath(
    [
      fx({ round: "FINAL", homeTeamId: "me", winnerTeamId: "other", awayTeamId: "other", awayTeamName: "Rivals" }),
      fx({ round: "GROUP", homeTeamId: "me", winnerTeamId: "me", awayTeamId: "x", awayTeamName: "Xs" }),
      fx({ round: "SEMI_FINAL", homeTeamId: "me", winnerTeamId: "me", awayTeamId: "y", awayTeamName: "Ys" }),
    ],
    "me",
  );
  assert.deepEqual(path.map((p) => p.fixture.round), ["GROUP", "SEMI_FINAL", "FINAL"]);
  assert.deepEqual(path.map((p) => p.won), [true, true, false]);
  assert.deepEqual(path.map((p) => p.opponentName), ["Xs", "Ys", "Rivals"]);
});

test("a path names the opponent from whichever side the team was on", () => {
  const path = teamPath(
    [fx({ round: "FINAL", homeTeamId: "other", homeTeamName: "Them", awayTeamId: "me" })],
    "me",
  );
  assert.equal(path[0]!.opponentName, "Them");
});

test("an unplayed match in a path is neither won nor lost", () => {
  const path = teamPath([fx({ round: "FINAL", homeTeamId: "me" })], "me");
  assert.equal(path[0]!.won, null);
});

test("a drawn match is not a win", () => {
  const path = teamPath(
    [fx({ round: "GROUP", homeTeamId: "me", status: "COMPLETED", winnerTeamId: null })],
    "me",
  );
  assert.equal(path[0]!.won, null);
});

test("the champion comes from a decided final", () => {
  assert.equal(
    championOf([fx({ round: "FINAL", status: "COMPLETED", winnerTeamId: "w" })]),
    "w",
  );
});

test("an unfinished or drawn final has no champion", () => {
  assert.equal(championOf([fx({ round: "FINAL", status: "LIVE" })]), null);
  assert.equal(
    championOf([fx({ round: "FINAL", status: "COMPLETED", winnerTeamId: null })]),
    null,
  );
  assert.equal(championOf([fx({ round: "SEMI_FINAL", status: "COMPLETED", winnerTeamId: "w" })]), null);
});

test("progress counts the whole competition, group stage included", () => {
  const p = leagueProgress([
    fx({ round: "GROUP", status: "COMPLETED" }),
    fx({ round: "GROUP", status: "SCHEDULED" }),
    fx({ round: "FINAL", status: "SCHEDULED" }),
  ]);
  assert.deepEqual(p, { played: 1, total: 3 });
});

test("cancelled matches count toward neither played nor total", () => {
  const p = leagueProgress([
    fx({ round: "GROUP", status: "COMPLETED" }),
    fx({ round: "GROUP", status: "CANCELLED" }),
  ]);
  assert.deepEqual(p, { played: 1, total: 1 });
});

test("an empty league reports no progress rather than dividing by zero", () => {
  assert.deepEqual(leagueProgress([]), { played: 0, total: 0 });
});

test("an undrawn final is projected so the semis connect to something", () => {
  const cols = buildBracket([
    fx({ round: "SEMI_FINAL", id: "s1" }),
    fx({ round: "SEMI_FINAL", id: "s2" }),
  ]);
  assert.deepEqual(cols.map((c) => c.round), ["SEMI_FINAL", "FINAL"]);
  assert.equal(cols[1]!.slots, 1);
  assert.deepEqual(cols[1]!.fixtures, [], "a projected round holds no matches");
});

test("four quarters project both a semi round and a final", () => {
  const cols = buildBracket(
    ["q1", "q2", "q3", "q4"].map((id) => fx({ round: "QUARTER_FINAL", id })),
  );
  assert.deepEqual(
    cols.map((c) => c.round),
    ["QUARTER_FINAL", "SEMI_FINAL", "FINAL"],
  );
  assert.deepEqual(cols.map((c) => c.slots), [4, 2, 1]);
});

test("a drawn final is never projected over", () => {
  const cols = buildBracket([
    fx({ round: "SEMI_FINAL", id: "s1" }),
    fx({ round: "SEMI_FINAL", id: "s2" }),
    fx({ round: "FINAL", id: "f", status: "COMPLETED", winnerTeamId: "h" }),
  ]);
  assert.equal(cols.length, 2);
  assert.equal(cols[1]!.fixtures.length, 1, "the real final, not a placeholder");
});

test("a lone final projects nothing beyond itself", () => {
  const cols = buildBracket([fx({ round: "FINAL" })]);
  assert.deepEqual(cols.map((c) => c.round), ["FINAL"]);
});

test("projection never invents a knockout where none was drawn", () => {
  assert.deepEqual(buildBracket([fx({ round: "GROUP" })]), []);
});
