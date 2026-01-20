# Arquitetura - urlfy.cc

> 📖 [← Voltar ao PRD](../prd.md) | [Database Schema →](./database-schema.md)

**Navegação:** [Overview](#) · [Database](./database-schema.md) · [Caching](./caching-strategy.md) · [Security](./security.md) · [API](../api/endpoints.md)

---

## Visão Geral

O urlfy.cc utiliza uma arquitetura híbrida com **Next.js** no frontend e **ElysiaJS** como API REST, ambos rodando sobre o runtime **Bun** em uma infraestrutura 100% containerizada.

```
┌─────────────────────────────────────────────────────────────────┐
│                         DOCKER COMPOSE                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                     APP (Next.js + Elysia)               │   │
│  │                                                          │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │   │
│  │  │  Middleware  │  │   Next.js    │  │   Elysia     │   │   │
│  │  │  (Redirect)  │  │   (Pages)    │  │   (API)      │   │   │
│  │  └──────┬───────┘  └──────────────┘  └──────┬───────┘   │   │
│  │         │                                    │           │   │
│  │         │         ┌──────────────┐          │           │   │
│  │         └────────►│   BullMQ     │◄─────────┘           │   │
│  │                   │   (Queues)   │                      │   │
│  │                   └──────┬───────┘                      │   │
│  └──────────────────────────┼──────────────────────────────┘   │
│                             │                                   │
│  ┌──────────────┐  ┌───────┴──────┐  ┌──────────────────────┐  │
│  │  PostgreSQL  │  │    Redis     │  │       SigNoz         │  │
│  │     16       │  │      7       │  │   (Observability)    │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    GeoIP Update                          │  │
│  │              (MaxMind GeoLite2 Weekly)                   │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Stack Tecnológica

| Camada            | Tecnologia               | Justificativa                                               |
| ----------------- | ------------------------ | ----------------------------------------------------------- |
| **Runtime**       | Bun 1.x+                 | APIs nativas (Bun SQL, Bun Redis) para máxima performance   |
| **Frontend**      | Next.js 16+ (App Router) | SSR, RSC, Middleware nativo                                 |
| **API**           | ElysiaJS                 | Type-safety E2E, integração com Next.js via catch-all route |
| **Banco**         | PostgreSQL 16+           | Particionamento nativo, robustez                            |
| **Cache**         | Redis 7+                 | `Bun.redis` com protocolo RESP3                             |
| **Queue**         | BullMQ                   | Filas, jobs agendados, Dead Letter Queue                    |
| **ORM**           | Drizzle                  | Type-safe, compatível com Bun SQL                           |
| **Auth**          | Better-Auth              | Plugins: `twoFactor`, `admin`, `apiKey`, `openAPI`          |
| **Geo**           | MaxMind GeoLite2         | Lookup offline, sem limites de requests                     |
| **Observability** | SigNoz                   | OpenTelemetry nativo, logs/traces/métricas unificados       |
| **Styling**       | TailwindCSS + Shadcn/UI  | Componentes acessíveis, design system                       |

## Fluxo de Redirecionamento (Hot Path)

O redirecionamento é o caminho crítico de performance:

```
GET /:code
    │
    ▼
┌─────────────────┐
│   Middleware    │
│  (middleware.ts)│
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────────┐
│  Redis Cache    │────►│  Cache Hit?     │
│  (Bun.redis)    │     └────────┬────────┘
└─────────────────┘              │
                          ┌──────┴──────┐
                          │             │
                         Yes           No
                          │             │
                          │    ┌────────▼────────┐
                          │    │ Acquire Lock    │
                          │    │ (SETNX)         │
                          │    └────────┬────────┘
                          │             │
                          │    ┌────────▼────────┐
                          │    │  PostgreSQL     │
                          │    │  (Bun SQL)      │
                          │    └────────┬────────┘
                          │             │
                          │    ┌────────▼────────┐
                          │    │ Populate Cache  │
                          │    │ (TTL: 1h)       │
                          │    └────────┬────────┘
                          │             │
                          └──────┬──────┘
                                 │
                    ┌────────────▼────────────┐
                    │ Validações:             │
                    │ - is_active?            │
                    │ - !is_banned?           │
                    │ - !expired?             │
                    │ - clicks < max_clicks?  │
                    │ - X-Redirect-Depth < 3? │
                    └────────────┬────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │ Enfileira Analytics     │
                    │ (BullMQ - async)        │
                    └────────────┬────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │ Redirect 301/302        │
                    │ + X-Request-Id header   │
                    └─────────────────────────┘
```

## Docker Compose

```yaml
services:
  # Aplicação principal (Next.js + Elysia)
  app:
    build: .
    ports:
      - '3000:3000'
    environment:
      - DATABASE_URL=postgres://urlfy:urlfy@postgres:5432/urlfy
      - REDIS_URL=redis://redis:6379
      - OTEL_EXPORTER_OTLP_ENDPOINT=http://signoz:4318
    depends_on:
      - postgres
      - redis
    volumes:
      - geoip_data:/app/geoip:ro

  # PostgreSQL 16
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: urlfy
      POSTGRES_PASSWORD: urlfy
      POSTGRES_DB: urlfy
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U urlfy']
      interval: 5s
      timeout: 5s
      retries: 5

  # Redis 7
  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data
    healthcheck:
      test: ['CMD', 'redis-cli', 'ping']
      interval: 5s
      timeout: 5s
      retries: 5

  # SigNoz (Observabilidade)
  signoz:
    image: signoz/signoz:latest
    ports:
      - '3301:3301' # UI
      - '4317:4317' # OTLP gRPC
      - '4318:4318' # OTLP HTTP
    volumes:
      - signoz_data:/var/lib/signoz

  # MaxMind GeoIP Update (atualização semanal)
  geoipupdate:
    image: maxmindinc/geoipupdate
    environment:
      GEOIPUPDATE_ACCOUNT_ID: ${MAXMIND_ACCOUNT_ID}
      GEOIPUPDATE_LICENSE_KEY: ${MAXMIND_LICENSE_KEY}
      GEOIPUPDATE_EDITION_IDS: GeoLite2-City
      GEOIPUPDATE_FREQUENCY: 168 # horas (1 semana)
    volumes:
      - geoip_data:/usr/share/GeoIP

volumes:
  postgres_data:
  redis_data:
  signoz_data:
  geoip_data:
```

### Notas de Produção

- **SigNoz:** Para produção, considerar deploy separado com ClickHouse
- **MaxMind:** Requer conta gratuita em maxmind.com
- **Scaling:** `docker-compose up --scale app=3` para múltiplas instâncias

## Resiliência

### Circuit Breaker

Implementado para dependências externas (PostgreSQL, Redis):

- **Threshold:** 50% de falhas em 10 segundos → circuito abre
- **Reset:** 30 segundos
- **Biblioteca sugerida:** `opossum` ou `cockatiel`

### Dead Letter Queue (BullMQ)

```
App → BullMQ Queue → Worker → PostgreSQL
         │
         └─► Retry: 3 tentativas (1s, 5s, 30s backoff)
                 │
                 └─► Dead Letter: analytics:dead
```

### Graceful Degradation

- Redis indisponível → Bypass para PostgreSQL + alerta
- GeoIP indisponível → `country: "unknown"`

## Observability (SigNoz)

### Integração OpenTelemetry

```typescript
import { trace } from '@opentelemetry/api';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';

const exporter = new OTLPTraceExporter({
  url: 'http://signoz:4318/traces'
});
```

### Logs Estruturados

Formato JSON com campos padronizados:

- `level`, `message`, `timestamp`
- `traceId`, `spanId` (correlação)
- `duration_ms`

### Retention

- Logs detalhados: 30 dias
- Métricas agregadas: 90 dias

## Backup & Disaster Recovery

| Métrica                            | Target                                     |
| ---------------------------------- | ------------------------------------------ |
| **RTO** (Recovery Time Objective)  | < 1 hora                                   |
| **RPO** (Recovery Point Objective) | < 1 hora (pg_dump) ou < 5 min (pgBackRest) |

### Estratégia

- **PostgreSQL:** `pg_dump` via cron ou **pgBackRest** para PITR
- **Redis:** Dados são cache, não requerem backup (RDB snapshots opcionais)
- **Volumes Docker:** Named volumes com backup externo (rsync, restic)
