# ═══════════════════════════════════════════════════════════════════
# apps/api - Elysia HTTP Server Dockerfile (monorepo)
# Build context: repo root (docker build -f docker/api.Dockerfile .)
# ═══════════════════════════════════════════════════════════════════
# hadolint ignore=DL3006
ARG BUN_VERSION=1.3.11
FROM oven/bun:${BUN_VERSION}-slim AS dependencies

LABEL org.opencontainers.image.source="https://github.com/urlfy/urlfy.cc"
LABEL org.opencontainers.image.description="urlfy.cc — API server"

WORKDIR /app

COPY package.json bun.lock* bunfig.toml turbo.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY apps/worker/package.json ./apps/worker/
COPY packages/auth-shared/package.json ./packages/auth-shared/
COPY packages/cache/package.json ./packages/cache/
COPY packages/config-biome/package.json ./packages/config-biome/
COPY packages/config-ts/package.json ./packages/config-ts/
COPY packages/contracts/package.json ./packages/contracts/
COPY packages/data/package.json ./packages/data/
COPY packages/email/package.json ./packages/email/
COPY packages/geoip/package.json ./packages/geoip/
COPY packages/redirect-domain/package.json ./packages/redirect-domain/
COPY packages/telemetry/package.json ./packages/telemetry/

RUN bun install --frozen-lockfile --filter=@urlfy/api

# ═══════════════════════════════════════════════════════════════════
FROM oven/bun:${BUN_VERSION}-slim AS builder
WORKDIR /app

COPY --from=dependencies /app/node_modules ./node_modules
COPY package.json bun.lock* bunfig.toml turbo.json ./
COPY apps/api ./apps/api
COPY packages ./packages

WORKDIR /app/apps/api
RUN bun build src/index.ts --outdir dist --target bun --minify

# ═══════════════════════════════════════════════════════════════════
FROM oven/bun:${BUN_VERSION}-slim AS runner
WORKDIR /app

RUN apt-get update && \
    apt-get install -y --no-install-recommends curl ca-certificates && \
    rm -rf /var/lib/apt/lists/* && \
    groupadd --system --gid 1001 urlfy && \
    useradd --system --uid 1001 --gid urlfy --no-create-home --shell /usr/sbin/nologin urlfy

COPY --from=builder --chown=urlfy:urlfy /app/apps/api/dist ./dist
COPY --from=builder --chown=urlfy:urlfy /app/node_modules ./node_modules

USER urlfy
EXPOSE 3001

ENV PORT=3001
ENV NODE_ENV=production

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -fsS http://localhost:3001/api/health/ready || exit 1

CMD ["bun", "dist/index.js"]
