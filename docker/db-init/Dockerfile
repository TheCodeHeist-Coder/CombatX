# syntax=docker/dockerfile:1.7
###############################################################################
# db-init — one-shot schema + seed container.
#
# Multi-stage: pinned pnpm base -> install @repo/db -> generate client -> run.
# Applies the schema (`prisma db push`) then seeds problems, then exits 0. Both
# steps are idempotent, so compose can run this on every `up` and gate the apps
# on its successful completion.
#
# Built from the MONOREPO ROOT as context:
#   docker build -f docker/db-init/Dockerfile .
###############################################################################

ARG NODE_VERSION=22-alpine
ARG PNPM_VERSION=10.19.0

FROM node:${NODE_VERSION} AS base
ARG PNPM_VERSION
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME/bin:$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate
WORKDIR /app

# ---------------------------------------------------------------------------
# pruner — @repo/db is self-contained (the seed only needs the Prisma client),
# so prune to it and skip the rest of the workspace entirely.
# ---------------------------------------------------------------------------
FROM base AS pruner
COPY . .
RUN pnpm dlx turbo@^2 prune @repo/db --docker

# ---------------------------------------------------------------------------
# deps — install with devDependencies: `prisma` (CLI) and `tsx` (seed runner)
# both live there.
# ---------------------------------------------------------------------------
FROM base AS deps
COPY --from=pruner /app/out/json/ ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile

# ---------------------------------------------------------------------------
# runner — schema, seed, and a generated client to run them with.
# ---------------------------------------------------------------------------
FROM base AS runner
ENV NODE_ENV=production

COPY --from=deps /app/ ./
COPY --from=pruner /app/out/full/ ./

# `prisma db push` needs the client generated to resolve the schema's output.
RUN pnpm --filter @repo/db exec prisma generate

WORKDIR /app/packages/db

COPY docker/db-init/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
