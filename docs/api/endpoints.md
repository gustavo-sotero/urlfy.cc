# API Reference - urlfy.cc

> 📖 [← Voltar ao PRD](../prd.md) | [← Security](../architecture/security.md)

**Navegação:** [Overview](../architecture/overview.md) · [Database](../architecture/database-schema.md) · [Caching](../architecture/caching-strategy.md) · [Security](../architecture/security.md) · [API](#)

---

## Visão Geral

A API REST é construída com **ElysiaJS** rodando em `app/api/[[...slugs]]/route.ts`. Todos os endpoints são versionados sob `/api/`.

**Documentação interativa:**

- Elysia Swagger: `/api/docs`
- Better-Auth OpenAPI: `/api/auth/reference`

---

## Autenticação

### Métodos Suportados

| Método       | Header/Cookie                   | Uso                 |
| ------------ | ------------------------------- | ------------------- |
| Session      | Cookie `session`                | Frontend (Browser)  |
| Bearer Token | `Authorization: Bearer <token>` | API externa         |
| API Key      | `x-api-key: urlfy_sk_...`       | Acesso programático |

---

## Formato de Resposta

### Sucesso

```json
{
  "success": true,
  "data": { ... }
}
```

### Sucesso com Paginação

```json
{
  "success": true,
  "data": [ ... ],
  "meta": {
    "total": 1000,
    "page": 1,
    "perPage": 20,
    "lastPage": 50,
    "hasMore": true
  }
}
```

### Erro

```json
{
  "success": false,
  "error": {
    "code": "LINK_EXPIRED",
    "message": "Este link expirou em 2026-01-01T00:00:00Z",
    "details": {}
  },
  "requestId": "req_abc123"
}
```

---

## Códigos de Erro

| Código              | HTTP | Descrição                                  |
| ------------------- | ---- | ------------------------------------------ |
| `VALIDATION_ERROR`  | 400  | Dados de entrada inválidos                 |
| `UNAUTHORIZED`      | 401  | Token ausente ou inválido                  |
| `PASSWORD_REQUIRED` | 401  | Link protegido por senha                   |
| `FORBIDDEN`         | 403  | Sem permissão para este recurso            |
| `LINK_NOT_FOUND`    | 404  | Link não existe                            |
| `LINK_EXPIRED`      | 410  | Link expirado                              |
| `REDIRECT_LOOP`     | 421  | Profundidade de redirect excedida (max: 3) |
| `URL_MALICIOUS`     | 422  | URL detectada como maliciosa               |
| `RATE_LIMITED`      | 429  | Limite de requisições excedido             |
| `LINK_BANNED`       | 451  | Link banido por violação de TOS            |
| `QUOTA_EXCEEDED`    | 402  | Limite de links do plano atingido          |
| `INTERNAL_ERROR`    | 500  | Erro interno do servidor                   |

---

## Endpoints Públicos

### Health Check

```http
GET /api/health
```

**Response:**

```json
{
  "status": "ok",
  "timestamp": "2026-01-06T12:00:00Z"
}
```

---

### Readiness Check

```http
GET /api/health/ready
```

**Response:**

```json
{
  "status": "ready",
  "services": {
    "database": "ok",
    "redis": "ok"
  }
}
```

---

### Criar Link

```http
POST /api/links
Content-Type: application/json
Idempotency-Key: idem_<uuid>  # Opcional
```

**Body (Guest):**

```json
{
  "url": "https://example.com/very-long-url"
}
```

**Body (Autenticado):**

```json
{
  "url": "https://example.com/very-long-url",
  "customAlias": "my-link", // Opcional
  "expiresAt": "2026-02-01T00:00:00Z", // Opcional
  "maxClicks": 1000, // Opcional
  "password": "secret123", // Opcional
  "redirectType": 301, // 301 ou 302
  "metaTitle": "Custom Title", // Opcional
  "metaDescription": "Description", // Opcional
  "metaImage": "https://cdn.example.com/image.png", // Opcional
  "utmSource": "twitter", // Opcional
  "utmMedium": "social", // Opcional
  "utmCampaign": "launch" // Opcional
}
```

**Response (201):**

```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "shortCode": "abc123",
    "shortUrl": "https://urlfy.cc/abc123",
    "originalUrl": "https://example.com/very-long-url",
    "createdAt": "2026-01-06T12:00:00Z"
  }
}
```

---

### Validar URL

```http
POST /api/links/validate
Content-Type: application/json
```

**Body:**

```json
{
  "url": "https://example.com"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "valid": true,
    "warnings": []
  }
}
```

---

### Preview de Link

```http
GET /api/links/by-code/:code/preview
```

**Response (link sem senha):**

```json
{
  "success": true,
  "data": {
    "shortCode": "abc123",
    "originalUrl": "https://example.com",
    "metaTitle": "Example Domain",
    "metaDescription": "This domain is for use in examples.",
    "metaImage": null,
    "createdAt": "2026-01-06T12:00:00Z",
    "isPasswordProtected": false
  }
}
```

**Response (link protegido por senha):**

```json
{
  "success": true,
  "data": {
    "shortCode": "xyz789",
    "metaTitle": null,
    "metaDescription": null,
    "metaImage": null,
    "createdAt": "2026-01-06T12:00:00Z",
    "isPasswordProtected": true
  }
}
```

---

### Gerar QR Code

```http
GET /api/links/:code/qr?size=200&format=png
```

**Query Parameters:**
| Param | Default | Valores |
|-------|---------|---------|
| `size` | 200 | 100-1000 |
| `format` | png | png, svg |

**Response:** Imagem binária (PNG ou SVG)

---

### Verificar Senha do Link

```http
POST /api/links/:code/verify-password
Content-Type: application/json
```

**Body:**

```json
{
  "password": "secret123"
}
```

**Response (sucesso):**

```json
{
  "success": true,
  "data": {
    "redirectUrl": "/abc123"
  }
}
```

**Response (falha):**

```json
{
  "success": false,
  "error": {
    "code": "INVALID_PASSWORD",
    "message": "Senha incorreta"
  }
}
```

---

## Endpoints Privados (Auth Required)

### Criar Links em Bulk

```http
POST /api/links/bulk
Authorization: Bearer <token>
Content-Type: application/json
```

**Body:**

```json
{
  "links": [
    { "url": "https://example1.com" },
    { "url": "https://example2.com", "customAlias": "custom" }
  ]
}
```

**Response (201):**

```json
{
  "success": true,
  "data": {
    "created": 2,
    "links": [ ... ]
  }
}
```

---

### Listar Links

```http
GET /api/links?page=1&perPage=20&sort=createdAt&order=desc
Authorization: Bearer <token>
```

**Query Parameters:**
| Param | Default | Descrição |
|-------|---------|-----------|
| `page` | 1 | Página atual |
| `perPage` | 20 | Itens por página (max: 100) |
| `sort` | createdAt | Campo de ordenação |
| `order` | desc | asc ou desc |
| `search` | - | Busca por URL ou código |
| `status` | all | all, active, inactive, expired |

---

### Obter Link

```http
GET /api/links/:id
Authorization: Bearer <token>
```

---

### Atualizar Link

```http
PATCH /api/links/:id
Authorization: Bearer <token>
Content-Type: application/json
```

**Body:**

```json
{
  "isActive": false,
  "expiresAt": "2026-03-01T00:00:00Z",
  "metaTitle": "New Title"
}
```

---

### Deletar Link

```http
DELETE /api/links/:id
Authorization: Bearer <token>
```

**Response (204):** No Content

> **Nota:** Soft delete. Link pode ser restaurado em 30 dias.

---

### Restaurar Link

```http
POST /api/links/:id/restore
Authorization: Bearer <token>
```

---

### Duplicar Link

```http
POST /api/links/:id/duplicate
Authorization: Bearer <token>
```

**Response (201):**

```json
{
  "success": true,
  "data": {
    "id": "new-uuid",
    "shortCode": "xyz789",
    ...
  }
}
```

---

### Stats Rápidas

```http
GET /api/links/:id/stats
Authorization: Bearer <token>
```

**Response:**

```json
{
  "success": true,
  "data": {
    "clicks": 1234,
    "uniqueVisitors": 890,
    "lastClickedAt": "2026-01-06T11:30:00Z"
  }
}
```

---

### Analytics Detalhado

```http
GET /api/analytics/:linkId?from=2026-01-01&to=2026-01-31&granularity=day
Authorization: Bearer <token>
```

**Query Parameters:**
| Param | Default | Valores |
|-------|---------|---------|
| `from` | 7 dias atrás | ISO date |
| `to` | hoje | ISO date |
| `granularity` | day | hour, day, week |

**Response:**

```json
{
  "success": true,
  "data": {
    "summary": {
      "totalClicks": 5000,
      "uniqueVisitors": 3200,
      "avgClicksPerDay": 166
    },
    "timeSeries": [
      { "date": "2026-01-01", "clicks": 150, "unique": 120 },
      { "date": "2026-01-02", "clicks": 180, "unique": 140 }
    ],
    "breakdown": {
      "countries": [
        { "code": "BR", "name": "Brazil", "clicks": 2000 },
        { "code": "US", "name": "United States", "clicks": 1500 }
      ],
      "devices": [
        { "type": "mobile", "clicks": 3000 },
        { "type": "desktop", "clicks": 1800 }
      ],
      "browsers": [
        { "name": "Chrome", "clicks": 2500 },
        { "name": "Safari", "clicks": 1200 }
      ],
      "referrers": [
        { "domain": "twitter.com", "clicks": 1000 },
        { "domain": "direct", "clicks": 800 }
      ]
    }
  }
}
```

---

## Endpoints de Usuário

### Perfil

```http
GET /api/me
Authorization: Bearer <token>
```

---

### Quota

```http
GET /api/me/quota
Authorization: Bearer <token>
```

**Response:**

```json
{
  "success": true,
  "data": {
    "used": 45,
    "limit": 100,
    "remaining": 55,
    "percentUsed": 45
  }
}
```

---

### Exportar Dados (LGPD)

```http
GET /api/me/export
Authorization: Bearer <token>
```

**Response:** JSON com todos os dados do usuário

---

### Solicitar Exclusão (LGPD)

```http
DELETE /api/me/data
Authorization: Bearer <token>
```

**Response:**

```json
{
  "success": true,
  "data": {
    "requestId": "uuid",
    "deadline": "2026-01-09T12:00:00Z",
    "message": "Sua solicitação será processada em até 72 horas."
  }
}
```

---

## Endpoints Admin

### KPIs Globais

```http
GET /api/admin/stats
Authorization: Bearer <token>
```

**Response:**

```json
{
  "success": true,
  "data": {
    "totalLinks": 50000,
    "totalClicks": 1500000,
    "totalUsers": 2000,
    "activeLinksToday": 5000,
    "requestsPerSecond": 150
  }
}
```

---

### Banir Link

```http
PATCH /api/admin/links/:id
Authorization: Bearer <token>
Content-Type: application/json
```

**Body:**

```json
{
  "isBanned": true,
  "bannedReason": "Spam/Phishing"
}
```

---

### Health Check Detalhado

```http
GET /api/health/detailed
Authorization: Bearer <token>  # Admin only
```

**Response:**

```json
{
  "status": "healthy",
  "services": {
    "database": {
      "status": "ok",
      "latencyMs": 2
    },
    "redis": {
      "status": "ok",
      "latencyMs": 1,
      "hitRate": 0.92
    },
    "queue": {
      "status": "ok",
      "pendingJobs": 15,
      "failedJobs": 0
    }
  },
  "uptime": 86400
}
```

---

## Versionamento e Deprecation

### Headers de Deprecation

Quando um endpoint estiver em processo de descontinuação:

```http
HTTP/1.1 200 OK
Deprecation: true
Sunset: Sat, 01 Apr 2027 00:00:00 GMT
Link: </api/v2/links>; rel="successor-version"
```

### Estratégia

1. **Anúncio:** 90 dias antes
2. **Período de transição:** Mínimo 6 meses
3. **Remoção:** Retorna `410 Gone`
