# ═══════════════════════════════════════════════════════════════════
# STAGE 1: Dependencies
# ═══════════════════════════════════════════════════════════════════
FROM oven/bun:slim AS dependencies

WORKDIR /app

# Copia arquivos de dependências
COPY package.json bun.lock* ./

# Instala dependências
RUN bun install --frozen-lockfile --production=false

# ═══════════════════════════════════════════════════════════════════
# STAGE 2: Builder
# ═══════════════════════════════════════════════════════════════════
FROM oven/bun:slim AS builder

WORKDIR /app

# Copia dependências do stage anterior
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .

# Build da aplicação Next.js
ENV NEXT_TELEMETRY_DISABLED=1
RUN bun run build

# ═══════════════════════════════════════════════════════════════════
# STAGE 3: Runner
# ═══════════════════════════════════════════════════════════════════
FROM oven/bun:slim AS runner

WORKDIR /app

# Cria usuário não-root
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copia arquivos necessários
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

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
