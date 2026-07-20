# ꧁⎝ 𓆩༺✧༻𓆪 ⎠꧂ CombatX

Real-time competitive coding battles.

Two teams enter a room and race to solve the **same** problem. Pass every hidden
test first and you win instantly; otherwise the side holding the highest
passed-count when the clock runs out takes it.

The server is authoritative throughout. Opponents never see each other's code —
only a passed-count — and the hidden tests never reach a client.

---

## Quick start

You need **Docker** and nothing else.

```bash
git clone <repo-url> combatX
cd combatX
docker compose up --build
```

Open **<http://localhost:3001>**.

On first boot the stack applies the database schema, seeds the problems, and
installs the Python 3.12 runtime into the code sandbox — automatically. The app
services wait for all of it, so the first request can never hit an unmigrated
database or an empty sandbox.

Developing? Use the hot-reload stack instead:

```bash
docker compose -f docker-compose.dev.yml up --build
```

Full instructions, including running without Docker, are in **[SETUP.md](SETUP.md)**.

### Documentation

| Document | For |
| -------- | --- |
| **[Technical Approach & Architecture](docs/01-technical-approach.pdf)** (PDF) | System design, protocol, judging pipeline, data model |
| **[Why, What & How](docs/02-why-what-how.pdf)** (PDF) | The problem, the audience, and why the design follows |
| **[User Guide](docs/03-user-guide.pdf)** (PDF) | Running it, hosting a battle, playing, troubleshooting |

Or read **[all three combined](docs/combatx-documentation.pdf)**. Sources live in
[`docs-src/`](docs-src/); regenerate with `python3 scripts/make-docs-pdf.py --combined`.

---

## Why CombatX exists

### The problem

Competitive programming has two shapes, and neither is a match you can start
right now with someone you know.

**Practice sites** — LeetCode, HackerRank — are single-player and asynchronous.
You solve a problem, you see a green check. There is no opponent, no clock that
belongs to anyone but you, and no reason to be *first*. The skill they train is
correctness; the skill a contest tests is correctness under pressure.

**Contest platforms** — Codeforces, CodeChef — do have real competition, but
it's scheduled. Rounds run at fixed times, last two hours, and rank you against
thousands of strangers on a rating ladder. That's a serious sport, and it
answers a serious need. It just isn't what a coding club wants on a Thursday
evening, or what two friends want when one says *"bet you can't solve this
faster."*

The gap is the short, spontaneous, head-to-head match. Same problem, both
players, one clock, someone wins. Nothing fills it well — so groups improvise
with a shared screen, a timer, and the honor system.

### Who it's for

Communities and events: bootcamps, university coding clubs, Discord servers,
internal team competitions. Groups that already gather to code and want to run
a bracket, a warm-up round, or a quick grudge match without scheduling around
someone else's contest calendar.

That audience drives the whole design. A club can't ask forty people to
register accounts before a session starts, so play is **guest-only** — pick a
name, get a room code, you're in. And an organizer shouldn't need a DevOps
afternoon to host it, so the entire stack is **one command**.

### Why it's built this way

Three constraints follow directly from "a real-time match, for a group, that
someone must actually be able to run." Each one shaped the architecture:

**A match needs a referee, so the server owns the game.**
Once there's an opponent, every piece of state is contestable — who's ready,
who submitted first, whose clock it is, who won. If any of that lives on the
client, it can be forged, and a contest you can cheat isn't a contest. So
`ws-server` is authoritative: clients send *intent*, never facts. A client
cannot mark itself ready, award itself a point, or end the battle. This is also
why the game rules live in `packages/game` as pure, unit-tested functions —
the thing that decides winners is the part that most needs to be verifiable.

**A contest requires hidden tests, so tests never reach the client.**
If you can read the test cases, you can special-case them, and the score means
nothing. Hidden tests live in Postgres and are read only by `judge-worker`.
Players get a passed-count; the opponent gets *only* a passed-count — enough to
feel the race, not enough to reverse-engineer the problem. That's a hard
boundary, and it's why the judge is a backend service instead of anything that
runs in the browser.

**Running untrusted code is dangerous and slow, so judging is isolated and
queued.**
Every submission is a stranger's code executing on your machine, which is why
it runs in a **Piston** sandbox in its own container. Execution is also slow —
hundreds of milliseconds per test — and a game server that blocks is a game
server that drops frames for everyone in the room. So submissions become
**BullMQ jobs on Redis**; `judge-worker` consumes them and publishes verdicts
back on a pub/sub channel. The socket path stays responsive no matter how many
people hit Run at once, and the judge scales independently of the game server.

