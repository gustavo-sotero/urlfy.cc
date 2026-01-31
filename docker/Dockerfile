# ═══════════════════════════════════════════════════════════════════
# STAGE 1: Dependencies
# ═══════════════════════════════════════════════════════════════════
FROM oven/bun:slim AS dependencies

WORKDIR /app

# Copia arquivos de dependências
COPY package.json bun.lock* ./

# Instala dependências (including devDependencies for build)
RUN bun install --frozen-lockfile

# ═══════════════════════════════════════════════════════════════════
# STAGE 2: Builder
# ═══════════════════════════════════════════════════════════════════
FROM oven/bun:slim AS builder

WORKDIR /app

# Copia dependências do stage anterior
COPY --from=dependencies /app/node_modules ./node_modules

# Copia código fonte e arquivos de configuração
COPY package.json bun.lock* ./
COPY tsconfig.json tsconfig.test.json next.config.ts ./
COPY next-env.d.ts instrumentation.ts ./
COPY drizzle.config.ts components.json biome.json bunfig.toml postcss.config.mjs ./
COPY public ./public
COPY src ./src
COPY drizzle ./drizzle

# Build da aplicação Next.js
ENV NEXT_TELEMETRY_DISABLED=1
RUN bun run build && \
    echo "✅ Build completed" && \
    ls -la .next/ && \
    ls -la .next/standalone/ || echo "⚠️ Warning: standalone folder not found"

# ═══════════════════════════════════════════════════════════════════
# STAGE 3: Runner
# ═══════════════════════════════════════════════════════════════════
FROM oven/bun:slim AS runner

WORKDIR /app

# Cria usuário não-root (Debian syntax)
RUN groupadd --system --gid 1001 nodejs && \
    useradd --system --uid 1001 --gid nodejs --shell /bin/false nextjs

# Copia arquivos necessários do build standalone
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Verifica se server.js existe
RUN ls -la /app/server.js || (echo "❌ ERROR: server.js not found! Check Next.js standalone build" && exit 1)

# Cria diretório para GeoIP
RUN mkdir -p /app/geoip && chown nextjs:nodejs /app/geoip

# Define usuário
USER nextjs

# Expõe porta
EXPOSE 3000

# Variáveis de ambiente
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD bun run -e "fetch('http://localhost:3000/api/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

# Comando de inicialização
CMD ["bun", "server.js"]
