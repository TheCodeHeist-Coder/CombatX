import assert from "node:assert/strict";
import { test } from "node:test";
import {
  checkInstantWin,
  resolveOnTimeout,
  type JudgedSubmission,
} from "./outcome.js";
import { canStart, startBlockedReason, type LobbyPlayer } from "./lobby.js";
import { seededPick } from "./rng.js";

const sub = (
  o: Partial<JudgedSubmission> & Pick<JudgedSubmission, "side" | "passed">,
): JudgedSubmission => ({
  submissionId: o.submissionId ?? `${o.side}-${o.passed}-${o.submittedAt ?? 0}`,
  total: o.total ?? 10,
  submittedAt: o.submittedAt ?? 0,
  ...o,
});

test("instant win: first all-pass submission wins immediately", () => {
  const subs = [
    sub({ side: "A", passed: 7, submittedAt: 100 }),
    sub({ side: "B", passed: 10, total: 10, submittedAt: 200 }),
  ];
  const outcome = checkInstantWin(subs);
  assert.ok(outcome);
  assert.equal(outcome.winnerSide, "B");
  assert.equal(outcome.reason, "ALL_PASSED");
});

test("instant win: none when nobody passed all", () => {
  const subs = [
    sub({ side: "A", passed: 9, total: 10 }),
    sub({ side: "B", passed: 8, total: 10 }),
  ];
  assert.equal(checkInstantWin(subs), null);
});

test("instant win race: earliest all-pass wins", () => {
  const subs = [
    sub({ side: "B", passed: 10, total: 10, submittedAt: 500 }),
    sub({ side: "A", passed: 10, total: 10, submittedAt: 300 }),
  ];
  const outcome = checkInstantWin(subs)!;
  assert.equal(outcome.winnerSide, "A");
});

test("timeout: higher passed-count wins", () => {
  const subs = [
    sub({ side: "A", passed: 6, total: 10 }),
    sub({ side: "B", passed: 4, total: 10 }),
  ];
  const outcome = resolveOnTimeout(subs);
  assert.equal(outcome.winnerSide, "A");
  assert.equal(outcome.reason, "TIMEOUT");
});

test("timeout tie: earliest submission achieving best count wins", () => {
  const subs = [
    sub({ side: "A", passed: 5, total: 10, submittedAt: 900 }),
    sub({ side: "B", passed: 5, total: 10, submittedAt: 400 }),
  ];
  const outcome = resolveOnTimeout(subs);
  assert.equal(outcome.winnerSide, "B");
});

test("timeout with no submissions => draw", () => {
  const outcome = resolveOnTimeout([]);
  assert.equal(outcome.winnerSide, null);
});

test("canStart requires equal, ready, both-sided teams", () => {
  const players: LobbyPlayer[] = [
    { userId: "u1", side: "A", slot: 0, ready: true },
    { userId: "u2", side: "B", slot: 0, ready: true },
  ];
  assert.equal(canStart(players), true);
  players[1]!.ready = false;
  assert.equal(canStart(players), false);
  assert.match(startBlockedReason(players)!, /ready/);
});

test("canStart blocks unequal teams", () => {
  const players: LobbyPlayer[] = [
    { userId: "u1", side: "A", slot: 0, ready: true },
    { userId: "u2", side: "A", slot: 1, ready: true },
    { userId: "u3", side: "B", slot: 0, ready: true },
  ];
  assert.equal(canStart(players), false);
  assert.match(startBlockedReason(players)!, /equal/);
});

test("seededPick is deterministic for the same seed", () => {
  const items = ["p1", "p2", "p3", "p4", "p5"];
  const a = seededPick(items, "battle-xyz");
  const b = seededPick(items, "battle-xyz");
  assert.equal(a, b);
  assert.equal(seededPick([], "x"), null);
});
