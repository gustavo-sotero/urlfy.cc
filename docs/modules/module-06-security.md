# Módulo 6: Security & Compliance

> 📖 [← Módulo 5: Analytics](./module-05-analytics.md) | [Módulo 7: Interfaces de Usuário →](./module-07-ui.md)

**Requisitos Cobertos:** RNF-01 a RNF-05, RF-34 a RF-38, Security Architecture

---

## 1. Visão Geral

Este módulo implementa todas as medidas de **segurança e conformidade legal** do urlfy.cc:

- Rate limiting por IP, token e link
- Headers de segurança (CSP, HSTS, etc.)
- CORS e CSRF protection
- Sanitização de inputs
- Anti-abuse e detecção de anomalias
- Endpoints LGPD/GDPR
- Audit logs

---

## 2. Arquitetura

```
┌─────────────────────────────────────────────────────────────────┐
│                        Request Flow                             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Layer 1: Security Headers (next.config.ts / middleware)       │
│  CSP, HSTS, X-Frame-Options, X-Content-Type-Options            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Layer 2: Rate Limiting (Redis Sliding Window)                 │
│  - Per IP (guests)                                             │
│  - Per Token (authenticated)                                   │
│  - Per Link (redirect abuse)                                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Layer 3: Input Validation & Sanitization                      │
│  - URL validation                                              │
│  - Meta tags sanitization (DOMPurify)                          │
│  - SQL injection prevention (Drizzle ORM)                      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Layer 4: Authentication & Authorization                       │
│  - Session validation                                          │
│  - Role-based access control                                   │
│  - 2FA enforcement for admins                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Estrutura de Diretórios

```
src/
├── server/
│   ├── middleware/
│   │   ├── security-headers.ts     # Headers de segurança
│   │   ├── rate-limit.ts           # Rate limiting
│   │   ├── cors.ts                 # CORS config
│   │   └── anti-abuse.ts           # Detecção de anomalias
│   ├── services/
│   │   ├── audit.service.ts        # Audit logs
│   │   ├── gdpr.service.ts         # LGPD/GDPR
│   │   └── sanitizer.service.ts    # Sanitização
│   ├── api/
│   │   └── v1/
│   │       ├── me/
│   │       │   ├── export.ts       # GET /me/export
│   │       │   └── data.ts         # DELETE /me/data
│   │       └── admin/
│   │           └── audit.ts        # GET /admin/audit
│   └── lib/
│       └── validators.ts           # Validadores
├── db/
│   └── schema/
│       └── audit.ts                # Schema audit_logs
└── types/
    └── security.types.ts           # Tipos
```

---

## 4. Rate Limiting

### 4.1 Configuração

```typescript
// src/server/lib/rate-limiter.ts
import { getRedisClient } from './redis';
import type { Context } from 'elysia';

// Configurações por endpoint
const RATE_LIMITS = {
  // Criação de links
  'POST /api/links': {
    guest: { points: 10, duration: 3600 }, // 10/hora
    auth: { points: 100, duration: 3600 } // 100/hora
  },
  // Bulk creation
  'POST /api/links/bulk': {
    guest: null, // Não permitido
    auth: { points: 20, duration: 3600 }
  },
  // Redirect
  'GET /:code': {
    perIP: { points: 100, duration: 60 }, // 100/min
    perLink: { points: 5000, duration: 60 } // 5000/min
  },
  // QR Code
  'GET /api/links/:code/qr': {
    guest: { points: 30, duration: 3600 },
    auth: { points: 120, duration: 3600 }
  },
  // Analytics
  'GET /api/analytics/*': {
    guest: null,
    auth: { points: 60, duration: 60 }
  },
  // Admin
  'POST /api/admin/*': {
    guest: null,
    auth: { points: 30, duration: 60 }
  }
} as const;

// Implementação manual usando Redis Sorted Sets
class RateLimiter {
  private redis = getRedisClient();

