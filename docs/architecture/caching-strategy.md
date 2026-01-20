# Caching Strategy - urlfy.cc

> 📖 [← Voltar ao PRD](../prd.md) | [← Database](./database-schema.md) | [Security →](./security.md)

**Navegação:** [Overview](./overview.md) · [Database](./database-schema.md) · [Caching](#) · [Security](./security.md) · [API](../api/endpoints.md)

---

## Visão Geral

O sistema utiliza **Redis 7+** via `Bun.redis` (driver TCP nativo, protocolo RESP3) como camada de cache principal.

## Cache Layers

```
┌─────────────────────────────────────────┐
│  Layer 1: Application Cache (Redis)    │
│  - Link data, metadata, QR codes       │
│  - Rate limiting, sessions             │
└─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│  Layer 2: Database (PostgreSQL)        │
│  - Source of truth                     │
└─────────────────────────────────────────┘
```

## Cache Keys

| Pattern                     | TTL      | Descrição                           |
| --------------------------- | -------- | ----------------------------------- |
| `link:{code}`               | 1 hora   | Dados do link para redirect         |
| `link:meta:{code}`          | 5 min    | OG metadata para preview            |
| `link:404:{code}`           | 5 min    | Cache negativo (código inexistente) |
| `link:banned:{code}`        | 24 horas | Links banidos                       |
| `qr:{code}:{size}:{format}` | 24 horas | QR Code gerado                      |
| `geo:{ip_prefix}`           | 24 horas | Geolocation por /24                 |
| `rl:{key}`                  | Sliding  | Rate limiting                       |
| `lock:link:{code}`          | 5 seg    | Distributed lock                    |
| `idempotency:{key}`         | 24 horas | Idempotency keys                    |

## Cache Structure

### `link:{code}`

```json
{
  "id": "uuid",
  "originalUrl": "https://example.com",
  "redirectType": 301,
  "isActive": true,
  "isBanned": false,
  "expiresAt": "2026-02-01T00:00:00Z",
  "maxClicks": null,
  "clicksCount": 42,
  "passwordHash": null
}
```

### `link:meta:{code}`

```json
{
  "metaTitle": "Custom Title",
  "metaDescription": "Custom description",
  "metaImage": "https://cdn.example.com/image.png"
}
```

---

## Stampede Protection

### Problema

Quando um cache entry expira, múltiplas requests simultâneas podem causar "thundering herd" no banco.

### Soluções Implementadas

#### 1. Distributed Lock (SETNX)

```typescript
const redis = new Bun.RedisClient();
const lockKey = `lock:link:${code}`;

// Tenta adquirir lock
const acquired = await redis.setnx(lockKey, '1');

if (acquired) {
  // Ganhou o lock - busca do banco e popula cache
  await redis.expire(lockKey, 5); // TTL 5 segundos

  const link = await db.query.links.findFirst({
    where: eq(links.shortCode, code)
  });

  await redis.set(`link:${code}`, JSON.stringify(link), 'EX', 3600);
  await redis.del(lockKey);

  return link;
} else {
  // Outro processo está populando - aguarda
  await Bun.sleep(50);
  const cached = await redis.get(`link:${code}`);
  return cached ? JSON.parse(cached) : null;
}
```

#### 2. Probabilistic Early Expiration (Opcional)

10% de chance de refresh quando TTL < 10% do original:

```typescript
const ttl = await redis.ttl(`link:${code}`);
const originalTtl = 3600; // 1 hora

if (ttl < originalTtl * 0.1 && Math.random() < 0.1) {
  // Refresh proativo em background
  refreshCacheInBackground(code);
}
```

---

## Cache Invalidation

### Eventos de Invalidação

| Evento             | Ações                                       |
| ------------------ | ------------------------------------------- |
| Link atualizado    | `DEL link:{code}`, `DEL link:meta:{code}`   |
| Link banido        | `DEL link:{code}`, `SET link:banned:{code}` |
| Link deletado      | `DEL link:{code}`, `SET link:404:{code}`    |
| Meta tags editadas | `DEL link:meta:{code}`, `DEL qr:{code}:*`   |

### Implementação

```typescript
async function invalidateLinkCache(
  code: string,
  reason: 'update' | 'ban' | 'delete'
) {
  const pipeline = redis.pipeline();

  // Sempre remove o cache principal
  pipeline.del(`link:${code}`);
  pipeline.del(`link:meta:${code}`);

  // Ações específicas por tipo
  switch (reason) {
    case 'ban':
      pipeline.set(`link:banned:${code}`, '1', 'EX', 86400);
      break;
    case 'delete':
      pipeline.set(`link:404:${code}`, '1', 'EX', 300);
      break;
  }

  // Invalida QR codes (pattern delete)
  const qrKeys = await redis.keys(`qr:${code}:*`);
  if (qrKeys.length > 0) {
    pipeline.del(...qrKeys);
  }

  await pipeline.exec();
}
```

---

## Cache Negativo

Previne brute force de códigos inexistentes:

```typescript
async function getLinkByCode(code: string) {
  // Verifica cache negativo primeiro
  const is404 = await redis.get(`link:404:${code}`);
  if (is404) return null;

  // Verifica cache normal
  const cached = await redis.get(`link:${code}`);
  if (cached) return JSON.parse(cached);

  // Busca no banco
  const link = await db.query.links.findFirst({
    where: eq(links.shortCode, code)
  });

  if (!link) {
    // Cache negativo por 5 minutos
    await redis.set(`link:404:${code}`, '1', 'EX', 300);
    return null;
  }

  // Cache positivo por 1 hora
  await redis.set(`link:${code}`, JSON.stringify(link), 'EX', 3600);
  return link;
}
```

---

## Idempotency Keys

Para operações seguras em caso de retry:

```typescript
async function handleWithIdempotency<T>(
  key: string,
  handler: () => Promise<T>
): Promise<T> {
  const cacheKey = `idempotency:${key}`;

  // Verifica se já processou
  const cached = await redis.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }

  // Processa e cacheia resultado
  const result = await handler();
  await redis.set(cacheKey, JSON.stringify(result), 'EX', 86400); // 24h

  return result;
}
```

**Headers esperados:**

```http
POST /api/links
Idempotency-Key: idem_550e8400-e29b-41d4-a716-446655440000
```

---

## Métricas de Cache

### SLOs

| Métrica           | Target | Crítico |
| ----------------- | ------ | ------- |
| Cache Hit Rate    | > 85%  | < 70%   |
| Redis Latency P99 | < 5ms  | > 20ms  |

### Monitoramento

```typescript
// Instrumentação para SigNoz
import { metrics } from '@opentelemetry/api';

const cacheHitCounter = metrics.createCounter('cache.hits');
const cacheMissCounter = metrics.createCounter('cache.misses');

async function getCachedLink(code: string) {
  const cached = await redis.get(`link:${code}`);

  if (cached) {
    cacheHitCounter.add(1, { cache: 'link' });
    return JSON.parse(cached);
  }

  cacheMissCounter.add(1, { cache: 'link' });
  // ... fetch from DB
}
```

---

## Graceful Degradation

Quando Redis está indisponível:

```typescript
async function getLinkWithFallback(code: string) {
  try {
    return await getCachedLink(code);
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      // Redis down - fallback direto para PostgreSQL
      console.warn('Redis unavailable, falling back to PostgreSQL');

      // Alerta para SigNoz
      recordEvent('redis_fallback', { code });

      return await db.query.links.findFirst({
        where: eq(links.shortCode, code)
      });
    }
    throw error;
  }
}
```
