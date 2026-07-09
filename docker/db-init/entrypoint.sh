#!/bin/sh
# Apply the Prisma schema and seed baseline problems, then exit.
#
# Both steps are idempotent: `db push` converges the schema and the seed
# upserts, so compose can run this on every `up` and gate the apps on it.
set -eu

log() { echo "[db-init] $*"; }

: "${DATABASE_URL:?DATABASE_URL is required}"

# Compose gates us on postgres' healthcheck, but the server can still refuse a
# connection for a moment after that. Retry only on connection failure; a bad
# schema or a CLI usage error should fail immediately rather than loop.
log "waiting for Postgres to accept connections ..."
i=0
until node -e "
  const net = require('net');
  const u = new URL(process.env.DATABASE_URL);
  const s = net.connect(Number(u.port || 5432), u.hostname);
  s.on('connect', () => { s.end(); process.exit(0); });
  s.on('error', () => process.exit(1));
" 2>/dev/null; do
  i=$((i + 1))
  if [ "$i" -gt 60 ]; then
    log "ERROR: Postgres never accepted a connection"
    exit 1
  fi
  sleep 1
done
log "Postgres is accepting connections."

# Prisma 7 reads the datasource URL from prisma.config.ts and dropped the
# --skip-generate flag; the client is already generated into the image.
log "applying schema (prisma db push) ..."
pnpm exec prisma db push

log "seeding problems ..."
pnpm exec tsx prisma/seed.ts

log "done."
