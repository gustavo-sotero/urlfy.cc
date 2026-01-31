# Módulo 1: Infraestrutura & Core Setup

> 📖 [← Plano de Implementação](../implementation-plan.md) | [Módulo 2: Autenticação →](./module-02-authentication.md)

**Requisitos Cobertos:** PRD 5.1, Arch Overview, RNF-09, RNF-10, RNF-11, RF-19, PRD 6, PRD 4.5

---

## 1. Visão Geral

Este módulo estabelece a **fundação técnica** do projeto urlfy.cc, incluindo:

- Ambiente de desenvolvimento containerizado (Docker Compose)
- Configuração do runtime Bun com Next.js e ElysiaJS
- Conexão com PostgreSQL e Redis via APIs nativas
- Observabilidade com OpenTelemetry e SigNoz
- GeoIP offline com MaxMind GeoLite2
- Health endpoints para monitoramento
- Estratégia de backup e disaster recovery

---

## 2. Stack Tecnológica

| Componente         | Tecnologia                 | Versão  | Justificativa                                       |
| ------------------ | -------------------------- | ------- | --------------------------------------------------- |
| **Runtime**        | Bun                        | 1.x+    | APIs nativas (SQL, Redis) para máxima performance   |
| **Framework Web**  | Next.js (App Router)       | 16+     | SSR, RSC, Middleware nativo                         |
| **API REST**       | ElysiaJS                   | latest  | Type-safety E2E, excelente performance              |
| **Banco de Dados** | PostgreSQL                 | 16+     | Particionamento nativo, robustez                    |
| **Cache**          | Redis                      | 7+      | Protocolo RESP3 com Bun.redis                       |
| **ORM**            | Drizzle                    | latest  | Type-safe, compatível com Bun SQL                   |
| **Filas**          | Redis Streams (Bun Native) | -       | Jobs agendados, Dead Letter Queue (XADD/XREADGROUP) |
| **Observability**  | SigNoz + OpenTelemetry     | latest  | Logs, traces e métricas unificados                  |
| **GeoIP**          | GeoLite2 (jsDelivr mirror) | monthly | Lookup offline, credential-free, sem limites        |

---

## 3. Estrutura de Diretórios

```
urlfy.cc/
├── docker/
│   ├── docker-compose.yml
│   ├── docker-compose.dev.yml
│   ├── docker-compose.prod.yml
│   └── Dockerfile
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── api/
│   │   │   └── [[...slugs]]/   # ElysiaJS catch-all
│   │   │       └── route.ts
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── server/                 # Backend logic
│   │   ├── api/                # ElysiaJS routes
│   │   │   ├── index.ts
│   │   │   ├── health.ts
│   │   │   └── v1/
│   │   ├── services/           # Business logic
│   │   ├── lib/                # Utilities
│   │   │   ├── db.ts
│   │   │   ├── redis.ts
│   │   │   ├── queue.ts
│   │   │   ├── geoip.ts
│   │   │   └── telemetry.ts
│   │   └── middleware/
│   ├── db/
│   │   ├── index.ts            # Drizzle instance
│   │   ├── schema.ts           # Schema exports
│   │   └── schema/             # Schema files
│   └── lib/                    # Shared utilities
├── scripts/
│   ├── backup.sh
│   ├── create-partition.ts
│   └── seed.ts
├── geoip/                      # GeoIP data (volume mount)
├── drizzle.config.ts
├── next.config.ts
├── package.json
├── tsconfig.json
└── biome.json
```

---

## 4. Docker Compose

### 4.1 Arquivo Principal (`docker/docker-compose.yml`)

