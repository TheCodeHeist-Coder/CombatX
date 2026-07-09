#!/bin/sh
# Provision the Piston sandbox with the language runtimes CombatX supports.
#
# Runs as a one-shot init container: wait for Piston's API, install any runtime
# that isn't already present, verify, then exit 0. Installing a runtime that is
# already installed is a no-op, so this is safe on every `docker compose up`.
#
# Versions MUST match PISTON_RUNTIME in packages/protocol/src/enums.ts.
set -eu

PISTON_URL="${PISTON_URL:-http://piston:2000/api/v2}"

# Space-separated "language:version" pairs. Phase 1 ships Python only; add more
# here as the protocol enables them.
RUNTIMES="python:3.12.0"

log() { echo "[piston-init] $*"; }

command -v curl >/dev/null 2>&1 || {
  log "installing curl ..."
  apk add --no-cache curl >/dev/null 2>&1
}

log "waiting for Piston at ${PISTON_URL} ..."
i=0
until curl -fsS "${PISTON_URL}/runtimes" >/dev/null 2>&1; do
  i=$((i + 1))
  if [ "$i" -gt 120 ]; then
    log "ERROR: Piston did not become ready within 120s"
    exit 1
  fi
  sleep 1
done
log "Piston is up."

for pair in $RUNTIMES; do
  lang="${pair%%:*}"
  ver="${pair##*:}"

  if curl -fsS "${PISTON_URL}/runtimes" \
      | grep -q "\"language\":\"${lang}\"[^}]*\"version\":\"${ver}\""; then
    log "${lang} ${ver} already installed — skipping."
    continue
  fi

  log "installing ${lang} ${ver} (first run downloads the runtime, be patient) ..."
  if ! curl -fsS -X POST "${PISTON_URL}/packages" \
        -H 'Content-Type: application/json' \
        -d "{\"language\":\"${lang}\",\"version\":\"${ver}\"}"; then
    log "ERROR: failed to install ${lang} ${ver}"
    exit 1
  fi
  echo
  log "installed ${lang} ${ver}."
done

log "verifying runtimes ..."
if ! curl -fsS "${PISTON_URL}/runtimes" | grep -q '"language":"python"'; then
  log "ERROR: python runtime missing after provisioning"
  exit 1
fi

log "done — Piston is ready to judge."
