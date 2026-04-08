# Security - urlfy.cc

> 📖 [← Voltar ao PRD](../prd.md) | [← Caching](./caching-strategy.md) | [API →](../api/endpoints.md)

**Navegação:** [Overview](./overview.md) · [Database](./database-schema.md) · [Caching](./caching-strategy.md) · [Security](#) · [API](../api/endpoints.md)

---

## Visão Geral

Este documento descreve as medidas de segurança implementadas no urlfy.cc.

---

## Rate Limiting

Implementado com registro canônico de políticas em `packages/contracts/src/rate-limit-policy.ts` e avaliador único em `packages/cache/src/rate-limiter-core.ts`, usando **Redis Sorted Sets** com algoritmo **Sliding Window**.

### Implementação

```typescript
import { RATE_LIMITS } from '@urlfy/contracts';
import { rateLimiter } from '@/server/lib/rate-limiter';

const policy = RATE_LIMITS.LINKS_CREATE_AUTH;

const result = await rateLimiter.checkTokenLimit('user:123', {
  points: policy.max,
  duration: Math.floor(policy.windowMs / 1000),
  failClosed: policy.failClosed
});
```

### Limites por Endpoint

| Endpoint                | Guest          | Autenticado        | Burst   | Window |
| ----------------------- | -------------- | ------------------ | ------- | ------ |
| `POST /links`           | 10/hora por IP | 100/hora por Token | 5/seg   | 1 hora |
| `POST /links/bulk`      | N/A            | 20/hora por Token  | 2/seg   | 1 hora |
| `GET /:code` (redirect) | 100/min por IP | -                  | 100/seg | 1 min  |
| `GET /links/:code/qr`   | 30/hora por IP | 120/hora por Token | 5/seg   | 1 hora |
| `GET /analytics/*`      | N/A            | 60/min por Token   | 10/seg  | 1 min  |
| `POST /admin/*`         | N/A            | 30/min por Token   | 5/seg   | 1 min  |

### Rate Limiting por Link (Redirect)

Para links virais, rate limiting por IP bloquearia usuários legítimos. Estratégia:

1. **Por link:** 5.000 cliques/min por link (detecta abuse coordenado)
2. **Por IP:** 100/min (usuário normal não clica 100x/min)
3. **Fingerprinting:** Hash de `User-Agent + Accept-Language` para detectar bots

### Política de Camadas (Canônica)

Para evitar dupla cobrança de custo no mesmo request path:

- **Camada 1 (Gateway API `/api/*`):** rate limit global para rotas de API.
- **Camada 2 (Redirect público `/r/:code`):** rate limit dedicado de redirect (`IP + link`) no próprio handler de redirect.
- **Camada 3 (Guard de abuso por link):** limite por `shortCode` aplicado apenas no fluxo de redirect.

Com isso, o redirect hot-path não passa pelo limiter global de `/api/*`, enquanto rotas administrativas e internas continuam protegidas pela camada de gateway.

## Canonical IP Derivation

All runtime IP extraction must use the canonical helpers in `@urlfy/telemetry`:

- `getClientIp(request: Request)` — for Elysia/Next.js route handlers with access to the full `Request` object.
- `getClientIpFromHeaders(headers: Headers)` — for contexts where only a `Headers` object is available (e.g., Next.js server components via `headers()`).

Direct parsing of proxy headers (`x-forwarded-for`, `x-real-ip`, etc.) in app-level code is forbidden and enforced by `scripts/validate-proxy-headers.ts` (run in CI).

Approved exemptions:
- `packages/telemetry/src/ip.ts` — the canonical implementation.
- `apps/web/src/app/api/[[...slugs]]/route.ts` — the API gateway proxy, which *sets* (not parses) `x-forwarded-for` using `getClientIp()` for downstream forwarding.

## Runtime Secret Guards

Os segredos de auth e env possuem sentinelas de build-time que nunca podem ser aceitas em runtime.

- `packages/auth-shared/src/auth-config.ts` rejeita `BETTER_AUTH_SECRET` placeholder e qualquer `SKIP_ENV_VALIDATION=1` fora do build do Next.js.
- `apps/web/src/lib/env.ts`, `apps/api/src/lib/env.ts` e `apps/worker/src/lib/env.ts` rejeitam sentinelas de `BETTER_AUTH_SECRET`, `INTERNAL_API_SECRET` e `INTERNAL_ANALYTICS_SECRET` durante validação real.
- O CI sobe a imagem `docker/web.Dockerfile` em smoke test para provar que o container falha sem env obrigatório e atende `/api/health` quando recebe env válido. Os health checks de runtime usam `/api/health/ready` para verificar as dependências reais do redirect path.

---

## Validação de URLs

### Processo de Validação

```typescript
async function validateUrl(url: string): Promise<ValidationResult> {
  // 1. Validação de formato
  if (!isValidUrlFormat(url)) {
    return { valid: false, error: 'INVALID_FORMAT' };
  }

  // 2. Protocolo permitido
  const { protocol } = new URL(url);
  if (!['http:', 'https:'].includes(protocol)) {
    return { valid: false, error: 'INVALID_PROTOCOL' };
  }

  // 3. Blacklist de domínios
  const domain = extractDomain(url);
  const isBanned = await checkBannedDomain(domain);
  if (isBanned) {
    return { valid: false, error: 'DOMAIN_BANNED' };
  }

  // 4. Bloqueio de outros encurtadores
  if (isShortenerDomain(domain)) {
    return { valid: false, error: 'SHORTENER_NOT_ALLOWED' };
  }

  return { valid: true };
}
```

### Encurtadores Bloqueados

```typescript
const BLOCKED_SHORTENERS = [
  'bit.ly',
  'tinyurl.com',
  't.co',
  'goo.gl',
  'ow.ly',
  'is.gd',
  'buff.ly',
  'adf.ly',
  'shorturl.at',
  'tiny.cc',
  'rb.gy'
];
```

---

## Proteção contra Redirect Loops

### Header de Profundidade

```typescript
// No middleware de redirect
const depth = parseInt(request.headers.get('X-Redirect-Depth') ?? '0');

if (depth >= 3) {
  return new Response(null, {
    status: 421, // Misdirected Request
    headers: {
      'X-Error-Code': 'REDIRECT_LOOP'
    }
  });
}

// Adiciona header na resposta de redirect
return Response.redirect(targetUrl, redirectType, {
  headers: {
    'X-Redirect-Depth': String(depth + 1)
  }
});
```

---

## Proteção de Links com Senha

### Fluxo

```
1. GET /:code
   └─ Link tem password_hash?
      ├─ Sim → Verifica cookie `urlfy_unlock_{code}`
      │        ├─ Válido → Redireciona
      │        └─ Inválido → 401 + redirect /unlock/:code
      └─ Não → Redireciona

2. POST /api/links/by-code/:code/verify-password
  └─ Rate limit canônico por IP + link code
    └─ Valida senha (bcrypt)
      ├─ Sucesso → Set-Cookie (JWT, 5min TTL, `exp` obrigatório)
      ├─ Senha inválida → 401
      └─ Limite excedido → 429
```

### Implementação

```typescript
import { sign } from 'jsonwebtoken';

// Verificação de senha
async function verifyPassword(code: string, password: string) {
  const link = await getLink(code);

  if (!link.passwordHash) {
    throw new Error('LINK_NOT_PROTECTED');
  }

  const valid = await Bun.password.verify(password, link.passwordHash);

  if (!valid) {
    throw new Error('INVALID_PASSWORD');
  }

  // Gera token de unlock válido por 5 minutos.
  // O payload deve carregar `exp`; tokens sem esse claim,
  // expirados, ou com assinatura inválida são rejeitados.
  const token = sign(
    {
      code,
      type: 'unlock',
      exp: Math.floor(Date.now() / 1000) + 300
    },
    process.env.JWT_SECRET!
  );

  return { token };
}
```

---

## Headers de Segurança

Configurados via middleware ou next.config.ts:

```typescript
const securityHeaders = {
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self'",
    "connect-src 'self'",
    "frame-ancestors 'none'"
  ].join('; '),

  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',

  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload'
};
```

---

## CORS Configuration

```typescript
const corsConfig = {
  origin:
    process.env.NODE_ENV === 'production'
      ? ['https://urlfy.cc', 'https://www.urlfy.cc']
      : ['http://localhost:3000'],

  methods: ['GET', 'POST', 'PATCH', 'DELETE'],

  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-API-Key',
    'Idempotency-Key'
  ],

  credentials: true,
  maxAge: 86400 // 24 horas
};
```

---

## CSRF Protection

```typescript
// Cookies com SameSite=Strict
const cookieConfig = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/'
};

// Token CSRF para formulários (se não usar SPA)
// Gerenciado pelo Better-Auth automaticamente
```

---

## Sanitização de Meta Tags

OG tags customizados devem ser sanitizados:

```typescript
function sanitizePlainText(value: string, maxLength: number): string | null {
  const stripped = value
    .replace(/<(script|style|iframe|object|embed|svg|math|noscript|template)[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\b(?:javascript|data|vbscript|file|about)\s*:/gi, '')
    .trim()
    .slice(0, maxLength)
    .trim();

  return stripped.length > 0 ? stripped : null;
}

function sanitizeMetaTags(input: {
  metaTitle?: string;
  metaDescription?: string;
  metaImage?: string;
}) {
  return {
    metaTitle: input.metaTitle
      ? sanitizePlainText(input.metaTitle, 60)
      : null,

    metaDescription: input.metaDescription
      ? sanitizePlainText(input.metaDescription, 160)
      : null,

    metaImage: input.metaImage ? validateImageUrl(input.metaImage) : null
  };
}

function validateImageUrl(url: string): string | null {
  try {
    const parsed = new URL(url);

    // Apenas HTTPS
    if (parsed.protocol !== 'https:') return null;

    // Whitelist de CDNs conhecidos (ou proxy próprio)
    const allowedHosts = ['cdn.urlfy.cc', 'images.unsplash.com', 'i.imgur.com'];

    if (!allowedHosts.includes(parsed.host)) {
      // TODO: Proxy via serviço próprio
      return null;
    }

    return url;
  } catch {
    return null;
  }
}
```

---

## LGPD/GDPR Compliance

### Anonimização de IPs

IPs nunca são armazenados em texto. São convertidos em hash imediatamente:

```typescript
import { createHash } from 'crypto';

function hashIp(ip: string, salt: string): string {
  return createHash('sha256').update(`${ip}:${salt}`).digest('hex');
}

// Salt rotacionado semanalmente
function getWeeklySalt(): string {
  const now = new Date();
  const year = now.getFullYear();
  const week = getWeekNumber(now);
  return `${year}-W${week}`;
}
```

### Endpoints de Compliance

| Endpoint              | Descrição                                |
| --------------------- | ---------------------------------------- |
| `GET /api/me/export`  | Exporta todos os dados do usuário (JSON) |
| `DELETE /api/me/data` | Solicita exclusão de dados               |

### Processo de Exclusão

1. Usuário solicita exclusão
2. Sistema cria registro em `data_deletion_requests`
3. Prazo legal: 72 horas
4. Job processa e remove:
   - Links do usuário (hard delete)
   - Eventos de analytics associados
   - Dados de autenticação
5. Confirmação enviada por email

---

## Autenticação (Better-Auth)

### Plugins Ativos

| Plugin      | Função                                |
| ----------- | ------------------------------------- |
| `twoFactor` | TOTP obrigatório para admins          |
| `admin`     | Gestão de usuários (ban, roles)       |
| `apiKey`    | Acesso programático via `x-api-key`   |
| `openAPI`   | Documentação em `/api/auth/reference` |

### Provedores OAuth

- Email/Password (com verificação)
- Google
- GitHub

### API Keys

```http
GET /api/links
x-api-key: urlfy_sk_live_abc123...
```

---

## Alertas de Segurança

Configurados no backend de observabilidade (Grafana LGTM / OTLP):

| Alerta           | Condição                        | Ação                  |
| ---------------- | ------------------------------- | --------------------- |
| Brute Force      | > 50 falhas de login/IP em 5min | Block IP + alerta     |
| API Abuse        | > 1000 req/min por API key      | Throttle + alerta     |
| Suspicious Link  | Link reportado 3+ vezes         | Review queue + alerta |
| Failed Deletions | LGPD deadline em 12h            | Alerta urgente        |