  async checkLimit(key: string, config: RateLimitConfig): Promise<RateLimitResult> {
    const redisKey = `rl:${key}`;
    const now = Date.now();
    const windowStart = now - config.duration * 1000;

    // Remove entradas antigas
    await this.redis.send('ZREMRANGEBYSCORE', [redisKey, '-inf', String(windowStart)]);

    // Conta requisições atuais
    const count = await this.redis.send('ZCARD', [redisKey]) as number;

    // Verifica se está dentro do limite
    if (count < config.points) {
      await this.redis.send('ZADD', [redisKey, String(now), `${now}-${Math.random()}`]);
      await this.redis.send('EXPIRE', [redisKey, String(config.duration)]);
      return { allowed: true, remaining: config.points - count - 1 };
    }

    return { allowed: false, remaining: 0, retryAfter: config.duration };
  }
}

const rateLimiter = new RateLimiter();
  points: 100,
  duration: 60
});

// Limiter por Link (redirect abuse)
const linkLimiter = new RateLimiterRedis({
  storeClient: redis,
  keyPrefix: 'rl:link',
  points: 5000,
  duration: 60
});

export async function rateLimit(
  ctx: Context,
  type: 'ip' | 'token' | 'link',
  key: string
): Promise<boolean> {
  try {
    const limiter =
      type === 'ip' ? ipLimiter : type === 'token' ? tokenLimiter : linkLimiter;

    await limiter.consume(key);
    return true;
  } catch (error) {
    if (error instanceof Error && 'msBeforeNext' in error) {
      const rateLimitError = error as { msBeforeNext: number };
      ctx.set.headers['Retry-After'] = String(
        Math.ceil(rateLimitError.msBeforeNext / 1000)
      );
      ctx.set.headers['X-RateLimit-Reset'] = String(
        Date.now() + rateLimitError.msBeforeNext
      );
    }
    return false;
  }
}
```

### 4.2 Middleware de Rate Limiting

```typescript
// src/server/middleware/rate-limit.middleware.ts
import { Elysia } from 'elysia';
import { getClientIp } from '@urlfy/telemetry';
import { rateLimit } from './rate-limit';

export const rateLimitMiddleware = new Elysia({ name: 'rate-limit' })
  .derive(({ request, headers }) => {
    // All IP derivation uses the canonical helper in @urlfy/telemetry.
    // Direct proxy-header parsing (x-forwarded-for, x-real-ip) is forbidden
    // in runtime code and enforced by scripts/validate-proxy-headers.ts.
    const ip = getClientIp(request);

    const token = headers['authorization']?.replace('Bearer ', '') ?? null;
    const apiKey = headers['x-api-key'] ?? null;

    return { clientIp: ip, authToken: token, apiKey };
  })
  .onBeforeHandle(async (ctx) => {
    const { clientIp, authToken, apiKey } = ctx;
    const key = authToken ?? apiKey ?? clientIp;
    const type = authToken || apiKey ? 'token' : 'ip';

    const allowed = await rateLimit(ctx, type, key);

    if (!allowed) {
      ctx.set.status = 429;
      return {
        success: false,
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many requests. Please try again later.'
        }
      };
    }
  });
```

---

## 5. Security Headers

### 5.1 Next.js Config

```typescript
// next.config.ts
import type { NextConfig } from 'next';

const securityHeaders = [
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self'",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'"
    ].join('; ')
  },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-XSS-Protection', value: '1; mode=block' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=()'
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=31536000; includeSubDomains; preload'
  }
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders
      }
    ];
  }
};

export default nextConfig;
```

---

## 6. CORS Configuration

```typescript
// src/server/middleware/cors.ts
import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';

const ALLOWED_ORIGINS =
  process.env.NODE_ENV === 'production'
    ? ['https://urlfy.cc', 'https://www.urlfy.cc']
    : ['http://localhost:3000', 'http://127.0.0.1:3000'];

