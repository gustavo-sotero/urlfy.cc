# Arquitetura - urlfy.cc

> 📖 [← Voltar ao PRD](../prd.md) | [Database Schema →](./database-schema.md)

**Navegação:** [Overview](#) · [Database](./database-schema.md) · [Caching](./caching-strategy.md) · [Security](./security.md) · [API](../api/endpoints.md)

---

## Visão Geral

O urlfy.cc utiliza uma arquitetura híbrida com **Next.js** no frontend e **ElysiaJS** como API REST, ambos rodando sobre o runtime **Bun**. A infraestrutura de produção é gerenciada via **Dokploy** (self-hosted PaaS), com cada serviço de infra provisionado por templates do Dokploy.

```
┌────────────────── Dokploy (VPS) ──────────────────────────────┐
│                                                                │
│  ┌──────── Compose: urlfy (Git repo) ────────────────────┐    │
│  │                                                        │    │
│  │  ┌──────────────────────────────────────────────────┐  │    │
│  │  │           APP (Next.js + Elysia + Bun)           │  │    │
│  │  │                                                  │  │    │
│  │  │  ┌──────────┐  ┌──────────┐  ┌──────────┐       │  │    │
│  │  │  │  Proxy   │  │ Next.js  │  │  Elysia  │       │  │    │
│  │  │  │(proxy.ts)│  │ (Pages)  │  │  (API)   │       │  │    │
│  │  │  └────┬─────┘  └──────────┘  └────┬─────┘       │  │    │
│  │  │       └───────────────────────────┘              │  │    │
│  │  └──────────────────────┬───────────────────────────┘  │    │
│  │                         │                              │    │
│  │  ┌──────────────────────┼───────────────────────────┐  │    │
│  │  │              WORKERS PROCESS                     │  │    │
│  │  │  ┌──────────┐  ┌──────────┐  ┌──────────┐       │  │    │
│  │  │  │Analytics │  │Aggregat. │  │ Cleanup  │       │  │    │
│  │  │  │  Worker  │  │  Worker  │  │  Worker  │       │  │    │
│  │  │  └──────────┘  └──────────┘  └──────────┘       │  │    │
│  │  └──────────────────────────────────────────────────┘  │    │
│  │                                                        │    │
│  │  ┌──────────────────────────────────────────────────┐  │    │
│  │  │        GeoIP Downloader (cron mensal)            │  │    │
│  │  │   Auto-download MMDB via jsDelivr CDN            │  │    │
│  │  └──────────────────────────────────────────────────┘  │    │
│  │             ▲ volume compartilhado                      │    │
│  └─────────────┼──────────────────────────────────────────┘    │
│                │                                               │
│  ┌─────────────┼── Serviços Dokploy (Templates) ────────────┐  │
│  │             │                                             │  │
│  │  ┌─────────▼────┐  ┌──────────┐  ┌────────────────────┐  │  │
│  │  │ PostgreSQL   │  │  Redis   │  │      SigNoz        │  │  │
│  │  │     16       │  │    7     │  │  (Observability)   │  │  │
│  │  └──────────────┘  └──────────┘  └────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                │
│  ┌─ Traefik (Dokploy) ──────────────────────────────────────┐  │
│  │  urlfy.cc:443       → app:3000                            │  │
│  │  signoz.urlfy.cc:443 → signoz-frontend:3301               │  │
│  └───────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────┘
```

## Stack Tecnológica

| Camada            | Tecnologia               | Justificativa                                               |
| ----------------- | ------------------------ | ----------------------------------------------------------- |
| **Runtime**       | Bun 1.x+                 | APIs nativas (Bun SQL, Bun Redis) para máxima performance   |
| **Frontend**      | Next.js 16+ (App Router) | SSR, RSC, Middleware nativo                                 |
| **API**           | ElysiaJS                 | Type-safety E2E, integração com Next.js via catch-all route |
| **Banco**         | PostgreSQL 16+           | Particionamento nativo, robustez                            |
| **Cache**         | Redis 7+                 | `Bun.RedisClient` nativo com protocolo RESP3                |
| **Queue**         | Redis Streams (Bun)      | Event-driven com XADD/XREADGROUP nativo via `Bun.redis`     |
| **ORM**           | Drizzle                  | Type-safe, compatível com Bun SQL                           |
| **Auth**          | Better-Auth              | Plugins: `twoFactor`, `admin`, `apiKey`, `openAPI`          |
| **Geo**           | GeoLite2 (jsDelivr CDN)  | Auto-download via public mirror, no credentials required    |
| **Observability** | SigNoz                   | OpenTelemetry nativo, logs/traces/métricas unificados       |
| **Styling**       | TailwindCSS + Shadcn/UI  | Componentes acessíveis, design system                       |

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

O `docker-compose.yml` sobe apenas PostgreSQL + Redis para dev local. A app roda fora do Docker via `bun run dev`.

```yaml
# docker/docker-compose.yml (dev)
services:
  postgres:
    image: postgres:16-alpine
    ports: ['127.0.0.1:5432:5432']
  redis:
    image: redis:7-alpine
    ports: ['127.0.0.1:6379:6379']
  geoip-downloader:
    build: ./geoip # Download one-shot
```

**Uso:** `bun run docker:up` → `bun run dev`

### Produção (Dokploy)

Em produção, o deploy é feito via **Dokploy** (self-hosted PaaS). A arquitetura é organizada como **1 Projeto Dokploy** com serviços independentes:

| Serviço       | Tipo no Dokploy     | Origem                           |
| ------------- | ------------------- | -------------------------------- |
| PostgreSQL 16 | Database (template) | Dokploy managed                  |
| Redis 7       | Database (template) | Dokploy managed                  |
| SigNoz        | Compose (template)  | Dokploy managed                  |
| App + GeoIP   | Compose (Git)       | `docker/docker-compose.prod.yml` |

O `docker-compose.prod.yml` contém apenas a **app** e o **geoip-downloader** com volume compartilhado:

```yaml
# docker/docker-compose.prod.yml (Dokploy)
services:
  app:
    build:
      dockerfile: docker/Dockerfile
      target: runner
    environment:
      - DATABASE_URL=${DATABASE_URL} # Apontando para o Postgres do Dokploy
      - REDIS_URL=${REDIS_URL} # Apontando para o Redis do Dokploy
      - OTEL_EXPORTER_OTLP_ENDPOINT=${OTEL_EXPORTER_OTLP_ENDPOINT}
    volumes:
      - geoip_data:/app/geoip:ro

  geoip-downloader:
    build: docker/geoip
    volumes:
      - geoip_data:/app/geoip # Download + cron mensal

volumes:
  geoip_data:
```

### Arquivos Docker no Repositório

```
docker/
├── Dockerfile               # Build multi-stage da app (3 stages)
├── docker-compose.yml       # Dev local (Postgres + Redis + GeoIP)
├── docker-compose.prod.yml  # Produção Dokploy (App + GeoIP)
└── geoip/
    ├── Dockerfile           # Alpine + curl + cron
    ├── geoip-entrypoint.sh  # Download + inicia cron daemon
    └── geoip-refresh.sh     # Script de download/refresh
```

### Notas de Produção

- **PostgreSQL, Redis, SigNoz:** Provisionados como serviços separados no Dokploy (templates nativos)
- **Networking:** Dokploy coloca todos os serviços do projeto na mesma Docker network interna
- **SSL/TLS:** Gerenciado pelo Traefik integrado ao Dokploy (Let's Encrypt automático)
- **GeoIP:** Usa mirror público (jsDelivr CDN), sem necessidade de credenciais

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

## Observability (SigNoz)

### Integração OpenTelemetry

```typescript
import { trace } from '@opentelemetry/api';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';

const exporter = new OTLPTraceExporter({
  url: 'http://signoz-otel-collector:4318/traces'
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

- **PostgreSQL:** `pg_dump` via cron na VPS (`/opt/backups/urlfy/`) ou **pgBackRest** para PITR
- **Redis:** Dados são cache, não requerem backup (RDB snapshots opcionais)
- **GeoIP:** Não requer backup — re-download automático via cron mensal
- **Dokploy:** Backup e restore dos volumes Docker gerenciados pelo painel
