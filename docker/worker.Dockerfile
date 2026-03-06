# ═══════════════════════════════════════════════════════════════════
# apps/worker - Redis Streams Worker Dockerfile (monorepo)
# Build context: repo root (docker build -f docker/worker.Dockerfile .)
# ═══════════════════════════════════════════════════════════════════
# hadolint ignore=DL3006
FROM oven/bun:slim AS dependencies

LABEL org.opencontainers.image.source="https://github.com/urlfy/urlfy.cc"
LABEL org.opencontainers.image.description="urlfy.cc — background workers"

WORKDIR /app

COPY package.json bun.lock* bunfig.toml turbo.json ./
COPY apps/worker/package.json ./apps/worker/
COPY packages/config-ts/package.json ./packages/config-ts/
COPY packages/contracts/package.json ./packages/contracts/
COPY packages/telemetry/package.json ./packages/telemetry/
COPY packages/cache/package.json ./packages/cache/
COPY packages/data/package.json ./packages/data/

RUN bun install --frozen-lockfile

# ═══════════════════════════════════════════════════════════════════
FROM oven/bun:slim AS runner
WORKDIR /app

COPY --from=dependencies /app/node_modules ./node_modules
COPY package.json bun.lock* bunfig.toml ./
COPY apps/worker ./apps/worker
COPY packages/config-ts ./packages/config-ts
COPY packages/contracts ./packages/contracts
COPY packages/telemetry ./packages/telemetry
COPY packages/cache ./packages/cache
COPY packages/data ./packages/data

RUN groupadd --system --gid 1001 urlfy && \
    useradd --system --uid 1001 --gid urlfy --no-create-home --shell /usr/sbin/nologin urlfy && \
    mkdir -p /app/geoip && chown urlfy:urlfy /app/geoip

VOLUME /app/geoip

USER urlfy

ENV NODE_ENV=production

WORKDIR /app/apps/worker

HEALTHCHECK --interval=60s --timeout=10s --start-period=20s --retries=3 CMD ["bun", "run", "src/healthcheck.ts"]

CMD ["bun", "run", "src/index.ts"]