export const corsMiddleware = new Elysia({ name: 'cors' }).use(
  cors({
    origin: ALLOWED_ORIGINS,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-API-Key',
      'Idempotency-Key',
      'X-Request-Id'
    ],
    credentials: true,
    maxAge: 86400 // 24 horas
  })
);
```

---

## 7. Input Sanitization

### 7.1 Sanitizer Service

```typescript
// src/server/services/sanitizer.service.ts
import DOMPurify from 'isomorphic-dompurify';

const ALLOWED_IMAGE_HOSTS = [
  'cdn.urlfy.cc',
  'images.unsplash.com',
  'i.imgur.com',
  'pbs.twimg.com'
];

export class SanitizerService {
  /**
   * Sanitiza meta tags OG
   */
  sanitizeMetaTags(input: {
    title?: string | null;
    description?: string | null;
    image?: string | null;
  }) {
    return {
      title: this.sanitizeText(input.title, 60),
      description: this.sanitizeText(input.description, 160),
      image: this.sanitizeImageUrl(input.image)
    };
  }

  /**
   * Remove HTML e limita tamanho
   */
  sanitizeText(
    text: string | null | undefined,
    maxLength: number
  ): string | null {
    if (!text) return null;

    const clean = DOMPurify.sanitize(text, {
      ALLOWED_TAGS: [], // Remove todas as tags
      ALLOWED_ATTR: []
    });

    return clean.slice(0, maxLength).trim() || null;
  }

  /**
   * Valida URL de imagem contra whitelist
   */
  sanitizeImageUrl(url: string | null | undefined): string | null {
    if (!url) return null;

    try {
      const parsed = new URL(url);

      // Verifica protocolo
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return null;
      }

      // Verifica host contra whitelist
      const isAllowed = ALLOWED_IMAGE_HOSTS.some(
        (host) =>
          parsed.hostname === host || parsed.hostname.endsWith(`.${host}`)
      );

      if (!isAllowed) {
        console.warn(`[Sanitizer] Image host not allowed: ${parsed.hostname}`);
        return null;
      }

      return url;
    } catch {
      return null;
    }
  }

  /**
   * Sanitiza tags (array de strings)
   */
  sanitizeTags(tags: string[] | null | undefined): string[] | null {
    if (!tags || !Array.isArray(tags)) return null;

    return tags
      .map((tag) => this.sanitizeText(tag, 50))
      .filter((tag): tag is string => tag !== null)
      .slice(0, 10); // Máximo 10 tags
  }
}

export const sanitizerService = new SanitizerService();
```

### 7.2 URL Validator

```typescript
// src/server/lib/validators.ts
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
  'rb.gy',
  'cutt.ly'
];

const BLOCKED_DOMAINS = [
  // Phishing conhecidos (exemplo)
  'evil-phishing.com'
];

export interface ValidationResult {
  valid: boolean;
  error?: string;
  warnings?: string[];
}

export async function validateUrl(url: string): Promise<ValidationResult> {
  const warnings: string[] = [];

  // 1. Formato básico
  try {
    new URL(url);
  } catch {
    return { valid: false, error: 'INVALID_FORMAT' };
  }

  const parsed = new URL(url);

  // 2. Protocolo permitido
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return { valid: false, error: 'INVALID_PROTOCOL' };
  }

  // 3. Tamanho máximo
  if (url.length > 2048) {
    return { valid: false, error: 'URL_TOO_LONG' };
  }

  // 4. Bloqueio de encurtadores
  const domain = parsed.hostname.toLowerCase();
  if (BLOCKED_SHORTENERS.some((s) => domain.includes(s))) {
    return { valid: false, error: 'SHORTENER_NOT_ALLOWED' };
  }

  // 5. Blacklist de domínios
  if (BLOCKED_DOMAINS.some((d) => domain.includes(d))) {
    return { valid: false, error: 'DOMAIN_BANNED' };
  }

  // 6. Warning para HTTP (não HTTPS)
  if (parsed.protocol === 'http:') {
    warnings.push('URL uses HTTP instead of HTTPS');
  }

  return { valid: true, warnings };
}
```

---

## 8. Anti-Abuse

```typescript
// src/server/middleware/anti-abuse.ts
import { redis } from '@/server/lib/redis';

