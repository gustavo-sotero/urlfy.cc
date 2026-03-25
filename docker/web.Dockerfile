# ═══════════════════════════════════════════════════════════════════
# apps/web - Next.js 16 Dockerfile (monorepo)
# Build context: repo root (docker build -f docker/web.Dockerfile .)
# ═══════════════════════════════════════════════════════════════════
# hadolint ignore=DL3006
ARG BUN_VERSION=1.3.11
FROM oven/bun:${BUN_VERSION}-slim AS dependencies

LABEL org.opencontainers.image.source="https://github.com/urlfy/urlfy.cc"
LABEL org.opencontainers.image.description="urlfy.cc — web frontend"

WORKDIR /app

# Workspace manifests — install all workspace deps at root
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

RUN bun install --frozen-lockfile --filter=web

# ═══════════════════════════════════════════════════════════════════
FROM oven/bun:${BUN_VERSION}-slim AS builder
WORKDIR /app

COPY --from=dependencies /app/node_modules ./node_modules

COPY package.json bun.lock* bunfig.toml turbo.json ./
COPY apps/web ./apps/web
COPY packages ./packages

ARG NEXT_PUBLIC_APP_URL=http://localhost:3000
ENV NEXT_TELEMETRY_DISABLED=1
ENV SKIP_ENV_VALIDATION=1
ENV NODE_ENV=production
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL

WORKDIR /app/apps/web
RUN bun run build

# ═══════════════════════════════════════════════════════════════════
FROM oven/bun:${BUN_VERSION}-slim AS runner
WORKDIR /app

RUN apt-get update && \
    apt-get install -y --no-install-recommends curl ca-certificates && \
    rm -rf /var/lib/apt/lists/* && \
    groupadd --system --gid 1001 urlfy && \
    useradd --system --uid 1001 --gid urlfy --no-create-home --shell /usr/sbin/nologin urlfy && \
    mkdir -p .next/cache /app/geoip && \
    chown -R urlfy:urlfy .next /app/geoip

COPY --from=builder --chown=urlfy:urlfy /app/apps/web/.next/standalone ./
COPY --from=builder --chown=urlfy:urlfy /app/apps/web/.next/static ./.next/static

VOLUME /app/geoip

USER urlfy
EXPOSE 3000

ENV PORT=3000
ENV NODE_ENV=production

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -fsS http://localhost:3000/api/health/ready || exit 1

CMD ["bun", "server.js"]
