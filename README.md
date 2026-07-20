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
untrusted, so it never happens on the socket's path.

### Why it's split this way

- **`ws-server` is the only authority on game state.** Clients send intent, not
  facts. A client cannot declare itself ready, award itself a point, or end the
  battle.
- **Hidden tests never leave the backend.** They live in Postgres and are read
  only by the worker. The client sees a passed-count, never the cases.
- **The judge is isolated.** Untrusted code runs in Piston, in a separate
  container, reached only by the worker.

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