const THRESHOLDS = {
  LOGIN_FAILURES: { count: 50, window: 300 }, // 50 falhas em 5min
  LINK_CREATION: { count: 100, window: 60 } // 100 links em 1min
};

export class AntiAbuseService {
  /**
   * Detecta anomalia de login
   */
  async checkLoginAnomaly(ip: string): Promise<boolean> {
    const key = `abuse:login:${ip}`;
    const count = await redis.incr(key);

    if (count === 1) {
      await redis.expire(key, THRESHOLDS.LOGIN_FAILURES.window);
    }

    if (count >= THRESHOLDS.LOGIN_FAILURES.count) {
      await this.blockIP(ip, 'login_abuse', 3600); // 1 hora
      return true;
    }

    return false;
  }

  /**
   * Bloqueia IP temporariamente
   */
  async blockIP(ip: string, reason: string, ttl: number): Promise<void> {
    const key = `blocked:${ip}`;
    await redis.set(key, reason, 'EX', ttl);
    console.warn(`[AntiAbuse] IP blocked: ${ip} - Reason: ${reason}`);
  }

  /**
   * Verifica se IP está bloqueado
   */
  async isBlocked(ip: string): Promise<boolean> {
    const blocked = await redis.get(`blocked:${ip}`);
    return blocked !== null;
  }
}

export const antiAbuseService = new AntiAbuseService();
```

---

## 9. Audit Logs

### 9.1 Schema

```typescript
// packages/data/src/schema/audit.ts
import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  jsonb
} from 'drizzle-orm/pg-core';

export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  actorId: uuid('actor_id').references(() => users.id),
  actorEmail: varchar('actor_email', { length: 255 }),
  action: varchar('action', { length: 50 }).notNull(),
  resourceType: varchar('resource_type', { length: 50 }).notNull(),
  resourceId: uuid('resource_id'),
  details: jsonb('details'),
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at').defaultNow().notNull()
});
```

### 9.2 Audit Service

```typescript
// src/server/services/audit.service.ts
import { db } from '@/db';
import { auditLogs } from '@/db/schema';

type AuditAction =
  | 'user.ban'
  | 'user.unban'
  | 'user.role_change'
  | 'link.ban'
  | 'link.unban'
  | 'link.delete'
  | 'settings.update';

interface AuditContext {
  actorId: string;
  actorEmail: string;
  ipAddress?: string;
  userAgent?: string;
}

export class AuditService {
  async log(
    action: AuditAction,
    resourceType: string,
    resourceId: string | null,
    details: Record<string, unknown>,
    context: AuditContext
  ): Promise<void> {
    await db.insert(auditLogs).values({
      actorId: context.actorId,
      actorEmail: context.actorEmail,
      action,
      resourceType,
      resourceId,
      details,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });
  }

  async getRecent(limit: number = 100) {
    return db.query.auditLogs.findMany({
      orderBy: (logs, { desc }) => [desc(logs.createdAt)],
      limit
    });
  }
}

export const auditService = new AuditService();
```

---

## 10. GDPR/LGPD Endpoints

### 10.1 Export de Dados

```typescript
// apps/api/src/server/modules/users/me.controller.ts
import { Elysia } from 'elysia';
import { authMiddleware } from '@/server/middleware/auth';
import { gdprService } from '@/server/services/gdpr.service';

export const exportRoute = new Elysia({ prefix: '/me' })
  .use(authMiddleware)
  .get('/export', async ({ user }) => {
    const data = await gdprService.exportUserData(user.id);

    return {
      success: true,
      data: {
        exportedAt: new Date().toISOString(),
        format: 'json',
        content: data
      }
    };
  });
```

### 10.2 Exclusão de Dados

```typescript
// apps/api/src/server/modules/users/me.controller.ts
import { Elysia } from 'elysia';
import { authMiddleware } from '@/server/middleware/auth';
import { gdprService } from '@/server/services/gdpr.service';