```yaml
version: '3.9'

services:
  # ═══════════════════════════════════════════════════════════════════
  # APLICAÇÃO PRINCIPAL (Next.js + ElysiaJS + Bun)
  # ═══════════════════════════════════════════════════════════════════
  app:
    build:
      context: ..
      dockerfile: docker/Dockerfile
    container_name: urlfy-app
    restart: unless-stopped
    ports:
      - '3000:3000'
    environment:
      NODE_ENV: production
      DATABASE_URL: postgres://urlfy:${DB_PASSWORD}@postgres:5432/urlfy
      REDIS_URL: redis://redis:6379
      OTEL_EXPORTER_OTLP_ENDPOINT: http://signoz:4318
      OTEL_SERVICE_NAME: urlfy-api
      GEOIP_DB_PATH: /app/geoip/GeoLite2-City.mmdb
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    volumes:
      - geoip_data:/app/geoip:ro
    healthcheck:
      test: ['CMD', 'curl', '-f', 'http://localhost:3000/api/health']
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    networks:
      - urlfy-network

  # ═══════════════════════════════════════════════════════════════════
  # POSTGRESQL 16
  # ═══════════════════════════════════════════════════════════════════
  postgres:
    image: postgres:16-alpine
    container_name: urlfy-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: urlfy
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: urlfy
      PGDATA: /var/lib/postgresql/data/pgdata
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./init-scripts:/docker-entrypoint-initdb.d:ro
    ports:
      - '5432:5432'
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U urlfy -d urlfy']
      interval: 5s
      timeout: 5s
      retries: 5
    networks:
      - urlfy-network
    command:
      - 'postgres'
      - '-c'
      - 'max_connections=200'
      - '-c'
      - 'shared_buffers=256MB'
      - '-c'
      - 'effective_cache_size=768MB'
      - '-c'
      - 'maintenance_work_mem=128MB'
      - '-c'
      - 'checkpoint_completion_target=0.9'
      - '-c'
      - 'wal_buffers=16MB'
      - '-c'
      - 'default_statistics_target=100'
      - '-c'
      - 'random_page_cost=1.1'
      - '-c'
      - 'effective_io_concurrency=200'
      - '-c'
      - 'log_statement=mod'
      - '-c'
      - 'log_duration=on'
      - '-c'
      - 'log_min_duration_statement=100'

  # ═══════════════════════════════════════════════════════════════════
  # REDIS 7
  # ═══════════════════════════════════════════════════════════════════
  redis:
    image: redis:7-alpine
    container_name: urlfy-redis
    restart: unless-stopped
    command: >
      redis-server
      --appendonly yes
      --appendfsync everysec
      --maxmemory 512mb
      --maxmemory-policy allkeys-lru
      --tcp-keepalive 60
      --timeout 0
    volumes:
      - redis_data:/data
    ports:
      - '6379:6379'
    healthcheck:
      test: ['CMD', 'redis-cli', 'ping']
      interval: 5s
      timeout: 5s
      retries: 5
    networks:
      - urlfy-network

  # ═══════════════════════════════════════════════════════════════════
  # SIGNOZ (OBSERVABILIDADE) - EXTERNAL STACK
  # ═══════════════════════════════════════════════════════════════════
  # SigNoz runs as a separate Docker Compose stack due to its complexity
  # (ClickHouse, Zookeeper, Schema Migrator, Query Service, OTEL Collector).
  #
  # To enable observability:
  #   1. Clone SigNoz: git clone https://github.com/SigNoz/signoz.git ../signoz
  #   2. Start SigNoz: cd ../signoz/deploy/docker && docker compose up -d
  #   3. Start urlfy with override:
  #      docker compose -f docker-compose.yml -f docker-compose.signoz.yml up -d
  #
  # See docs/architecture/signoz-setup.md for detailed instructions.
  # ═══════════════════════════════════════════════════════════════════

  # ═══════════════════════════════════════════════════════════════════
  # GEOIP DOWNLOADER (Credential-free auto-download)
  # ═══════════════════════════════════════════════════════════════════
  geoip-downloader:
    build:
      context: ./geoip
      dockerfile: Dockerfile
    container_name: urlfy-geoip
    restart: unless-stopped
    environment:
      GEOIP_DB_PATH: /app/geoip/GeoLite2-City.mmdb
      GEOIP_MAX_AGE_DAYS: 25
      GEOIP_MMDB_URL: https://cdn.jsdelivr.net/npm/geolite2-city/GeoLite2-City.mmdb.gz
    volumes:
      - geoip_data:/app/geoip
    networks:
      - urlfy-network

  # ═══════════════════════════════════════════════════════════════════
  # BACKUP SCHEDULER (PostgreSQL)
  # ═══════════════════════════════════════════════════════════════════
  backup:
    image: postgres:16-alpine
    container_name: urlfy-backup
    restart: unless-stopped
    environment:
      PGHOST: postgres
      PGUSER: urlfy
      PGPASSWORD: ${DB_PASSWORD}
      PGDATABASE: urlfy
      BACKUP_RETENTION_DAYS: 7
    volumes:
      - ./scripts/backup.sh:/backup.sh:ro
      - backup_data:/backups
    entrypoint: ['/bin/sh', '-c', 'crond -f -d 8']
    depends_on:
      postgres:
        condition: service_healthy
    networks:
      - urlfy-network

# ═════════════════════════════════════════════════════════════════════
# VOLUMES
# ═════════════════════════════════════════════════════════════════════
volumes:
  postgres_data:
    name: urlfy_postgres_data
  redis_data:
    name: urlfy_redis_data
  geoip_data:
    name: urlfy_geoip_data
  backup_data:
    name: urlfy_backup_data

# ═════════════════════════════════════════════════════════════════════
# NETWORKS
# ═════════════════════════════════════════════════════════════════════
networks:
  urlfy-network:
    name: urlfy-network
    driver: bridge
```

### 4.2 Dockerfile (`docker/Dockerfile`)

```dockerfile
# ═══════════════════════════════════════════════════════════════════
# STAGE 1: Dependencies
# ═══════════════════════════════════════════════════════════════════
FROM oven/bun:1 AS dependencies

WORKDIR /app

# Copia arquivos de dependências
COPY package.json bun.lock* ./

# Instala dependências
RUN bun install --frozen-lockfile --production=false

# ═══════════════════════════════════════════════════════════════════
# STAGE 2: Builder
# ═══════════════════════════════════════════════════════════════════
FROM oven/bun:1 AS builder

WORKDIR /app

# Copia dependências do stage anterior
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .

# Build da aplicação
ENV NEXT_TELEMETRY_DISABLED=1
RUN bun run build

# ═══════════════════════════════════════════════════════════════════
# STAGE 3: Runner
# ═══════════════════════════════════════════════════════════════════
FROM oven/bun:1-slim AS runner

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

# Comando de inicialização
CMD ["bun", "server.js"]
```

