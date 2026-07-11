# Setup

Two ways to run CombatX:

- **[Docker](#option-a--docker-recommended)** — one command, nothing to install. Best for just running it.
- **[Local](#option-b--local-no-docker)** — run the apps on your host with hot reload. Best for day-to-day development.

---

## Option A — Docker (recommended)

### Prerequisites

Docker Desktop (or Docker Engine + the Compose plugin). Nothing else — no Node,
no pnpm, no Postgres.

### Run it

```bash
git clone <repo-url> combatX
cd combatX
docker compose up --build
```

Then open **<http://localhost:3001>**.

That's the whole setup. On first boot the stack automatically applies the
database schema, seeds the problems, and installs the Python 3.12 runtime into
the code sandbox. The app services wait for all of that to finish, so the first
request can never hit an unmigrated database or an empty sandbox.

First build takes a few minutes. Subsequent starts are seconds.

To stop:

```bash
docker compose down          # keep the database
docker compose down -v       # wipe the database too
```

### Development, with hot reload

```bash
docker compose -f docker-compose.dev.yml up --build
```

Same stack, but your source is bind-mounted and the servers restart on change —
edit a file on your host and the containers pick it up in about a second.

### Ports

| Service   | URL                            |
| --------- | ------------------------------ |
| Web       | <http://localhost:3001>        |
| HTTP API  | <http://localhost:4001>        |
| WebSocket | `ws://localhost:4002/ws`       |
| Piston    | <http://localhost:2000>        |
| Postgres  | `localhost:5432` (loopback)    |
| Redis     | `localhost:6379` (loopback)    |

### If a port is already taken

The most common clash is **Redis on 6379**. Copy `.env.docker.example` to `.env`
and remap:

```bash
cp .env.docker.example .env
echo "REDIS_PORT=6380" >> .env
```

Compose reads `.env` automatically. Every value in it already has a working
default, so you only need the lines you actually want to change. The same
applies to `POSTGRES_PORT` and `PISTON_PORT`.

> Changing `NEXT_PUBLIC_API_URL` / `NEXT_PUBLIC_WS_URL` requires a rebuild
> (`--build`) — they are inlined into the browser bundle at image-build time.

---

## Option B — Local (no Docker)

### Prerequisites

- **Node.js ≥ 18** and **pnpm 10.19** (`corepack enable` will pin it for you)
- **PostgreSQL 16** running locally
- **Redis 7** running locally
- **Piston** for sandboxed code execution — see [below](#piston)

### 1. Install

```bash
git clone <repo-url> combatX
cd combatX
corepack enable
pnpm install
```

### 2. Environment

Three env files, each with a committed example. Copy them:

```bash
cp .env.example .env
cp apps/web/.env.example apps/web/.env.local
cp packages/db/.env.example packages/db/.env
```

| File                 | Used by                        |
| -------------------- | ------------------------------ |
| `.env`               | http-api, ws-server, judge-worker |
| `apps/web/.env.local`| the browser bundle             |
| `packages/db/.env`   | Prisma CLI (migrate, seed, studio) |

The defaults assume Postgres on `localhost:5432` with user/password
`postgres`/`postgres` and a database named `combateone`. Adjust `DATABASE_URL`
in **both** `.env` and `packages/db/.env` if yours differs — they must match.

Set `JWT_SECRET` to any long random string for local work.

### 3. Database

Create the database, then apply the schema and seed the problems:

```bash
createdb combateone

pnpm --filter @repo/db db:push     # apply the schema
pnpm --filter @repo/db db:seed     # insert the problems
```

Useful later:

```bash
pnpm --filter @repo/db db:studio   # browse the data in a GUI
```

### Piston

The judge executes submitted code in a [Piston](https://github.com/engineer-man/piston)
sandbox. Easiest is to run just that one piece in Docker:

```bash
docker run -d --name piston -p 2000:2000 --privileged \
  ghcr.io/engineer-man/piston:latest
```

Then install the Python runtime (once):

```bash
curl -X POST http://localhost:2000/api/v2/packages \
  -H 'Content-Type: application/json' \
  -d '{"language":"python","version":"3.12.0"}'
```

Verify it took:

```bash
curl http://localhost:2000/api/v2/runtimes
# -> [{"language":"python","version":"3.12.0", ...}]
```

Without this, submissions will fail to run — the sandbox has no language
installed by default.

### 4. Start everything

```bash
pnpm dev
```

This runs all four apps together. Open **<http://localhost:3001>**.

To run just one:

```bash
pnpm --filter web dev
pnpm --filter http-api dev
pnpm --filter ws-server dev
pnpm --filter judge-worker dev
```

---

## Verifying your setup

Open <http://localhost:3001>, create a battle, and copy the room code. Open a
second browser (or an incognito window), join with that code, seat both players
on opposite teams, ready up, and start.

A quicker smoke test:

```bash
curl http://localhost:4001/health    # -> {"ok":true}
curl http://localhost:4002/health    # -> {"ok":true}
curl http://localhost:2000/api/v2/runtimes   # -> python 3.12 listed
```

---

## Checks

```bash
pnpm check-types    # TypeScript, all workspaces
pnpm lint           # ESLint
pnpm build          # production build
pnpm --filter @repo/game test   # game-rule unit tests
```

All four should pass on a clean checkout.

---

## Troubleshooting

**`pnpm dev` exits immediately, or complains about concurrency.**
You need turbo's concurrency raised above the number of persistent dev tasks.
This is already set in `turbo.json` — if you hit it, you're on an older
checkout. Pull latest.

**Submissions hang or every test fails.**
Piston has no runtime installed. Run the `POST /api/v2/packages` call above and
confirm `GET /api/v2/runtimes` lists Python.

**`Cannot find module '@repo/db'` or similar.**
Build the workspace packages first: `pnpm build`. The apps import compiled
output from `packages/*`.

**Port already in use (Docker).**
See [If a port is already taken](#if-a-port-is-already-taken).

**A file under `apps/` is owned by `root` and you can't build.**
An old dev-container run wrote into the bind-mounted source. Delete the
offending directory (e.g. `sudo rm -rf apps/web/.next`) and rebuild.