export const dataRoute = new Elysia({ prefix: '/me' })
  .use(authMiddleware)
  .delete('/data', async ({ user }) => {
    // Agenda exclusão (72h deadline)
    await gdprService.scheduleDataDeletion(user.id);

    return {
      success: true,
      data: {
        message: 'Data deletion scheduled',
        deadline: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString()
      }
    };
  });
```

### 10.3 GDPR Service

```typescript
// src/server/services/gdpr.service.ts
import { db } from '@/db';
import { users, links, analyticsEvents } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { deletionQueue } from '@/server/lib/queue';

export class GDPRService {
  async exportUserData(userId: string) {
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: {
        id: true,
        email: true,
        name: true,
        createdAt: true
      }
    });

    const userLinks = await db.query.links.findMany({
      where: eq(links.userId, userId),
      columns: {
        id: true,
        shortCode: true,
        originalUrl: true,
        clicksCount: true,
        createdAt: true
      }
    });

    return {
      user,
      links: userLinks,
      exportedAt: new Date().toISOString()
    };
  }

  async scheduleDataDeletion(userId: string): Promise<void> {
    await deletionQueue.add(
      'user-deletion',
      { userId },
      {
        delay: 72 * 60 * 60 * 1000, // 72 horas
        jobId: `deletion:${userId}`
      }
    );
  }

  async executeDataDeletion(userId: string): Promise<void> {
    // 1. Anonimiza analytics
    await db
      .update(analyticsEvents)
      .set({ visitorHash: 'deleted' })
      .where(
        eq(
          analyticsEvents.linkId,
          sql`ANY(
        SELECT id FROM links WHERE user_id = ${userId}
      )`
        )
      );

    // 2. Remove links
    await db.delete(links).where(eq(links.userId, userId));

    // 3. Remove usuário
    await db.delete(users).where(eq(users.id, userId));
  }
}

export const gdprService = new GDPRService();
```

---

## 11. Consent Banner

```typescript
// src/components/consent-banner.tsx
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';

interface ConsentPreferences {
  analytics: boolean;
  marketing: boolean;
  updatedAt: string;
}

export function ConsentBanner() {
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem('analytics_consent');
    if (consent === null) setShow(true);
  }, []);

  const saveConsent = async (accepted: boolean): Promise<void> => {
    setLoading(true);

    const preferences: ConsentPreferences = {
      analytics: accepted,
      marketing: false,
      updatedAt: new Date().toISOString()
    };

    // Salva no localStorage
    localStorage.setItem('analytics_consent', JSON.stringify(preferences));

    // Sincroniza com servidor para usuários autenticados
    try {
      const response = await fetch('/api/me/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(preferences)
      });

      if (!response.ok) {
        console.warn('Failed to sync consent to server');
      }
    } catch {
      // Ignora erro se offline
    }

    // Dispara evento para analytics
    if (accepted && typeof window.gtag !== 'undefined') {
      window.gtag('consent', 'update', {
        analytics_storage: 'granted'
      });
    }

    setLoading(false);
    setShow(false);
  };

  if (!show) return null;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 bg-background border-t p-4 z-50"
      role="dialog"
      aria-label="Cookie consent"
    >
      <div className="container mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          Usamos cookies para análise de tráfego e melhorar sua experiência.
          <a href="/privacy" className="underline ml-1 text-foreground">
            Política de Privacidade
          </a>
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => saveConsent(false)}
            disabled={loading}
          >
            Recusar
          </Button>
          <Button onClick={() => saveConsent(true)} disabled={loading}>
            Aceitar
          </Button>
        </div>
      </div>
    </div>
  );
}
```

### 11.1 Integração com Analytics

```typescript
// src/lib/analytics-client.ts
type ConsentStatus = 'granted' | 'denied' | 'unknown';