---

## 5. Configuração do Database Layer

### 5.1 Conexão com Bun SQL (`src/server/lib/db.ts`)

```typescript
import { drizzle } from 'drizzle-orm/bun-sql';
import { SQL } from 'bun';
import * as schema from '@/db/schema';

// Singleton da conexão
let dbInstance: ReturnType<typeof drizzle> | null = null;

export function getDatabase() {
  if (dbInstance) return dbInstance;

  const sql = new SQL({
    url: process.env.DATABASE_URL!,
    max: 20, // Pool máximo de conexões
    idleTimeout: 30, // Timeout de conexão idle (segundos)
    connectionTimeout: 10 // Timeout de conexão (segundos)
  });

  dbInstance = drizzle(sql, { schema });

  return dbInstance;
}

export const db = getDatabase();

// Health check do banco
export async function checkDatabaseHealth(): Promise<{
  status: 'ok' | 'error';
  latencyMs: number;
  error?: string;
}> {
  const start = performance.now();

  try {
    await db.execute`SELECT 1`;
    return {
      status: 'ok',
      latencyMs: Math.round(performance.now() - start)
    };
  } catch (error) {
    return {
      status: 'error',
      latencyMs: Math.round(performance.now() - start),
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
```

### 5.2 Configuração do Drizzle (`drizzle.config.ts`)

```typescript
import type { Config } from 'drizzle-kit';

export default {
  schema: './src/db/schema/*',
  out: './drizzle/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!
  },
  verbose: true,
  strict: true
} satisfies Config;
```

---

## 6. Configuração do Cache Layer

### 6.1 Cliente Redis (`src/server/lib/redis.ts`)

```typescript
import { RedisClient } from 'bun';

// Singleton do cliente Redis
let redisInstance: RedisClient | null = null;

export function getRedisClient(): RedisClient {
  if (redisInstance) return redisInstance;

  redisInstance = new RedisClient({
    url: process.env.REDIS_URL!,
    enableAutoPipelining: true,
    maxRetriesPerRequest: 3,
    retryDelayMs: 100
  });

  return redisInstance;
}

export const redis = getRedisClient();

// Health check do Redis
export async function checkRedisHealth(): Promise<{
  status: 'ok' | 'error';
  latencyMs: number;
  error?: string;
}> {
  const start = performance.now();

  try {
    const pong = await redis.ping();
    return {
      status: pong === 'PONG' ? 'ok' : 'error',
      latencyMs: Math.round(performance.now() - start)
    };
  } catch (error) {
    return {
      status: 'error',
      latencyMs: Math.round(performance.now() - start),
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Padrões de chaves
export const CACHE_KEYS = {
  link: (code: string) => `link:${code}`,
  linkMeta: (code: string) => `link:meta:${code}`,
  link404: (code: string) => `link:404:${code}`,
  linkBanned: (code: string) => `link:banned:${code}`,
  qrCode: (code: string, size: number, format: string) =>
    `qr:${code}:${size}:${format}`,
  geoIP: (ipPrefix: string) => `geo:${ipPrefix}`,
  rateLimit: (key: string) => `rl:${key}`,
  lock: (resource: string) => `lock:${resource}`,
  idempotency: (key: string) => `idempotency:${key}`
} as const;

// TTLs em segundos
export const CACHE_TTL = {
  link: 3600, // 1 hora
  linkMeta: 300, // 5 minutos
  link404: 300, // 5 minutos
  linkBanned: 86400, // 24 horas
  qrCode: 86400, // 24 horas
  geoIP: 86400, // 24 horas
  lock: 5, // 5 segundos
  idempotency: 86400 // 24 horas
} as const;
```

---

## 7. Configuração de Filas (BullMQ)

### 7.1 Setup das Filas (`src/server/lib/queue.ts`)

