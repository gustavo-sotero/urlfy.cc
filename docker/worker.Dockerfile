# ═══════════════════════════════════════════════════════════════════
# apps/worker - Redis Streams Worker Dockerfile (monorepo)
# Build context: repo root (docker build -f docker/worker.Dockerfile .)
# ═══════════════════════════════════════════════════════════════════
# hadolint ignore=DL3006
ARG BUN_VERSION=1.3.11
FROM oven/bun:${BUN_VERSION}-slim AS dependencies

LABEL org.opencontainers.image.source="https://github.com/urlfy/urlfy.cc"
LABEL org.opencontainers.image.description="urlfy.cc — background workers"

WORKDIR /app

COPY package.json bun.lock* bunfig.toml turbo.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY apps/worker/package.json ./apps/worker/
COPY packages/auth-shared/package.json ./packages/auth-shared/
COPY packages/config-biome/package.json ./packages/config-biome/
COPY packages/config-ts/package.json ./packages/config-ts/
COPY packages/contracts/package.json ./packages/contracts/
COPY packages/cache/package.json ./packages/cache/
COPY packages/data/package.json ./packages/data/
COPY packages/email/package.json ./packages/email/
COPY packages/geoip/package.json ./packages/geoip/
COPY packages/redirect-domain/package.json ./packages/redirect-domain/
COPY packages/telemetry/package.json ./packages/telemetry/

RUN bun install --frozen-lockfile --filter=worker

# ═══════════════════════════════════════════════════════════════════
FROM oven/bun:${BUN_VERSION}-slim AS runner
WORKDIR /app

COPY --from=dependencies /app/node_modules ./node_modules
COPY package.json bun.lock* bunfig.toml ./
COPY apps/worker ./apps/worker
COPY packages ./packages

RUN groupadd --system --gid 1001 urlfy && \
    useradd --system --uid 1001 --gid urlfy --no-create-home --shell /usr/sbin/nologin urlfy && \
    mkdir -p /app/geoip && chown urlfy:urlfy /app/geoip

VOLUME /app/geoip

USER urlfy

ENV NODE_ENV=production

WORKDIR /app/apps/worker

HEALTHCHECK --interval=60s --timeout=10s --start-period=20s --retries=3 CMD ["bun", "run", "healthcheck"]

CMD ["bun", "run", "src/index.ts"]