export function getAnalyticsConsent(): ConsentStatus {
  if (typeof window === 'undefined') return 'unknown';

  const stored = localStorage.getItem('analytics_consent');
  if (!stored) return 'unknown';

  try {
    const preferences = JSON.parse(stored);
    return preferences.analytics ? 'granted' : 'denied';
  } catch {
    return stored === 'true' ? 'granted' : 'denied';
  }
}

export function shouldTrack(): boolean {
  return getAnalyticsConsent() === 'granted';
}

// Hook para componentes React
export function useAnalyticsConsent() {
  const [consent, setConsent] = useState<ConsentStatus>('unknown');

  useEffect(() => {
    setConsent(getAnalyticsConsent());

    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'analytics_consent') {
        setConsent(getAnalyticsConsent());
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  return consent;
}
```

---

## 12. Testes de Segurança

### 12.1 Checklist de Penetration Testing

| Categoria         | Teste                    | Ferramenta          | Resultado Esperado                |
| ----------------- | ------------------------ | ------------------- | --------------------------------- |
| **Autenticação**  | Brute force password     | Hydra/Burp          | Bloqueado por rate limit          |
|                   | Session fixation         | Manual              | Session ID regenerado no login    |
|                   | JWT manipulation         | jwt.io/Burp         | Tokens rejeitados                 |
|                   | Password reset abuse     | Manual              | Token único, expira em 1h         |
| **Autorização**   | IDOR em links            | Burp                | 403 para links de outros usuários |
|                   | Privilege escalation     | Manual              | Admin requer 2FA                  |
|                   | API key scope bypass     | Postman             | Scopes respeitados                |
| **Injeção**       | SQL Injection            | sqlmap              | Sem resultados                    |
|                   | XSS Stored               | XSStrike            | Sanitizado por DOMPurify          |
|                   | XSS Reflected            | Burp                | CSP bloqueia inline scripts       |
|                   | Command Injection        | Manual              | N/A (não usa shell)               |
|                   | SSRF                     | Manual              | URLs internas bloqueadas          |
| **Rate Limiting** | Bypass via headers       | Burp                | X-Forwarded-For ignorado          |
|                   | Distributed attack       | k6                  | Limite por IP mantido             |
| **CORS**          | Cross-origin request     | Browser             | Apenas origins permitidas         |
|                   | Preflight bypass         | curl                | OPTIONS obrigatório               |
| **Headers**       | Missing security headers | securityheaders.com | A+ rating                         |
|                   | Clickjacking             | Manual              | X-Frame-Options: DENY             |
| **Crypto**        | TLS version              | testssl.sh          | TLS 1.3 only                      |
|                   | Weak ciphers             | testssl.sh          | Apenas ciphers fortes             |
|                   | Password hashing         | Code review         | Argon2id                          |

### 12.2 Testes Automatizados de Segurança

```typescript
// tests/security/injection.test.ts
import { describe, it, expect } from 'bun:test';
import { app } from '@/server/app';

describe('SQL Injection Tests', () => {
  const payloads = [
    "'; DROP TABLE links; --",
    '1 OR 1=1',
    "1'; SELECT * FROM users WHERE '1'='1",
    "admin'--",
    '1 UNION SELECT * FROM users',
    '${process.env.DATABASE_URL}',
    '{{7*7}}'
  ];

  it('should reject SQL injection in shortCode', async () => {
    for (const payload of payloads) {
      const res = await app.handle(
        new Request(`http://localhost/${encodeURIComponent(payload)}`)
      );

      // Deve retornar 404, não 500 ou erro de SQL
      expect(res.status).toBe(404);
    }
  });

  it('should reject SQL injection in search parameter', async () => {
    for (const payload of payloads) {
      const res = await app.handle(
        new Request(
          `http://localhost/api/links?search=${encodeURIComponent(payload)}`,
          {
            headers: { Authorization: 'Bearer valid-token' }
          }
        )
      );

      expect(res.status).toBeLessThan(500);
    }
  });
});

describe('XSS Tests', () => {
  const xssPayloads = [
    '<script>alert(1)</script>',
    '<img src=x onerror=alert(1)>',
    '"><script>alert(1)</script>',
    "javascript:alert('XSS')",
    '<svg onload=alert(1)>',
    '{{constructor.constructor("alert(1)")()}}'
  ];

  it('should sanitize XSS in meta tags', async () => {
    for (const payload of xssPayloads) {
      const res = await app.handle(
        new Request('http://localhost/api/links', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer valid-token'
          },
          body: JSON.stringify({
            url: 'https://example.com',
            metaTitle: payload,
            metaDescription: payload
          })
        })
      );

      if (res.ok) {
        const data = await res.json();
        expect(data.metaTitle).not.toContain('<script>');
        expect(data.metaTitle).not.toContain('onerror');
        expect(data.metaDescription).not.toContain('<script>');
      }
    }
  });
});

