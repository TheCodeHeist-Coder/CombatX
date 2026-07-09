# ꧁⎝ 𓆩༺✧༻𓆪 ⎠꧂ CombatX

Real-time competitive coding battles. Two teams race to solve the **same**
problem: pass every hidden test first for an instant win, or hold the highest
passed-count when the clock runs out.

The server is authoritative — opponents never see each other's code, and hidden
tests never reach a client.

---

## Quick start

You need **Docker** and nothing else.

```bash
docker compose up --build
```

Then open **<http://localhost:3001>**.

That single command brings up Postgres, Redis, and the Piston code sandbox,
installs Piston's Python runtime, applies the database schema, seeds three
practice problems, and starts all four application services. Startup is
sequenced with healthchecks, so the first request never hits an unmigrated
database or a sandbox without a language runtime.

To play against yourself, open the app in two browser windows (make the second
a private window so it gets its own guest identity): create a battle in one,
copy the room code, join from the other.

Tear it down with `docker compose down`, or `docker compose down -v` to also
drop the database and Piston volumes.

### Hot-reload development

```bash
docker compose -f docker-compose.dev.yml up --build
```

Identical topology, but the repo is bind-mounted into each container and the
services run under `tsx watch` / `next dev`, so edits on the host reload inside
the containers.

### Configuration

Everything has a working default. To override, copy `.env.docker.example` to
`.env` — compose picks it up automatically.

The one value you **must** change before exposing this to a network is
`JWT_SECRET`.

Note that `NEXT_PUBLIC_API_URL` / `NEXT_PUBLIC_WS_URL` are inlined into the
browser bundle when the `web` image is built, so change them *before*
`--build` if you deploy anywhere other than localhost.

---

## Running without Docker

Requires Node 22+, pnpm 10.19, and Postgres/Redis/Piston reachable locally.

```bash
pnpm install
cp .env.example .env          # then edit as needed
pnpm --filter @repo/db exec prisma db push
pnpm --filter @repo/db exec tsx prisma/seed.ts
pnpm dev
```

`pnpm dev` starts all four services via Turborepo.

---

## Architecture

```
                      ┌──────────┐
  browser ──HTTP──▶   │ http-api │  REST: guest auth, create/join, results
                      └────┬─────┘
                           │
  browser ──WebSocket─▶ ┌──┴────────┐   lobby, countdown, live scores,
                        │ ws-server │   submissions, finish  (authoritative)
                        └──┬────────┘
                           │ BullMQ (Redis)
                        ┌──┴──────────┐
                        │ judge-worker│ ─── Piston sandbox (runs the code)
                        └─────────────┘
```

| Path                | What it is                                                  |
| ------------------- | ----------------------------------------------------------- |
| `apps/web`          | Next.js frontend — lobby, battle arena, results             |
| `apps/http-api`     | Express REST API (auth, battle lifecycle)                   |
| `apps/ws-server`    | Authoritative realtime game server (raw `ws`)               |
| `apps/judge-worker` | BullMQ consumer; executes submissions via Piston            |
| `packages/protocol` | Zod schemas shared by client and server — the wire contract |
| `packages/game`     | Pure game rules (lobby readiness, scoring, outcome)         |
| `packages/db`       | Prisma 7 schema, client, and seed                           |
| `packages/auth`     | Guest JWT issue/verify                                      |

Because `packages/protocol` and `packages/game` are imported by both the
frontend and the servers, the client's view of the rules can never drift from
the server's.

### How a battle runs

1. Each player takes a seat and readies up. The host starts.
2. The server reveals the **same** problem to both sides and starts the clock.
3. A submission is enqueued to Redis; `judge-worker` runs it in Piston against
   the hidden tests and publishes the verdict.
4. Opponents see only a passed-count — never source.
5. First side to pass every test wins instantly; otherwise the highest
   passed-count wins when time expires.

---

## Ports

| Service   | Port   |
| --------- | ------ |
| web       | `3001` |
| http-api  | `4001` |
| ws-server | `4002` |
| piston    | `2000` |
| postgres  | `5432` |
| redis     | `6379` |

If you already run Postgres or Redis locally, stop them first or remap the
`ports:` entries in the compose file.

---

## Commands

```bash
pnpm dev           # all services, hot reload
pnpm build         # build every app and package
pnpm lint          # eslint, zero warnings tolerated
pnpm check-types   # tsc --noEmit across the workspace
```