One more, less visible: **the client and server can't be allowed to disagree
about the rules.** `packages/protocol` (Zod schemas for every REST body and
socket frame) and `packages/game` are compiled into both the frontend and the
backend. A protocol change that breaks a client is a type error at build time,
not a mystery bug in the middle of someone's tournament.

### Non-goals

No ratings, no ladders, no matchmaking against strangers. CombatX assumes you
already know who you're playing — you're in a room together, physically or on a
call. It's a tool for a group that has gathered, not a platform trying to keep
you online.

---

## Overview

A battle moves through three phases, all driven over a single WebSocket:

1. **Lobby** — players take a seat on Team A or Team B and ready up. The host
   starts once both sides are seated, equal in size, and ready.
2. **Arena** — the server reveals the same problem to both sides and starts the
   clock. Submissions are queued, executed against the hidden tests in a
   sandbox, and the verdict streams back. Opponents see only how many tests the
   other side has cleared.
3. **Results** — first side to pass every test wins immediately (`ALL_PASSED`).
   If the timer expires first, the highest passed-count wins (`TIMEOUT`).

Play is guest-only: pick a display name, get a JWT, share a room code. No
accounts, no passwords.

Modes run from 1v1 up to 4v4. **1v1 ships today**; the larger team modes are
modelled end-to-end and gated in the UI.

---

## Architecture

Four services behind one browser session. The web app talks REST to `http-api`
for everything transactional, then holds a long-lived WebSocket to `ws-server`
for the battle itself.

```
                          ┌──────────────────────┐
                          │   Browser (Next.js)  │
                          │  lobby · arena · UI  │
                          └───────┬──────────┬───┘
                    REST          │          │   WebSocket
              (auth, create/join) │          │  (all gameplay)
                                  ▼          ▼
                    ┌──────────────────┐  ┌──────────────────────┐
                    │     http-api     │  │      ws-server       │
                    │    Express 5     │  │   authoritative      │
                    │                  │  │   game server        │
                    │ POST /auth/guest │  │                      │
                    │ POST /battles    │  │  seats · ready · timer│
                    │ POST /battles/   │  │  scoring · outcome    │
                    │        join      │  │                      │
                    │ GET  /battles/   │  └──────┬───────────▲────┘
                    │       :id/result │         │           │
                    └────────┬─────────┘   enqueue job   verdict
                             │             (BullMQ)     (pub/sub)
                             │                 │           │
              ┌──────────────┴─────────┐       ▼           │
              │                        │  ┌────────────────┴───┐
              ▼                        │  │       Redis        │
      ┌───────────────┐                │  │  queue + pub/sub   │
      │  PostgreSQL   │◄───────────────┘  └─────────┬──────────┘
      │               │                             │ consume
      │ users·battles │                             ▼
      │ problems·tests│                   ┌──────────────────┐
      │ submissions   │◄──────────────────│   judge-worker   │
      │ results       │   read tests,     │     BullMQ       │
      └───────────────┘   write verdict   └────────┬─────────┘
                                                   │ run code
                                                   ▼
                                          ┌──────────────────┐
                                          │      Piston      │
                                          │  sandboxed exec  │
                                          │   (Python 3.12)  │
                                          └──────────────────┘
```

### How a submission flows

1. The player hits **Run** — the client sends the code over the WebSocket.
2. `ws-server` writes a `Submission` row and **enqueues a BullMQ job** on Redis.
   It does not execute anything itself.
3. `judge-worker` pulls the job, loads the problem's hidden tests from Postgres,
   and runs the code in **Piston** once per test case.
4. The worker writes the verdict and **publishes it to a Redis channel**.
5. `ws-server` is subscribed to that channel. It applies the game rules, updates
   the score, and pushes the result to both sides — the submitter sees their
   verdict, the opponent sees only a passed-count.