```typescript
import { Queue, Worker, QueueEvents } from 'bullmq';
import IORedis from 'ioredis';
import { trace } from '@opentelemetry/api';

// Conexão Redis para BullMQ (usa ioredis internamente)
const connection = new IORedis(process.env.REDIS_URL!, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false
});

// ═══════════════════════════════════════════════════════════════════
// FILAS DISPONÍVEIS
// ═══════════════════════════════════════════════════════════════════

export const QUEUE_NAMES = {
  analytics: 'analytics',
  analyticsDead: 'analytics:dead', // Dead Letter Queue
  aggregation: 'aggregation',
  cleanup: 'cleanup',
  notifications: 'notifications'
} as const;

// Fila de Analytics (eventos de clique)
export const analyticsQueue = new Queue(QUEUE_NAMES.analytics, {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000 // 1s, 2s, 4s
    },
    removeOnComplete: {
      age: 3600, // Remove jobs completos após 1 hora
      count: 10000 // Mantém no máximo 10k jobs
    },
    removeOnFail: {
      age: 86400 // Remove jobs falhos após 24 horas
    }
  }
});

// Dead Letter Queue para analytics falhos
export const analyticsDeadQueue = new Queue(QUEUE_NAMES.analyticsDead, {
  connection
});

// Fila de agregação diária
export const aggregationQueue = new Queue(QUEUE_NAMES.aggregation, {
  connection,
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 5000
    }
  }
});

// ═══════════════════════════════════════════════════════════════════
// INTERFACE DE JOBS
// ═══════════════════════════════════════════════════════════════════

export interface AnalyticsJobData {
  linkId: string;
  shortCode: string;
  timestamp: string;
  visitorHash: string;
  userAgent: string;
  ip: string;
  referrer: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
}

export interface AggregationJobData {
  date: string; // YYYY-MM-DD
  linkIds?: string[]; // Se vazio, processa todos
}

// ═══════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════

export async function addAnalyticsJob(data: AnalyticsJobData) {
  const tracer = trace.getTracer('urlfy');
  const span = tracer.startSpan('queue.add.analytics');

  try {
    await analyticsQueue.add('click', data, {
      jobId: `${data.linkId}-${data.timestamp}-${data.visitorHash.slice(0, 8)}`
    });
    span.setStatus({ code: 1 }); // OK
  } catch (error) {
    span.recordException(error as Error);
    span.setStatus({ code: 2, message: 'Failed to add analytics job' });
    throw error;
  } finally {
    span.end();
  }
}

// Health check das filas
export async function checkQueueHealth(): Promise<{
  status: 'ok' | 'error';
  pendingJobs: number;
  failedJobs: number;
}> {
  try {
    const [waiting, failed] = await Promise.all([
      analyticsQueue.getWaitingCount(),
      analyticsQueue.getFailedCount()
    ]);

    return {
      status: failed > 100 ? 'error' : 'ok',
      pendingJobs: waiting,
      failedJobs: failed
    };
  } catch {
    return {
      status: 'error',
      pendingJobs: 0,
      failedJobs: 0
    };
  }
}
```

---

## 8. Observabilidade (OpenTelemetry + SigNoz)

### 8.1 Setup de Telemetria (`src/server/lib/telemetry.ts`)

```typescript
import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { Resource } from '@opentelemetry/resources';
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
  ATTR_DEPLOYMENT_ENVIRONMENT
} from '@opentelemetry/semantic-conventions';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import {
  LoggerProvider,
  BatchLogRecordProcessor
} from '@opentelemetry/sdk-logs';
import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';

// Habilita debug em desenvolvimento
if (process.env.NODE_ENV === 'development') {
  diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.INFO);
}

const OTEL_ENDPOINT =
  process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318';

// ═══════════════════════════════════════════════════════════════════
// RESOURCE (Identificação do Serviço)
// ═══════════════════════════════════════════════════════════════════

const resource = new Resource({
  [ATTR_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME || 'urlfy-api',
  [ATTR_SERVICE_VERSION]: process.env.npm_package_version || '1.0.0',
  [ATTR_DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV || 'development'
});

// ═══════════════════════════════════════════════════════════════════
// EXPORTERS
// ═══════════════════════════════════════════════════════════════════

const traceExporter = new OTLPTraceExporter({
  url: `${OTEL_ENDPOINT}/traces`
});

const metricExporter = new OTLPMetricExporter({
  url: `${OTEL_ENDPOINT}/metrics`
});

const logExporter = new OTLPLogExporter({
  url: `${OTEL_ENDPOINT}/logs`
});

// ═══════════════════════════════════════════════════════════════════
// LOGGER PROVIDER
// ═══════════════════════════════════════════════════════════════════

const loggerProvider = new LoggerProvider({ resource });
loggerProvider.addLogRecordProcessor(new BatchLogRecordProcessor(logExporter));

// ═══════════════════════════════════════════════════════════════════
// SDK NODE
// ═══════════════════════════════════════════════════════════════════

const sdk = new NodeSDK({
  resource,
  traceExporter,
  metricReader: new PeriodicExportingMetricReader({
    exporter: metricExporter,
    exportIntervalMillis: 60000 // 1 minuto
  }),
  instrumentations: [
    getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-fs': { enabled: false },
      '@opentelemetry/instrumentation-dns': { enabled: false }
    })
  ]
});

// ═══════════════════════════════════════════════════════════════════
// INICIALIZAÇÃO
// ═══════════════════════════════════════════════════════════════════

export function initTelemetry() {
  sdk.start();

  // Graceful shutdown
  process.on('SIGTERM', () => {
    sdk
      .shutdown()
      .then(() => console.log('Telemetry shut down'))
      .catch((error) => console.error('Error shutting down telemetry', error))
      .finally(() => process.exit(0));
  });

  console.log('✅ Telemetry initialized');
}

// ═══════════════════════════════════════════════════════════════════
// LOGGER ESTRUTURADO
// ═══════════════════════════════════════════════════════════════════

import { trace, context } from '@opentelemetry/api';

export interface LogContext {
  traceId?: string;
  spanId?: string;
  userId?: string;
  requestId?: string;
  [key: string]: unknown;
}

export function createLogger(name: string) {
  const logger = loggerProvider.getLogger(name);

  return {
    info: (message: string, ctx: LogContext = {}) => {
      const span = trace.getSpan(context.active());
      logger.emit({
        severityText: 'INFO',
        body: message,
        attributes: {
          ...ctx,
          traceId: span?.spanContext().traceId,
          spanId: span?.spanContext().spanId
        }
      });
    },

    warn: (message: string, ctx: LogContext = {}) => {
      const span = trace.getSpan(context.active());
      logger.emit({
        severityText: 'WARN',
        body: message,
        attributes: {
          ...ctx,
          traceId: span?.spanContext().traceId,
          spanId: span?.spanContext().spanId
        }
      });
    },

    error: (message: string, error?: Error, ctx: LogContext = {}) => {
      const span = trace.getSpan(context.active());
      logger.emit({
        severityText: 'ERROR',
        body: message,
        attributes: {
          ...ctx,
          traceId: span?.spanContext().traceId,
          spanId: span?.spanContext().spanId,
          errorName: error?.name,
          errorMessage: error?.message,
          errorStack: error?.stack
        }
      });
    }
  };
}
```

