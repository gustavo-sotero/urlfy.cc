# Arquitetura - urlfy.cc

> 📖 [← Voltar ao PRD](../prd.md) | [Database Schema →](./database-schema.md)

**Navegação:** [Overview](#) · [Decoupling](./monorepo-decoupling.md) · [Database](./database-schema.md) · [Caching](./caching-strategy.md) · [Security](./security.md) · [API](../api/endpoints.md)

---

## Visão Geral

O urlfy.cc é um **monorepo Bun Workspaces + Turborepo** com três serviços independentes: `apps/web` (Next.js 16), `apps/api` (ElysiaJS) e `apps/worker` (Bun workers). Os serviços de infra (PostgreSQL, Redis e collector OTLP baseado em Grafana LGTM) são provisionados separadamente via **Dokploy** (self-hosted PaaS).

```
┌────────────────── Dokploy (VPS) ─────────────────────────────────────┐
│                                                                       │
│  ┌──────── Compose: urlfy (docker-compose.prod.yml) ──────────────┐  │
│  │                                                                 │  │
│  │  ┌──────────────────────┐  ┌──────────────────────────────┐    │  │
│  │  │   WEB  (Next.js)     │  │    API  (ElysiaJS / Bun)     │    │  │
│  │  │   apps/web — :3000   │  │    apps/api — :3001          │    │  │
│  │  │                      │  │                              │    │  │
│  │  │  ┌────────────────┐  │  │  Better-Auth + Drizzle       │    │  │
│  │  │  │ Proxy (Edge)   │  │  │  All API endpoints           │    │  │
│  │  │  │  i18n routing  │  │  │  /api/* + /api/auth/*        │    │  │
│  │  │  └───────┬────────┘  │  └────────────────┬─────────────┘    │  │
│  │  │          │           │                   │                   │  │
│  │  │  ┌───────▼────────┐  │  ┌────────────────▼─────────────┐    │  │
│  │  │  │ /r/[code]      │◄─┼─►│  @urlfy/redirect-domain      │    │  │
│  │  │  │ Node.js route  │  │  │  @urlfy/cache  @urlfy/data   │    │  │
│  │  │  │ (no HTTP hop)  │  │  └──────────────────────────────┘    │  │
│  │  │  └───────┬────────┘  │                                      │  │
│  │  │          │ fire&forget  ┌───────────────────────────────┐   │  │
│  │  │          └──────────────► WORKER  (Bun — apps/worker)   │   │  │
│  │  │                       │  Analytics · Aggregation        │   │  │
│  │  │  /api/* → :3001       │  Cleanup   · Deletion           │   │  │
│  │  │  (Traefik ingress)     └───────────────────────────────┬─┘   │  │
│  │  └──────────────────────┐                               │      │  │
│  │                         │  ┌────────────────────────────▼─┐    │  │
│  │                         │  │  GeoIP Downloader (cron)      │    │  │
│  │                         │  │  Auto-download MMDB jsDelivr  │    │  │
│  │                         │  └──────────────────────────────┘    │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                       │
│  ┌─── Serviços Dokploy (Templates) ─────────────────────────────┐   │
│  │  ┌──────────────┐  ┌──────────┐  ┌────────────────────────┐  │   │
│  │  │ PostgreSQL   │  │  Redis   │  │  OTLP Collector /      │  │   │
│  │  │     16       │  │    7     │  │   Grafana LGTM         │  │   │
│  │  └──────────────┘  └──────────┘  └────────────────────────┘  │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                       │
│  ┌─ Traefik (Dokploy) ─────────────────────────────────────────┐    │
│  │  urlfy.cc:443 /api/* → api:3001  (path-based, dashboard)    │    │
│  │  urlfy.cc:443 /*     → web:3000  (catch-all, dashboard)     │    │
│  │  collector.urlfy.cc:443 → lgtm:4318                          │    │
│  └─────────────────────────────────────────────────────────────┘    │
└───────────────────────────────────────────────────────────────────────┘
```

### Monorepo Layout

```
.
├─ apps/
│  ├─ web/          # Next.js 16 App Router (Edge proxy, pages, /r/[code])
│  ├─ api/          # ElysiaJS REST API (Bun runtime, :3001)
│  └─ worker/       # Bun Redis Streams workers (analytics + cleanup)
├─ packages/
│  ├─ contracts/    # Shared request/response envelopes, error codes
│  ├─ redirect-domain/ # Cache-aside resolve logic (no HTTP framework coupling)
│  ├─ data/         # Drizzle ORM + Bun SQL client + migrations
│  ├─ cache/        # Redis client + cache keys + circuit breaker + locks
│  ├─ telemetry/    # OpenTelemetry logger + metrics helpers
│  ├─ auth-shared/  # Auth scopes + Better-Auth config primitives
│  ├─ config-ts/    # Base tsconfig presets
│  └─ config-biome/ # Shared Biome linting preset
└─ docker/
   ├─ web.Dockerfile, api.Dockerfile, worker.Dockerfile
   ├─ docker-compose.yml       # Dev: Postgres + Redis + GeoIP
   ├─ docker-compose.apps.yml  # Local multi-service overlay
   └─ docker-compose.prod.yml  # Production: migrate + web + api + worker
```

## Stack Tecnológica

| Camada            | Tecnologia               | Justificativa                                               |
| ----------------- | ------------------------ | ----------------------------------------------------------- |
| **Monorepo**      | Bun Workspaces + Turborepo | Build graph incremental, cache cross-workspace             |
| **Runtime**       | Bun 1.x+                 | APIs nativas (Bun SQL, Bun Redis) para máxima performance   |
| **Frontend**      | Next.js 16+ (App Router) | SSR, RSC, Middleware nativo, Edge proxy                     |
| **API**           | ElysiaJS (apps/api)      | Serviço standalone :3001, contratos compartilhados via `@urlfy/contracts` |
| **Banco**         | PostgreSQL 16+           | Particionamento nativo, robustez                            |
| **Cache**         | Redis 7+                 | `Bun.RedisClient` nativo com protocolo RESP3                |
| **Queue**         | Redis Streams (Bun)      | Event-driven com XADD/XREADGROUP nativo via `Bun.redis`     |
| **ORM**           | Drizzle                  | Type-safe, compatível com Bun SQL (`@urlfy/data`)           |
| **Auth**          | Better-Auth              | Plugins: `twoFactor`, `admin`, `apiKey`, `openAPI`          |
| **Geo**           | GeoLite2 (jsDelivr CDN)  | Auto-download via public mirror, no credentials required    |
| **Observability** | Grafana LGTM + OTLP      | OpenTelemetry nativo, logs/traces/métricas unificados       |
| **Styling**       | TailwindCSS + Shadcn/UI  | Componentes acessíveis, design system                       |

## Runtime Compartilhado

Policies e contratos puros ficam centralizados em packages compartilhados; `apps/web`, `apps/api` e `apps/worker` mantêm apenas adapters framework-specific.

- `packages/contracts/src/rate-limit-policy.ts`: fonte canônica de rate limits para gateway, API, admin e redirect hot path.
- `packages/contracts/src/cors-policy.ts` e `packages/contracts/src/security-headers.ts`: origem única de CORS e security headers.
- `packages/auth-shared/src/scopes.ts`: origem única de scopes e parsing de permissões.
- `packages/auth-shared/src/auth-config.ts`: origem única de segredos, plugins e base config do Better-Auth.
- `apps/web/src/lib/browser-logger.ts` + `POST /_monitor/log`: caminho único para erros client-side, preservando `requestId` e contexto sanitizado.

## Fluxo de Redirecionamento (Hot Path)

O redirecionamento é o caminho crítico de performance:

```
GET /:code
    │
    ▼
┌─────────────────┐
│      Proxy      │
│    (proxy.ts)   │
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
                    │ (Redis Streams - async) │
                    └────────────┬────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │ Redirect 301/302        │
                    │ + X-Request-Id header   │
                    └─────────────────────────┘
```

## Infraestrutura

### Desenvolvimento Local

O `docker-compose.yml` sobe apenas PostgreSQL + Redis para dev local. A app roda fora do Docker via `bun run dev` (Turborepo orquestra web + api + worker em paralelo).

```yaml
# docker/docker-compose.yml (dev — infra apenas)
services:
  postgres: { image: postgres:16-alpine, ports: ['127.0.0.1:5432:5432'] }
  redis: { image: redis:7-alpine, ports: ['127.0.0.1:6379:6379'] }
  geoip-downloader: { build: ./geoip }  # Download one-shot
```

**Uso:** `bun run docker:up` → `bun run dev`

Para testar os containers de app localmente use o overlay:

```bash
docker compose -f docker/docker-compose.yml \
               -f docker/docker-compose.apps.yml up -d
```

### Produção (Dokploy)

Em produção, o deploy é feito via **Dokploy** (self-hosted PaaS). Cada serviço tem sua própria imagem Docker:

| Serviço       | Tipo no Dokploy     | Dockerfile                  | Porta |
| ------------- | ------------------- | --------------------------- | ----- |
| PostgreSQL 16 | Database (template) | Dokploy managed             | —     |
| Redis 7       | Database (template) | Dokploy managed             | —     |
| OTLP Collector / LGTM | Compose (template)  | Dokploy managed             | —     |
| web           | Compose (Git)       | `docker/web.Dockerfile`     | 3000  |
| api           | Compose (Git)       | `docker/api.Dockerfile`     | 3001  |
| worker        | Compose (Git)       | `docker/worker.Dockerfile`  | —     |
| GeoIP         | Compose (Git)       | `docker/geoip/Dockerfile`   | —     |

O `docker-compose.prod.yml` define a ordem de inicialização:  
`migrate` (DB migrations, wait→exit) → `api` + `worker` → `web`

```yaml
# docker/docker-compose.prod.yml — produção multi-serviço
services:
  migrate:
    build: { dockerfile: docker/worker.Dockerfile }
    working_dir: /app
    command: ['bun', 'run', 'db:migrate:prod']
    restart: 'no'

  api:
    build: { dockerfile: docker/api.Dockerfile }
    depends_on: { migrate: { condition: service_completed_successfully } }
    environment: [DATABASE_URL, REDIS_URL, BETTER_AUTH_SECRET, ...]

  web:
    build: { dockerfile: docker/web.Dockerfile }
    depends_on: { api: { condition: service_healthy } }
    environment: [API_INTERNAL_URL=${API_INTERNAL_URL:-http://api:3001}, DATABASE_URL, REDIS_URL, BETTER_AUTH_SECRET, INTERNAL_API_SECRET, JWT_SECRET, ...]

  worker:
    build: { dockerfile: docker/worker.Dockerfile }
    depends_on: { migrate: { condition: service_completed_successfully } }
```

### Arquivos Docker no Repositório

```
docker/
├── api.Dockerfile           # Elysia API (Bun runtime, standalone)
├── web.Dockerfile           # Next.js web (standalone output)
├── worker.Dockerfile        # Bun workers (Redis Streams)
├── docker-compose.yml       # Dev local (Postgres + Redis + GeoIP)
├── docker-compose.apps.yml  # Local multi-service overlay
├── docker-compose.prod.yml  # Produção Dokploy (migrate + web + api + worker)
└── geoip/
    ├── Dockerfile           # Alpine + curl + cron
    ├── geoip-entrypoint.sh  # Download + inicia cron daemon
    └── geoip-refresh.sh     # Script de download/refresh
```

### Notas de Produção

- **PostgreSQL, Redis, collector OTLP (LGTM):** Provisionados como serviços separados no Dokploy (templates nativos)
- **Networking:** Dokploy coloca todos os serviços do projeto na mesma Docker network interna
- **SSL/TLS:** Gerenciado pelo Traefik integrado ao Dokploy (Let's Encrypt automático)
- **GeoIP:** Usa mirror público (jsDelivr CDN), sem necessidade de credenciais
- **API Gateway:** `apps/web` proxia `/api/*` para `apps/api` via `API_INTERNAL_URL`; em Docker/Compose o padrão interno é `http://api:3001`, mas o valor pode ser sobrescrito por ambiente (sem hop extra no redirect)
- **Redirect Runtime Dependency:** `apps/web` resolve shortlinks localmente e depende de `DATABASE_URL` para fallback no cache miss (via `@urlfy/redirect-domain` -> `@urlfy/data`).
- **Startup validation:** `docker/web.Dockerfile` usa `SKIP_ENV_VALIDATION=1` apenas no build; o container final valida env real no boot. O CI smoke-testa `/api/health` para provar boot e fail-fast de env, enquanto Docker/Compose usam `/api/health/ready` para validar dependências mandatórias de tráfego. Database e API upstream permanecem obrigatórios; indisponibilidade de Redis é reportada como degradação sem bloquear o boot.

### GeoIP Auto-Download

O sistema baixa automaticamente o banco GeoLite2-City:

- **Fonte:** [wp-statistics/GeoLite2-City](https://cdn.jsdelivr.net/npm/geolite2-city/GeoLite2-City.mmdb.gz)
- **Licença:** CC BY-SA 4.0 (MaxMind)
- **Atualização:** 1º dia de cada mês (00:00 UTC)
- **Validação:** Skip download se arquivo existente tem menos de `GEOIP_MAX_AGE_DAYS` (padrão: 25 dias)
- **Configuração:**
  - `GEOIP_DB_PATH`: Caminho do arquivo MMDB (padrão: `/app/geoip/GeoLite2-City.mmdb`)
  - `GEOIP_MAX_AGE_DAYS`: Idade máxima do arquivo antes de re-download (padrão: 25)
  - `GEOIP_MMDB_URL`: URL do mirror (padrão: jsDelivr CDN)

## Resiliência

### Circuit Breaker

Implementado para dependências externas (PostgreSQL, Redis):

- **Threshold:** 50% de falhas em 10 segundos → circuito abre
- **Reset:** 30 segundos
- **Biblioteca sugerida:** `opossum` ou `cockatiel`

### Dead Letter Queue (Redis Streams)

```
App → Redis Stream → Worker → PostgreSQL
         │
         └─► Retry: 3 tentativas (1s, 5s, 30s backoff)
                 │
                 └─► Dead Letter: analytics:dead
```

### Graceful Degradation

- Redis indisponível → Bypass para PostgreSQL + alerta
- GeoIP indisponível → `country: "unknown"`

### Connection Pooling (PgBouncer)

When scaling beyond a single application instance, PostgreSQL's default `max_connections` (typically 100) can be exhausted quickly. Each app process opens up to `pool.max` (default 20) connections, so 5 processes = 100 connections.

**Recommendation for production:** Add PgBouncer as a connection pooler between the application and PostgreSQL.

```yaml
# Example PgBouncer service for docker-compose
pgbouncer:
  image: edoburu/pgbouncer:1.23.1-p2
  environment:
    DATABASE_URL: postgres://urlfy:${DB_PASSWORD}@postgres:5432/urlfy
    POOL_MODE: transaction
    MAX_CLIENT_CONN: 200
    DEFAULT_POOL_SIZE: 20
    MIN_POOL_SIZE: 5
    RESERVE_POOL_SIZE: 5
  ports:
    - '127.0.0.1:6432:6432'
  depends_on:
    postgres:
      condition: service_healthy
```

Key settings:
- **`POOL_MODE: transaction`** — connections are returned to the pool after each transaction (best for Drizzle ORM)
- **`DEFAULT_POOL_SIZE: 20`** — max connections to PostgreSQL per pool
- **`MAX_CLIENT_CONN: 200`** — max client connections PgBouncer accepts

After adding PgBouncer, update `DATABASE_URL` to point to PgBouncer (port 6432) instead of PostgreSQL directly.

## Observability (Grafana LGTM / OTLP)

### Integração OpenTelemetry

```typescript
import { trace } from '@opentelemetry/api';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';

const exporter = new OTLPTraceExporter({
  url: 'https://collector.urlfy.cc/v1/traces'
});
```

Em runtime, a aplicação usa `@urlfy/telemetry` como entrypoint canônico e deriva automaticamente `/v1/logs`, `/v1/metrics` e `/v1/traces` a partir de `OTEL_EXPORTER_OTLP_ENDPOINT`, com suporte a overrides por sinal e headers por sinal.

### Logs Estruturados

Formato JSON com campos padronizados:

- `level`, `message`, `timestamp`
- `traceId`, `spanId` (correlação)
- `duration_ms`

### Retention

- Logs detalhados: definidos pelo backend OTLP/Loki
- Métricas agregadas: definidas pelo backend OTLP/Mimir ou Prometheus

## Backup & Disaster Recovery

| Métrica                            | Target                                     |
| ---------------------------------- | ------------------------------------------ |
| **RTO** (Recovery Time Objective)  | < 1 hora                                   |
| **RPO** (Recovery Point Objective) | < 1 hora (pg_dump) ou < 5 min (pgBackRest) |

### Estratégia

- **PostgreSQL:** `pg_dump` via cron na VPS (`/opt/backups/urlfy/`) ou **pgBackRest** para PITR
- **Redis:** Dados são cache, não requerem backup (RDB snapshots opcionais)
- **GeoIP:** Não requer backup — re-download automático via cron mensal
- **Dokploy:** Backup e restore dos volumes Docker gerenciados pelo painel
