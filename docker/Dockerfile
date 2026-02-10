# ═══════════════════════════════════════════════════════════════════
# STAGE 1: Dependencies
# ═══════════════════════════════════════════════════════════════════
# hadolint ignore=DL3006
FROM oven/bun:slim AS dependencies

# Labels OCI padrão
LABEL org.opencontainers.image.source="https://github.com/urlfy/urlfy.cc"
LABEL org.opencontainers.image.description="urlfy.cc - High-performance URL Shortener"
LABEL org.opencontainers.image.licenses="MIT"

WORKDIR /app

# Copia arquivos de dependências e configuração do Bun
COPY package.json bun.lock* bunfig.toml ./

# Instala dependências (incluindo devDependencies para build)
RUN bun install --frozen-lockfile

# ═══════════════════════════════════════════════════════════════════
# STAGE 2: Builder
# ═══════════════════════════════════════════════════════════════════
FROM oven/bun:slim AS builder

WORKDIR /app

# Copia dependências do stage anterior
COPY --from=dependencies /app/node_modules ./node_modules

# Copia arquivos de configuração (sem duplicatas)
COPY package.json bun.lock* bunfig.toml ./
COPY tsconfig.json next.config.ts ./
COPY instrumentation.ts drizzle.config.ts ./
COPY components.json biome.json postcss.config.mjs ./

# Copia scripts necessários para o build
COPY scripts ./scripts

# Copia código fonte
COPY src ./src
COPY drizzle ./drizzle

# Build da aplicação Next.js
ENV NEXT_TELEMETRY_DISABLED=1
ENV SKIP_ENV_VALIDATION=1
ENV NODE_ENV=production

RUN bun run build && \
    echo "✅ Build completed" && \
    ls -la .next/ && \
    ls -la .next/standalone/ || (echo "❌ ERROR: standalone folder not found" && exit 1)

# ═══════════════════════════════════════════════════════════════════
# STAGE 3: Runner (minimal production image)
# ═══════════════════════════════════════════════════════════════════
FROM oven/bun:slim AS runner

WORKDIR /app

# Instala curl para healthcheck mais leve e cria usuário não-root em uma única camada
RUN apt-get update && \
    apt-get install -y --no-install-recommends curl ca-certificates && \
    rm -rf /var/lib/apt/lists/* && \
    groupadd --system --gid 1001 urlfy && \
    useradd --system --uid 1001 --gid urlfy --no-create-home --shell /usr/sbin/nologin urlfy && \
    mkdir -p .next/cache /app/geoip && \
    chown -R urlfy:urlfy .next /app/geoip

# Copia arquivos necessários do build standalone
COPY --from=builder --chown=urlfy:urlfy /app/.next/standalone ./
COPY --from=builder --chown=urlfy:urlfy /app/.next/static ./.next/static
COPY --from=builder --chown=urlfy:urlfy /app/public ./public
COPY --from=builder --chown=urlfy:urlfy /app/drizzle ./drizzle

# Copia migration script e entrypoint
COPY --chown=urlfy:urlfy docker/migrate.ts ./migrate.ts
COPY --chown=root:root docker/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Verifica se server.js existe (fail-fast durante build)
RUN test -f /app/server.js || (echo "❌ ERROR: server.js not found! Check Next.js standalone build" && exit 1)

# Define usuário não-root
USER urlfy

# Expõe porta
EXPOSE 3000

# Variáveis de ambiente
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME="0.0.0.0"

# Health check usando curl (mais leve que spawnar Bun)
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl --fail --silent --max-time 5 http://localhost:3000/api/health || exit 1

# Entrypoint runs migrations, then CMD starts the app
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["bun", "server.js"]