### 8.2 Métricas Customizadas (`src/server/lib/metrics.ts`)

```typescript
import { metrics } from '@opentelemetry/api';

const meter = metrics.getMeter('urlfy');

// ═══════════════════════════════════════════════════════════════════
// COUNTERS
// ═══════════════════════════════════════════════════════════════════

export const redirectCounter = meter.createCounter('redirect.total', {
  description: 'Total number of redirects',
  unit: '1'
});

export const cacheHitCounter = meter.createCounter('cache.hits', {
  description: 'Number of cache hits',
  unit: '1'
});

export const cacheMissCounter = meter.createCounter('cache.misses', {
  description: 'Number of cache misses',
  unit: '1'
});

export const linkCreatedCounter = meter.createCounter('links.created', {
  description: 'Number of links created',
  unit: '1'
});

export const errorCounter = meter.createCounter('errors.total', {
  description: 'Total number of errors',
  unit: '1'
});

// ═══════════════════════════════════════════════════════════════════
// HISTOGRAMS
// ═══════════════════════════════════════════════════════════════════

export const redirectLatencyHistogram = meter.createHistogram(
  'redirect.latency',
  {
    description: 'Redirect latency in milliseconds',
    unit: 'ms',
    advice: {
      explicitBucketBoundaries: [5, 10, 25, 50, 100, 250, 500, 1000]
    }
  }
);

export const dbLatencyHistogram = meter.createHistogram('db.latency', {
  description: 'Database query latency in milliseconds',
  unit: 'ms',
  advice: {
    explicitBucketBoundaries: [1, 5, 10, 25, 50, 100, 250]
  }
});

export const redisLatencyHistogram = meter.createHistogram('redis.latency', {
  description: 'Redis operation latency in milliseconds',
  unit: 'ms',
  advice: {
    explicitBucketBoundaries: [0.5, 1, 2, 5, 10, 25]
  }
});

// ═══════════════════════════════════════════════════════════════════
// GAUGES (Observable)
// ═══════════════════════════════════════════════════════════════════

import { checkQueueHealth } from './queue';

meter
  .createObservableGauge('queue.pending', {
    description: 'Number of pending jobs in queue',
    unit: '1'
  })
  .addCallback(async (result) => {
    const health = await checkQueueHealth();
    result.observe(health.pendingJobs, { queue: 'analytics' });
  });

meter
  .createObservableGauge('queue.failed', {
    description: 'Number of failed jobs in queue',
    unit: '1'
  })
  .addCallback(async (result) => {
    const health = await checkQueueHealth();
    result.observe(health.failedJobs, { queue: 'analytics' });
  });
```

### 8.3 Alertas (Configuração SigNoz)

Os seguintes alertas devem ser configurados no SigNoz:

| Alerta                | Condição                       | Severidade | Ação                         |
| --------------------- | ------------------------------ | ---------- | ---------------------------- |
| High Redirect Latency | P99 > 300ms por 5 minutos      | Warning    | Notificação                  |
| Critical Latency      | P99 > 500ms por 2 minutos      | Critical   | Page on-call                 |
| High Error Rate       | Error rate > 1% por 5 minutos  | Critical   | Page on-call                 |
| Low Cache Hit Rate    | Cache hit < 70% por 10 minutos | Warning    | Notificação                  |
| Queue Backlog         | Pending jobs > 10000           | Warning    | Notificação                  |
| Dead Letter Growth    | DLQ jobs crescendo > 100/hora  | Critical   | Investigação imediata        |
| Database Latency      | P99 > 100ms por 5 minutos      | Warning    | Notificação                  |
| Redis Unavailable     | Redis health check failing     | Critical   | Page on-call + auto-failover |

---

## 9. GeoIP Setup (MaxMind)

### 9.1 Reader de GeoIP (`src/server/lib/geoip.ts`)

