#!/bin/sh
# Apply the Prisma schema and seed baseline problems, then exit.
#
# Both steps are idempotent: `db push` converges the schema, and the seed
# upserts. Compose gates the app containers on this completing successfully.
set -eu

log() { echo "[db-init] $*"; }

: "${DATABASE_URL:?DATABASE_URL is required}"

# Compose already gates us on postgres' own healthcheck, but `db push` fails
# hard on a refused connection, so retry briefly to absorb the startup race.
log "applying schema (prisma db push) ..."
i=0
until pnpm exec prisma db push --skip-generate; do
  i=$((i + 1))
  if [ "$i" -ge 10 ]; then
    log "ERROR: could not apply schema after ${i} attempts"
    exit 1
  fi
  log "database not ready yet, retrying (${i}/10) ..."
  sleep 3
done

log "seeding problems ..."
pnpm exec tsx prisma/seed.ts

log "done."