describe('SSRF Tests', () => {
  const ssrfPayloads = [
    'http://localhost:5432/pg',
    'http://127.0.0.1:6379/',
    'http://169.254.169.254/latest/meta-data/',
    'http://[::1]:8080/',
    'file:///etc/passwd',
    'gopher://localhost:6379/_INFO'
  ];

  it('should block internal URLs', async () => {
    for (const payload of ssrfPayloads) {
      const res = await app.handle(
        new Request('http://localhost/api/links', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer valid-token'
          },
          body: JSON.stringify({ url: payload })
        })
      );

      // Deve rejeitar
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toMatch(/URL|invalid|blocked/i);
    }
  });
});

describe('Rate Limiting Tests', () => {
  it('should enforce rate limits', async () => {
    const requests: Promise<Response>[] = [];

    // Dispara 150 requests (limite é 100/min)
    for (let i = 0; i < 150; i++) {
      requests.push(app.handle(new Request('http://localhost/test-rate')));
    }

    const responses = await Promise.all(requests);
    const blocked = responses.filter((r) => r.status === 429);

    expect(blocked.length).toBeGreaterThan(40);
  });

  it('should return proper rate limit headers', async () => {
    const res = await app.handle(new Request('http://localhost/api/links'));

    expect(res.headers.get('X-RateLimit-Limit')).toBeDefined();
    expect(res.headers.get('X-RateLimit-Remaining')).toBeDefined();
    expect(res.headers.get('X-RateLimit-Reset')).toBeDefined();
  });
});

describe('CORS Tests', () => {
  it('should block requests from non-allowed origins', async () => {
    const res = await app.handle(
      new Request('http://localhost/api/links', {
        headers: { Origin: 'https://evil-site.com' }
      })
    );

    expect(res.headers.get('Access-Control-Allow-Origin')).not.toBe(
      'https://evil-site.com'
    );
  });

  it('should allow requests from allowed origins', async () => {
    const res = await app.handle(
      new Request('http://localhost/api/links', {
        headers: { Origin: 'https://urlfy.cc' }
      })
    );

    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(
      'https://urlfy.cc'
    );
  });
});

describe('Security Headers Tests', () => {
  it('should include all security headers', async () => {
    const res = await app.handle(new Request('http://localhost/'));

    expect(res.headers.get('X-Frame-Options')).toBe('DENY');
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(res.headers.get('X-XSS-Protection')).toBe('1; mode=block');
    expect(res.headers.get('Strict-Transport-Security')).toContain('max-age=');
    expect(res.headers.get('Content-Security-Policy')).toBeDefined();
    expect(res.headers.get('Referrer-Policy')).toBe(
      'strict-origin-when-cross-origin'
    );
    expect(res.headers.get('Permissions-Policy')).toBeDefined();
  });
});
```

### 12.3 Scan de Vulnerabilidades CI/CD

```yaml
# .github/workflows/security-scan.yml
name: Security Scan

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 2 * * 1' # Segunda às 02:00