```typescript
import { Reader } from '@maxmind/geoip2-node';
import { createHash } from 'crypto';
import { redis, CACHE_KEYS, CACHE_TTL } from './redis';
import { createLogger } from './telemetry';

const logger = createLogger('geoip');

// Singleton do reader
let readerInstance: Reader | null = null;

export async function getGeoIPReader(): Promise<Reader | null> {
  if (readerInstance) return readerInstance;

  const dbPath = process.env.MAXMIND_DB_PATH || '/app/geoip/GeoLite2-City.mmdb';

  try {
    readerInstance = await Reader.open(dbPath);
    logger.info('GeoIP database loaded', { path: dbPath });
    return readerInstance;
  } catch (error) {
    logger.error('Failed to load GeoIP database', error as Error, {
      path: dbPath
    });
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════
// INTERFACE DE RESULTADO
// ═══════════════════════════════════════════════════════════════════

export interface GeoLocation {
  country: string | null; // Código ISO (BR, US, etc)
  countryName: string | null;
  city: string | null;
  region: string | null;
  timezone: string | null;
}

// ═══════════════════════════════════════════════════════════════════
// LOOKUP COM CACHE
// ═══════════════════════════════════════════════════════════════════

export async function lookupGeoIP(ip: string): Promise<GeoLocation> {
  const defaultLocation: GeoLocation = {
    country: null,
    countryName: null,
    city: null,
    region: null,
    timezone: null
  };

  // Ignora IPs privados
  if (isPrivateIP(ip)) {
    return defaultLocation;
  }

  // Cache por /24 subnet para reduzir lookups
  const ipPrefix = getIPPrefix(ip);
  const cacheKey = CACHE_KEYS.geoIP(ipPrefix);

  try {
    // Verifica cache
    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    // Lookup no banco MaxMind
    const reader = await getGeoIPReader();
    if (!reader) {
      return defaultLocation;
    }

    const result = reader.city(ip);

    const location: GeoLocation = {
      country: result.country?.isoCode ?? null,
      countryName: result.country?.names?.en ?? null,
      city: result.city?.names?.en ?? null,
      region: result.subdivisions?.[0]?.names?.en ?? null,
      timezone: result.location?.timeZone ?? null
    };

    // Cache o resultado
    await redis.set(cacheKey, JSON.stringify(location), 'EX', CACHE_TTL.geoIP);

    return location;
  } catch (error) {
    logger.warn('GeoIP lookup failed', { ip: anonymizeIP(ip) });
    return defaultLocation;
  }
}

// ═══════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════

function isPrivateIP(ip: string): boolean {
  const privateRanges = [
    /^10\./,
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
    /^192\.168\./,
    /^127\./,
    /^::1$/,
    /^fe80:/i,
    /^fc00:/i,
    /^fd00:/i
  ];

  return privateRanges.some((range) => range.test(ip));
}

function getIPPrefix(ip: string): string {
  // IPv4: retorna /24 (xxx.xxx.xxx)
  // IPv6: retorna /48 (xxxx:xxxx:xxxx)
  if (ip.includes(':')) {
    return ip.split(':').slice(0, 3).join(':');
  }
  return ip.split('.').slice(0, 3).join('.');
}

function anonymizeIP(ip: string): string {
  return createHash('sha256').update(ip).digest('hex').slice(0, 16);
}

// Salt rotativo semanal para hash de visitantes
export function getWeeklySalt(): string {
  const now = new Date();
  const year = now.getFullYear();
  const week = getWeekNumber(now);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

function getWeekNumber(date: Date): number {
  const d = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
  );
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

// Hash de visitante (LGPD compliant)
export function hashVisitor(ip: string, userAgent: string): string {
  const salt = getWeeklySalt();
  return createHash('sha256')
    .update(`${ip}:${userAgent}:${salt}`)
    .digest('hex');
}
```

---

## 10. Padrões Elysia (API Layer)

