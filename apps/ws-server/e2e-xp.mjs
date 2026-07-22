import WebSocket from "ws";

const API = "http://localhost:4001";
const WS = "ws://localhost:4002/ws";

async function jfetch(url, opts) {
  const r = await fetch(url, opts);
  const d = await r.json();
  if (!r.ok) throw new Error(`${url} -> ${JSON.stringify(d)}`);
  return d;
}
const post = (path, body, token) =>
  jfetch(API + path, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
const me = (token) =>
  jfetch(`${API}/me`, { headers: { authorization: `Bearer ${token}` } });

function connect(token, battleId) {
  const ws = new WebSocket(WS);
  const seen = [];
  ws.on("message", (raw) => seen.push(JSON.parse(raw.toString())));
  return new Promise((res) =>
    ws.on("open", () => {
      // The socket must complete `hello` before anything else is honoured.
      ws.send(JSON.stringify({ t: "hello", reqId: "r1", token, battleId }));
      res({ ws, seen, send: (m) => ws.send(JSON.stringify(m)) });
    }),
  );
}
const wait = (seen, type, ms = 45000) =>
  new Promise((res, rej) => {
    const t0 = Date.now();
    const iv = setInterval(() => {
      const hit = seen.find((m) => m.t === type);
      if (hit) { clearInterval(iv); res(hit); }
      else if (Date.now() - t0 > ms) { clearInterval(iv); rej(new Error(`timeout ${type}`)); }
    }, 120);
  });

const A = await post("/auth/guest", { displayName: "alpha_xp" });
const B = await post("/auth/guest", { displayName: "bravo_xp" });
console.log("guests created");

const before = await me(A.token);
console.log(`A BEFORE  xp=${before.xp} streak=${before.winStreak} W/L=${before.wins}/${before.losses}`);

const created = await post(
  "/battles",
  { mode: "ONE_V_ONE", difficulty: "EASY", timeLimitSec: 300 },
  A.token,
);
await post("/battles/join", { roomCode: created.roomCode }, B.token);
console.log(`battle ${created.battleId} room ${created.roomCode}`);

const ca = await connect(A.token, created.battleId);
const cb = await connect(B.token, created.battleId);
await wait(ca.seen, "ack");
await wait(cb.seen, "ack");

ca.send({ t: "team:select", side: "A", slot: 0 });
cb.send({ t: "team:select", side: "B", slot: 0 });
await new Promise((r) => setTimeout(r, 400));
ca.send({ t: "player:ready", ready: true });
cb.send({ t: "player:ready", ready: true });
await new Promise((r) => setTimeout(r, 400));
ca.send({ t: "battle:start" });

console.log("A messages:", JSON.stringify(ca.seen.map(m => m.t + (m.code ? ":" + m.code : "") + (m.message ? "(" + m.message + ")" : ""))));
const started = await wait(ca.seen, "battle:start");
const problem = started.problem;
console.log(`started: ${problem.title} (${problem.totalTests} tests)`);

// Solve it properly so A wins by ALL_PASSED.
const solutions = {
  "Sum of Two Numbers": "a,b=map(int,input().split())\nprint(a+b)",
  "Reverse a String": "print(input()[::-1])",
  "Count Vowels": "print(sum(1 for c in input().lower() if c in 'aeiou'))",
};
const src = solutions[problem.title];
if (!src) throw new Error(`no solution for ${problem.title}`);

ca.send({ t: "code:submit", language: "PYTHON", source: src });
const verdict = await wait(ca.seen, "submission:result");
console.log(`verdict ${verdict.result.passed}/${verdict.result.total} ${verdict.result.status}`);

const fin = await wait(ca.seen, "battle:finished");
console.log(`finished: winner ${fin.winnerSide} reason ${fin.reason}`);
console.log(`awards in payload: ${JSON.stringify(fin.awards)}`);

await new Promise((r) => setTimeout(r, 900));
const after = await me(A.token);
const afterB = await me(B.token);
console.log(`A AFTER   xp=${after.xp} streak=${after.winStreak} W/L=${after.wins}/${after.losses}`);
console.log(`B AFTER   xp=${afterB.xp} streak=${afterB.winStreak} W/L=${afterB.wins}/${afterB.losses}`);

const ok =
  fin.awards.length === 2 &&
  after.xp > before.xp &&
  after.wins === before.wins + 1 &&
  afterB.losses >= 1 &&
  after.winStreak >= 1;

console.log(ok ? "\n✅ XP E2E PASS — progression awarded and persisted" : "\n❌ XP E2E FAIL");
process.exit(ok ? 0 : 1);