The queue is what keeps the game server responsive: code execution is slow and
untrusted, so it never happens on the socket's path. The boundaries this
enforces are the ones described in
[Why it's built this way](#why-its-built-this-way) — the server is the sole
authority on game state, hidden tests never leave the backend, and untrusted
code stays isolated in Piston.

### Shared packages

`packages/protocol` and `packages/game` are imported by **both** the frontend
and the servers. The client's view of the wire format and the rules is compiled
from the same source as the server's, so the two cannot drift.

---

## Tech stack

**Monorepo** — [Turborepo](https://turborepo.dev) `2.10` + pnpm `10.19`
workspaces, TypeScript `5.9` in strict ESM throughout.

### Applications

| App                 | Stack                                    | Role                                                       |
| ------------------- | ---------------------------------------- | ---------------------------------------------------------- |
| `apps/web`          | Next.js `16` · React `19` · Tailwind `4` | Lobby, battle arena, results — the whole player-facing app |
| `apps/http-api`     | Express `5`                              | REST: guest auth, create/join a battle, fetch results      |
| `apps/ws-server`    | raw `ws` `8`                             | Authoritative realtime game server                         |
| `apps/judge-worker` | BullMQ `5`                               | Consumes submissions, runs them, publishes verdicts        |

### Shared packages

| Package             | What it holds                                       |
| ------------------- | --------------------------------------------------- |
| `packages/protocol` | Zod schemas for every REST body and WebSocket frame |
| `packages/game`     | Pure game rules — lobby readiness, scoring, outcome  |
| `packages/db`       | Prisma `7` schema, client, and seed data            |
| `packages/auth`     | Guest JWT issue/verify (`jose`)                     |

Plus shared `eslint-config`, `typescript-config`, and `tailwind-config`.

### Infrastructure

- **PostgreSQL 16** — durable record of users, problems, battles, submissions
- **Redis 7** — BullMQ judge queue plus pub/sub for broadcasting verdicts
- **[Piston](https://github.com/engineer-man/piston)** — sandboxed code
  execution (Python 3.12 today; the runtime list is driven by the protocol)
- **Docker Compose** — the entire stack, dev and prod, in one command

### Validation and typing

Zod `3` validates at every boundary — inbound REST bodies, every WebSocket
frame in both directions, and jobs pulled off the queue. Nothing is trusted
because it arrived over a channel that was trusted a moment ago.

---

## Project structure

```
combatX/
├── apps/
│   ├── web/            Next.js frontend
│   ├── http-api/       Express REST API
│   ├── ws-server/      authoritative WebSocket game server
│   └── judge-worker/   BullMQ consumer + Piston client
├── packages/
│   ├── protocol/       Zod wire schemas (REST + WS)
│   ├── game/           pure game rules, unit-tested
│   ├── db/             Prisma schema, client, seeds
│   ├── auth/           guest JWTs
│   └── */              shared eslint / ts / tailwind configs
├── docker/
│   ├── db-init/        migrate + seed init container
│   └── piston-init/    runtime provisioner
├── docker-compose.yml       production stack
└── docker-compose.dev.yml   hot-reload dev stack
```

### Data model

`User` · `Problem` · `TestCase` · `Battle` · `Team` · `TeamMember` ·
`Submission` · `Result` — see `packages/db/prisma/schema.prisma`.

---

## Ports

| Service   | URL                         |
| --------- | --------------------------- |
| Web       | <http://localhost:3001>     |
| HTTP API  | <http://localhost:4001>     |
| WebSocket | `ws://localhost:4002/ws`    |
| Piston    | <http://localhost:2000>     |
| Postgres  | `localhost:5432` (loopback) |
| Redis     | `localhost:6379` (loopback) |

Already running Redis or Postgres? Copy `.env.docker.example` to `.env` and
remap — e.g. `REDIS_PORT=6380`. Details in [SETUP.md](SETUP.md).

---

## Commands

```bash
pnpm dev            # run all four apps with hot reload
pnpm build          # production build, all workspaces
pnpm check-types    # TypeScript
pnpm lint           # ESLint
pnpm format         # Prettier

pnpm --filter @repo/game test        # game-rule unit tests
pnpm --filter @repo/db db:push       # apply schema
pnpm --filter @repo/db db:seed       # seed problems
pnpm --filter @repo/db db:studio     # browse the data
```

Target one app with `pnpm --filter <name> dev`.

---

## Docker images

Each app ships two Dockerfiles: `Dockerfile.dev` (source bind-mounted, hot
reload) and `Dockerfile.prod` (multi-stage, pruned, non-root).

The production images use `turbo prune` so an unrelated app's change doesn't
bust the dependency-install cache, then install production-only dependencies
into a slim runtime layer. The difference is substantial — `web` is **331MB**
in prod versus 1.19GB in dev.

Two init containers make the one-command start possible: **`db-init`** applies
the schema and seeds problems, **`piston-init`** installs the language runtime.
Both are idempotent and gated behind healthchecks.

---

## Status

1v1 battles work end to end — guest auth, lobby, live scoring, sandboxed
judging, instant-win and timeout outcomes, persisted results.

Team modes 2v2 through 4v4 are modelled across the schema, protocol, and rules,
but gated in the UI pending a lobby flow for larger rosters.