> 📖 **Referência:** [elysiajs.com/essential/best-practice](https://elysiajs.com/essential/best-practice)

### 10.1 Estrutura Feature-Based

Cada feature é organizada em seu próprio diretório com Controller, Service e Model:

```
src/server/api/
├── links/
│   ├── index.ts          # Controller (Elysia instance)
│   └── ...
├── auth/
│   └── ...
├── models/               # Schemas TypeBox centralizados
│   ├── links.models.ts
│   ├── auth.models.ts
│   └── index.ts
└── ...
```

### 10.2 Controller Pattern

```typescript
// ✅ Correto: 1 Elysia instance = 1 Controller
import { Elysia } from 'elysia';
import { LinkModel } from './links.schema';
import { LinkService } from './links.service';

export const linksController = new Elysia({ prefix: '/links' })
  .model(LinkModel) // Injeção de models para type cache e OpenAPI
  .post(
    '/',
    async ({ body, user }) => {
      const link = await LinkService.createLink(body, user?.id);
      return { success: true, data: link };
    },
    { body: 'link.create' }
  ); // Referência por nome registrado

// ❌ Incorreto: Passar Context inteiro para service
export const badController = new Elysia().get('/', (context) =>
  SomeService.handle(context)
); // NÃO FAZER
```

### 10.3 Service Pattern

```typescript
// ✅ Non-request dependent: abstract class + static
// src/server/modules/links/links.service.ts
abstract class LinkService {
  static async create(input: CreateLinkInput): Promise<Link> {
    // Lógica de negócio pura, sem HTTP
  }
}

// ✅ Request dependent: Elysia plugin com macro
// src/server/middleware/auth.middleware.ts
const AuthMiddleware = new Elysia({ name: 'Auth.Middleware' }).macro({
  requireAuth: {
    resolve: ({ cookie, set }) => {
      if (!cookie.session.value) {
        set.status = 401;
        throw new Error('UNAUTHORIZED');
      }
      return { session: cookie.session.value };
    }
  }
});
```

### 10.4 Model Pattern (Single Source of Truth)

```typescript
// src/server/api/models/links.models.ts
import { Elysia, t } from 'elysia';

// ✅ TypeBox para validação runtime + inferência de tipos
export const LinkCreateBody = t.Object({
  url: t.String({ maxLength: 2048 }),
  customAlias: t.Optional(t.String({ minLength: 3, maxLength: 20 }))
});
type LinkCreateBodyType = typeof LinkCreateBody.static;

// ✅ Agrupar models por domínio
export const linksModels = new Elysia().model({
  'links.create': LinkCreateBody,
  'links.update': LinkUpdateBody,
  'links.response': LinkResponse
});

// ❌ Incorreto: Interface separada do schema
interface LinkInput {
  url: string;
} // NÃO FAZER - perde validação runtime
```

---

## 11. Health Endpoints

### 11.1 Implementação (`src/server/api/health.ts`)

```typescript
import { Elysia, t } from 'elysia';
import { checkDatabaseHealth } from '../lib/db';
import { checkRedisHealth } from '../lib/redis';
import { checkQueueHealth } from '../lib/queue';

// ═══════════════════════════════════════════════════════════════════
// HEALTH CHECK SIMPLES (público)
// ═══════════════════════════════════════════════════════════════════

const healthSimple = new Elysia().get(
  '/health',
  () => ({
    status: 'ok',
    timestamp: new Date().toISOString()
  }),
  {
    detail: {
      summary: 'Health Check',
      description: 'Retorna status básico do serviço',
      tags: ['Health']
    }
  }
);

// ═══════════════════════════════════════════════════════════════════
// READINESS CHECK (público)
// ═══════════════════════════════════════════════════════════════════

const healthReady = new Elysia().get(
  '/health/ready',
  async ({ set }) => {
    const [db, redis] = await Promise.all([
      checkDatabaseHealth(),
      checkRedisHealth()
    ]);

    const isReady = db.status === 'ok' && redis.status === 'ok';

    if (!isReady) {
      set.status = 503;
    }

    return {
      status: isReady ? 'ready' : 'not_ready',
      services: {
        database: db.status,
        redis: redis.status
      }
    };
  },
  {
    detail: {
      summary: 'Readiness Check',
      description: 'Verifica se o serviço está pronto para receber tráfego',
      tags: ['Health']
    }
  }
);

// ═══════════════════════════════════════════════════════════════════
// HEALTH CHECK DETALHADO (admin only)
// ═══════════════════════════════════════════════════════════════════

const healthDetailed = new Elysia().get(
  '/health/detailed',
  async ({ set }) => {
    const [db, redis, queue] = await Promise.all([
      checkDatabaseHealth(),
      checkRedisHealth(),
      checkQueueHealth()
    ]);

    const isHealthy =
      db.status === 'ok' && redis.status === 'ok' && queue.status === 'ok';

    if (!isHealthy) {
      set.status = 503;
    }

    return {
      status: isHealthy ? 'healthy' : 'degraded',
      services: {
        database: {
          status: db.status,
          latencyMs: db.latencyMs,
          error: db.error
        },
        redis: {
          status: redis.status,
          latencyMs: redis.latencyMs,
          error: redis.error
        },
        queue: {
          status: queue.status,
          pendingJobs: queue.pendingJobs,
          failedJobs: queue.failedJobs
        }
      },
      uptime: Math.floor(process.uptime()),
      memory: {
        heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        rss: Math.round(process.memoryUsage().rss / 1024 / 1024)
      }
    };
  },
  {
    // TODO: Adicionar auth middleware para admin
    detail: {
      summary: 'Detailed Health Check',
      description: 'Retorna status detalhado de todos os serviços (admin only)',
      tags: ['Health']
    }
  }
);

// ═══════════════════════════════════════════════════════════════════
// EXPORT
// ═══════════════════════════════════════════════════════════════════

export const healthRoutes = new Elysia({ prefix: '/api' })
  .use(healthSimple)
  .use(healthReady)
  .use(healthDetailed);
```

---

## 12. Backup & Disaster Recovery

### 12.1 Script de Backup (`scripts/backup.sh`)

```bash
#!/bin/bash
set -euo pipefail

# ═══════════════════════════════════════════════════════════════════
# CONFIGURAÇÃO
# ═══════════════════════════════════════════════════════════════════

BACKUP_DIR="/backups"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-7}"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/urlfy_${DATE}.sql.gz"

# ═══════════════════════════════════════════════════════════════════
# FUNÇÕES
# ═══════════════════════════════════════════════════════════════════

log() {
  echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1"
}

cleanup_old_backups() {
  log "Removendo backups com mais de ${RETENTION_DAYS} dias..."
  find "${BACKUP_DIR}" -name "urlfy_*.sql.gz" -mtime +${RETENTION_DAYS} -delete
}

perform_backup() {
  log "Iniciando backup do PostgreSQL..."

  pg_dump \
    --format=custom \
    --compress=9 \
    --verbose \
    --file="${BACKUP_FILE}" \
    --exclude-table-data='analytics_events_*' \
    2>&1 | while read line; do log "  $line"; done

  # Tamanho do backup
  BACKUP_SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
  log "Backup concluído: ${BACKUP_FILE} (${BACKUP_SIZE})"
}

verify_backup() {
  log "Verificando integridade do backup..."

  pg_restore --list "${BACKUP_FILE}" > /dev/null 2>&1

  if [ $? -eq 0 ]; then
    log "Verificação OK"
  else
    log "ERRO: Backup corrompido!"
    exit 1
  fi
}

# ═══════════════════════════════════════════════════════════════════
# EXECUÇÃO
# ═══════════════════════════════════════════════════════════════════

log "=== Iniciando processo de backup ==="

# Cria diretório se não existir
mkdir -p "${BACKUP_DIR}"

# Executa backup
perform_backup

# Verifica integridade
verify_backup

# Remove backups antigos
cleanup_old_backups

log "=== Backup finalizado com sucesso ==="
```

### 12.2 Cron para Backup Automático

Adicionar no container de backup (`/etc/cron.d/backup`):

```cron
# Backup a cada hora (RPO < 1 hora)
0 * * * * /backup.sh >> /var/log/backup.log 2>&1

# Backup completo diário às 02:00 UTC (inclui analytics)
0 2 * * * INCLUDE_ANALYTICS=1 /backup.sh >> /var/log/backup.log 2>&1
```

### 12.3 Restauração (Procedimento)

```bash
# 1. Parar a aplicação
docker-compose stop app

# 2. Restaurar o backup
docker exec -it urlfy-postgres \
  pg_restore \
    --clean \
    --if-exists \
    --dbname=urlfy \
    /backups/urlfy_20260106_020000.sql.gz

# 3. Reiniciar a aplicação
docker-compose start app

# 4. Verificar health
curl http://localhost:3000/api/health/ready
```

---

## 13. Checklist de Implementação

### 13.1 Tarefas

| Item | Descrição                                        | Status |
| ---- | ------------------------------------------------ | ------ |
| 1.1  | Criar `docker-compose.yml` com todos os serviços | ✅     |
| 1.2  | Criar `Dockerfile` multi-stage                   | ✅     |
| 1.3  | Configurar conexão PostgreSQL com Bun SQL        | ✅     |
| 1.4  | Configurar Drizzle ORM e migrações               | ✅     |
| 1.5  | Configurar cliente Redis com ioredis             | ✅     |
| 1.6  | Setup BullMQ com Dead Letter Queue               | ✅     |
| 1.7  | Integrar OpenTelemetry com SigNoz                | ✅     |
| 1.8  | Implementar logger estruturado                   | ✅     |
| 1.9  | Configurar métricas customizadas                 | ✅     |
| 1.10 | Setup GeoIP auto-download (credential-free)      | ✅     |
| 1.11 | Implementar `/api/health`                        | ✅     |
| 1.12 | Implementar `/api/health/ready`                  | ✅     |
| 1.13 | Implementar `/api/health/detailed`               | ✅     |
| 1.14 | Configurar script de backup automático           | ✅     |
| 1.15 | Documentar procedimento de restore               | ✅     |
| 1.16 | Configurar alertas no SigNoz                     | ✅     |
| 1.17 | Testar `docker-compose up` completo              | ✅     |
| 1.18 | Validar health checks de todos os containers     | ✅     |

### 13.2 Variáveis de Ambiente Necessárias

```env
# Database
DATABASE_URL=postgres://urlfy:password@localhost:5432/urlfy
DB_PASSWORD=secure_password_here

# Redis
REDIS_URL=redis://localhost:6379

# OpenTelemetry
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
OTEL_SERVICE_NAME=urlfy-api

# GeoIP (Credential-free auto-download)
GEOIP_DB_PATH=/app/geoip/GeoLite2-City.mmdb
GEOIP_MAX_AGE_DAYS=25
GEOIP_MMDB_URL=https://cdn.jsdelivr.net/npm/geolite2-city/GeoLite2-City.mmdb.gz

# App
NODE_ENV=development
PORT=3000
```

---

## 14. Referências

- [PRD v3.0.0](../prd.md)
- [Arquitetura Overview](../architecture/overview.md)
- [Database Schema](../architecture/database-schema.md)
- [Caching Strategy](../architecture/caching-strategy.md)
- [Bun SQL Documentation](https://bun.sh/docs/api/sql)
- [Drizzle ORM](https://orm.drizzle.team/)
- [BullMQ](https://docs.bullmq.io/)
- [OpenTelemetry JS](https://opentelemetry.io/docs/languages/js/)
- [SigNoz](https://signoz.io/docs/)
- [MaxMind GeoIP2](https://dev.maxmind.com/geoip)

---

> **Próximo módulo:** [Módulo 2: Autenticação & Identidade](./module-02-authentication.md)