jobs:
  dependency-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Run npm audit
        run: bun audit --audit-level=high
        continue-on-error: true

      - name: Run Snyk
        uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
        with:
          args: --severity-threshold=high

  sast-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Run Semgrep
        uses: returntocorp/semgrep-action@v1
        with:
          config: >-
            p/typescript
            p/nextjs
            p/security-audit
            p/owasp-top-ten

  dast-scan:
    runs-on: ubuntu-latest
    needs: [dependency-scan, sast-scan]
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4

      - name: Build and start app
        run: |
          bun install
          bun run build
          bun run start &
          sleep 10

      - name: Run OWASP ZAP Baseline
        uses: zaproxy/action-baseline@v0.10.0
        with:
          target: 'http://localhost:3000'
          rules_file_name: '.zap-rules.tsv'
          allow_issue_writing: false

  container-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Build Docker image
        run: docker build -t urlfy:test .

      - name: Run Trivy
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: 'urlfy:test'
          format: 'sarif'
          output: 'trivy-results.sarif'
          severity: 'CRITICAL,HIGH'

      - name: Upload to Security tab
        uses: github/codeql-action/upload-sarif@v2
        with:
          sarif_file: 'trivy-results.sarif'
```

### 12.4 Relatório de Conformidade

```typescript
// scripts/security-report.ts
import { writeFileSync } from 'fs';

interface SecurityCheck {
  category: string;
  check: string;
  status: 'pass' | 'fail' | 'warning';
  details: string;
}

async function generateSecurityReport(): Promise<void> {
  const checks: SecurityCheck[] = [];

  // 1. Verifica headers de segurança
  const headersRes = await fetch('http://localhost:3000');
  const headers = headersRes.headers;

  checks.push({
    category: 'Headers',
    check: 'Content-Security-Policy',
    status: headers.has('Content-Security-Policy') ? 'pass' : 'fail',
    details: headers.get('Content-Security-Policy') || 'Missing'
  });

  checks.push({
    category: 'Headers',
    check: 'Strict-Transport-Security',
    status: headers.has('Strict-Transport-Security') ? 'pass' : 'fail',
    details: headers.get('Strict-Transport-Security') || 'Missing'
  });

  // 2. Verifica rate limiting
  const rateLimitRes = await fetch('http://localhost:3000/api/links');
  checks.push({
    category: 'Rate Limiting',
    check: 'Rate limit headers present',
    status: rateLimitRes.headers.has('X-RateLimit-Limit') ? 'pass' : 'fail',
    details: `Limit: ${rateLimitRes.headers.get('X-RateLimit-Limit') || 'N/A'}`
  });

  // 3. Verifica TLS
  // (requer deploy para verificar)

  // Gera relatório
  const report = {
    generatedAt: new Date().toISOString(),
    checks,
    summary: {
      total: checks.length,
      passed: checks.filter((c) => c.status === 'pass').length,
      failed: checks.filter((c) => c.status === 'fail').length,
      warnings: checks.filter((c) => c.status === 'warning').length
    }
  };

  writeFileSync('security-report.json', JSON.stringify(report, null, 2));
  console.log('Security report generated: security-report.json');
}

generateSecurityReport();
```

---

## 13. Checklist de Implementação

- [x] Rate limiting por IP, token e link
- [x] Security headers em next.config.ts
- [x] CORS configurado para produção
- [x] Sanitização de meta tags (DOMPurify)
- [x] Validação de URLs com blacklist
- [x] Anti-abuse com detecção de anomalias
- [x] Audit logs para ações admin
- [x] GET /me/export (GDPR export)
- [x] DELETE /me/data (GDPR deletion)
- [x] Worker de exclusão (72h delay)
- [x] Consent banner com integração analytics
- [x] Hook useAnalyticsConsent
- [x] Testes automatizados de SQL injection
- [x] Testes automatizados de XSS
- [x] Testes automatizados de SSRF
- [x] Testes de rate limiting
- [x] Testes de CORS
- [x] Testes de security headers
- [x] Pipeline CI/CD com Snyk, Semgrep, ZAP
- [x] Container scanning com Trivy
- [x] Script de relatório de conformidade
- [ ] Validação em securityheaders.com (A+) - Requer deploy em produção
