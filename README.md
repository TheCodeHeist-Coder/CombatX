# ꧁⎝ 𓆩༺✧༻𓆪 ⎠꧂ CombatX

Real-time competitive coding battles.

Two teams enter a room and race to solve the **same** problem. Pass every hidden
test first and you win instantly; otherwise the side holding the highest
passed-count when the clock runs out takes it.

The server is authoritative throughout. Opponents never see each other's code —
only a passed-count — and the hidden tests never reach a client.

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

## Tech stack

**Monorepo** — [Turborepo](https://turborepo.dev) `2.10` + pnpm `10.19`
workspaces, TypeScript `5.9` in strict ESM throughout.

### Applications

| App                 | Stack                              | Role                                                       |
| ------------------- | ---------------------------------- | ---------------------------------------------------------- |
| `apps/web`          | Next.js `16` · React `19` · Tailwind `4` | Lobby, battle arena, results — the whole player-facing app |
| `apps/http-api`     | Express `5`                        | REST: guest auth, create/join a battle, fetch results      |
| `apps/ws-server`    | raw `ws` `8`                       | Authoritative realtime game server                         |
| `apps/judge-worker` | BullMQ `5`                         | Consumes submissions, runs them, publishes verdicts        |

### Shared packages

| Package             | What it holds                                              |
| ------------------- | ---------------------------------------------------------- |
| `packages/protocol` | Zod schemas for every REST body and WebSocket frame        |
| `packages/game`     | Pure game rules — lobby readiness, scoring, outcome         |
| `packages/db`       | Prisma `7` schema, client, and seed data                    |
| `packages/auth`     | Guest JWT issue/verify (`jose`)                             |

`protocol` and `game` are imported by both the frontend and the servers, so the
client's view of the wire format and the rules can never drift from the
server's.

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
