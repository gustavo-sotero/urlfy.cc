# Módulo 3: Gestão de Links (Core Domain)

> 📖 [← Módulo 2: Autenticação](./module-02-authentication.md) | [Módulo 4: Redirect Engine →](./module-04-redirect.md)

**Requisitos Cobertos:** RF-01 a RF-11, RF-22 a RF-26, DB Schema (links, reserved_slugs)

---

## 1. Visão Geral

Este módulo implementa a **lógica de negócio principal** do urlfy.cc: criação, validação, gerenciamento e organização de URLs encurtadas.

### Funcionalidades

- CRUD completo de links (criar, listar, editar, deletar, duplicar)
- Geração de short codes únicos (NanoID)
- Validação de URLs (formato, protocolo, blacklist)
- Features premium (alias, expiração, senha, meta tags)
- QR Code generation
- UTM tracking
- Idempotency keys

---

## 2. Tipos TypeScript

```typescript
// src/types/links.types.ts
import type { links } from '@/db/schema';

// ═══════════════════════════════════════════════════════════════════
// INPUT TYPES
// ═══════════════════════════════════════════════════════════════════
export interface CreateLinkInput {
  url: string;
  customAlias?: string;
  expiresAt?: Date | string;
  maxClicks?: number;
  password?: string;
  redirectType?: 301 | 302;
  metaTitle?: string;
  metaDescription?: string;
  metaImage?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  tags?: string[];
  notes?: string;
}

export interface UpdateLinkInput {
  isActive?: boolean;
  expiresAt?: Date | string | null;
  maxClicks?: number | null;
  password?: string | null; // null = remove password
  redirectType?: 301 | 302;
  metaTitle?: string | null;
  metaDescription?: string | null;
  metaImage?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  tags?: string[] | null;
  notes?: string | null;
}

export interface ListLinksQuery {
  page?: number;
  perPage?: number;
  search?: string;
  tags?: string[];
  isActive?: boolean;
  sortBy?: 'createdAt' | 'clicksCount' | 'lastClickedAt';
  sortOrder?: 'asc' | 'desc';
}

// ═══════════════════════════════════════════════════════════════════
// RESPONSE TYPES
// ═══════════════════════════════════════════════════════════════════
export interface LinkResponse {
  id: string;
  shortCode: string;
  shortUrl: string;
  originalUrl: string;
  redirectType: 301 | 302;
  clicksCount: number;
  maxClicks: number | null;
  isActive: boolean;
  isProtected: boolean; // true se tem senha
  expiresAt: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  metaImage: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  tags: string[] | null;
  notes: string | null;
  lastClickedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    perPage: number;
    lastPage: number;
    hasMore: boolean;
  };
}

// ═══════════════════════════════════════════════════════════════════
// DB TYPES (inferidos do Drizzle)
// ═══════════════════════════════════════════════════════════════════
export type Link = typeof links.$inferSelect;
export type NewLink = typeof links.$inferInsert;
```

---

## 3. Estrutura de Diretórios

```
src/
├── server/
│   ├── api/
│   │   └── links/
│   │       ├── index.ts          # Router principal
│   │       ├── create.ts         # POST /links
│   │       ├── list.ts           # GET /links
│   │       ├── get.ts            # GET /links/:id
│   │       ├── update.ts         # PATCH /links/:id
│   │       ├── delete.ts         # DELETE /links/:id
│   │       ├── duplicate.ts      # POST /links/:id/duplicate
│   │       ├── qr.ts             # GET /links/:code/qr
│   │       └── validate.ts       # POST /links/validate
│   ├── services/
│   │   ├── link.service.ts       # Lógica de negócio
│   │   ├── shortcode.service.ts  # Geração de códigos
│   │   ├── url-validator.ts      # Validação de URLs
│   │   └── qr.service.ts         # Geração de QR codes
│   └── lib/
│       ├── nanoid.ts             # Config NanoID
│       └── sanitize.ts           # DOMPurify wrapper
├── db/schema/
│   ├── links.ts                  # Schema de links
│   └── reserved-slugs.ts         # Slugs reservados
└── types/
    └── links.types.ts            # Tipos TypeScript
```

---

## 4. Schema do Banco de Dados

### 4.1 Tabela `links`

```typescript
// packages/data/src/schema/links.ts
import {
  pgTable,
  uuid,
  text,
  varchar,
  boolean,
  integer,
  smallint,
  timestamp,
  index,
  uniqueIndex
} from 'drizzle-orm/pg-core';
import { users } from './auth';

export const redirectTypeEnum = {
  PERMANENT: 301,
  TEMPORARY: 302
} as const;

export const links = pgTable(
  'links',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').references(() => users.id, {
      onDelete: 'set null'
    }),

    // Core
    originalUrl: text('original_url').notNull(),
    shortCode: varchar('short_code', { length: 20 }).notNull().unique(),
    redirectType: smallint('redirect_type').default(302).notNull(),

    // Contadores
    clicksCount: integer('clicks_count').default(0).notNull(),
    maxClicks: integer('max_clicks'),

    // Proteção
    passwordHash: varchar('password_hash', { length: 255 }),

    // Status
    isActive: boolean('is_active').default(true).notNull(),
    isBanned: boolean('is_banned').default(false).notNull(),
    bannedAt: timestamp('banned_at', { withTimezone: true }),
    bannedReason: varchar('banned_reason', { length: 255 }),
    expiresAt: timestamp('expires_at', { withTimezone: true }),

    // Meta Tags (OG)
    metaTitle: varchar('meta_title', { length: 255 }),
    metaDescription: text('meta_description'),
    metaImage: varchar('meta_image', { length: 500 }),

    // UTM
    utmSource: varchar('utm_source', { length: 100 }),
    utmMedium: varchar('utm_medium', { length: 100 }),
    utmCampaign: varchar('utm_campaign', { length: 100 }),

    // Organização
    tags: varchar('tags', { length: 50 }).array(),
    notes: text('notes'),

    // Timestamps
    lastClickedAt: timestamp('last_clicked_at', { withTimezone: true }),
    qrGeneratedAt: timestamp('qr_generated_at', { withTimezone: true }),
    createdByIpHash: varchar('created_by_ip_hash', { length: 64 }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true })
  },
  (table) => [
    uniqueIndex('idx_links_short_code').on(table.shortCode),
    index('idx_links_user_active')
      .on(table.userId, table.deletedAt)
      .where(sql`${table.deletedAt} IS NULL`),
    index('idx_links_created_at').on(table.createdAt),
    index('idx_links_expires')
      .on(table.expiresAt)
      .where(sql`${table.expiresAt} IS NOT NULL AND ${table.deletedAt} IS NULL`)
  ]
);
```

### 4.2 Tabela `reserved_slugs`

```typescript
// packages/data/src/schema/reserved-slugs.ts
export const reservedSlugs = pgTable('reserved_slugs', {
  slug: varchar('slug', { length: 50 }).primaryKey(),
  reason: varchar('reason', { length: 255 }).notNull()
});

// Seed inicial
export const RESERVED_SLUGS = [
  // Sistema
  'api',
  'auth',
  'dashboard',
  'admin',
  'login',
  'signup',
  'logout',
  'settings',
  'health',
  'metrics',
  'docs',
  'help',
  'support',
  // SEO/Browser
  'favicon.ico',
  'robots.txt',
  'sitemap.xml',
  '.well-known',
  // Legal
  'privacy',
  'terms',
  'tos',
  'legal',
  'dmca',
  'abuse'
] as const;
```

---

## 5. Geração de Short Codes

### 5.1 Configuração NanoID

```typescript
// src/server/lib/nanoid.ts
import { customAlphabet } from 'nanoid';

// Charset: 0-9, a-z, A-Z (62 caracteres)
const ALPHABET =
  '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
const CODE_LENGTH = 7;

// 62^7 = ~3.5 trilhões de combinações
export const generateShortCode = customAlphabet(ALPHABET, CODE_LENGTH);
```

### 5.2 Serviço de Short Codes

```typescript
// apps/api/src/server/modules/links/services/shortcode.service.ts
import { db } from '@/db';
import { links, reservedSlugs } from '@/db/schema';
import { eq, or } from 'drizzle-orm';
import { generateShortCode } from '../lib/nanoid';

const MAX_RETRIES = 5;

export async function generateUniqueCode(): Promise<string> {
  for (let i = 0; i < MAX_RETRIES; i++) {
    const code = generateShortCode();

    // Verifica colisão em uma única query
    const exists = await db
      .select({ code: links.shortCode })
      .from(links)
      .where(eq(links.shortCode, code))
      .union(
        db
          .select({ code: reservedSlugs.slug })
          .from(reservedSlugs)
          .where(eq(reservedSlugs.slug, code))
      )
      .limit(1);

    if (exists.length === 0) return code;
  }

  throw new Error('SHORTCODE_GENERATION_FAILED');
}

export async function validateCustomAlias(alias: string): Promise<boolean> {
  // Regex: 3-20 chars, alphanumeric + hyphens
  const ALIAS_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9-]{1,18}[a-zA-Z0-9]$/;

  if (!ALIAS_REGEX.test(alias)) return false;

  // Verifica se é reservado ou já existe
  const exists = await db
    .select({ code: links.shortCode })
    .from(links)
    .where(eq(links.shortCode, alias))
    .union(
      db
        .select({ code: reservedSlugs.slug })
        .from(reservedSlugs)
        .where(eq(reservedSlugs.slug, alias))
    )
    .limit(1);

  return exists.length === 0;
}
```

---

## 6. Validação de URLs

```typescript
// apps/api/src/server/modules/links/services/url-validator.ts
const BLOCKED_SHORTENERS = new Set([
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
]);

const BLOCKED_DOMAINS = new Set([
  // Malicious/Phishing (carregado de tabela ou config)
]);

export type ValidationResult =
  | { valid: true }
  | { valid: false; error: ValidationError };

export type ValidationError =
  | 'INVALID_FORMAT'
  | 'INVALID_PROTOCOL'
  | 'SHORTENER_BLOCKED'
  | 'DOMAIN_BANNED'
  | 'URL_TOO_LONG';

export function validateUrl(url: string): ValidationResult {
  // 1. Tamanho máximo
  if (url.length > 2048) {
    return { valid: false, error: 'URL_TOO_LONG' };
  }

  // 2. Formato válido
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { valid: false, error: 'INVALID_FORMAT' };
  }

  // 3. Protocolo permitido
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return { valid: false, error: 'INVALID_PROTOCOL' };
  }

  // 4. Bloqueio de encurtadores
  const domain = parsed.hostname.replace(/^www\./, '');
  if (BLOCKED_SHORTENERS.has(domain)) {
    return { valid: false, error: 'SHORTENER_BLOCKED' };
  }

  // 5. Blacklist manual
  if (BLOCKED_DOMAINS.has(domain)) {
    return { valid: false, error: 'DOMAIN_BANNED' };
  }

  return { valid: true };
}
```

---

## 7. Sanitização de Meta Tags

```typescript
// src/server/lib/sanitize.ts
import DOMPurify from 'isomorphic-dompurify';

const TITLE_MAX = 60;
const DESC_MAX = 160;
const IMAGE_URL_MAX = 500;

// CDNs permitidos para imagens
const ALLOWED_IMAGE_HOSTS = new Set([
  'imgur.com',
  'i.imgur.com',
  'cloudinary.com',
  'res.cloudinary.com',
  'images.unsplash.com'
]);

export function sanitizeMetaTags(input: {
  title?: string;
  description?: string;
  image?: string;
}) {
  return {
    metaTitle: input.title
      ? DOMPurify.sanitize(input.title).slice(0, TITLE_MAX)
      : null,
    metaDescription: input.description
      ? DOMPurify.sanitize(input.description).slice(0, DESC_MAX)
      : null,
    metaImage: input.image ? validateImageUrl(input.image) : null
  };
}

function validateImageUrl(url: string): string | null {
  if (url.length > IMAGE_URL_MAX) return null;

  try {
    const { hostname, protocol } = new URL(url);
    if (protocol !== 'https:') return null;

    const domain = hostname.replace(/^www\./, '');
    if (!ALLOWED_IMAGE_HOSTS.has(domain)) return null;

    return url;
  } catch {
    return null;
  }
}
```

---

## 8. QR Code Service

```typescript
// apps/api/src/server/modules/links/services/qr.service.ts
import QRCode from 'qrcode';
import { redis } from '../lib/redis';

type QRFormat = 'png' | 'svg';
type QRSize = 100 | 200 | 300 | 500 | 1000;

const CACHE_TTL = 86400; // 24h

export async function generateQRCode(
  shortUrl: string,
  code: string,
  size: QRSize = 200,
  format: QRFormat = 'png'
): Promise<Buffer | string> {
  const cacheKey = `qr:${code}:${size}:${format}`;

  // Check cache
  const cached = await redis.get(cacheKey);
  if (cached) return format === 'svg' ? cached : Buffer.from(cached, 'base64');

  // Generate
  const options = {
    width: size,
    margin: 2,
    color: { dark: '#000000', light: '#ffffff' }
  };

  let result: Buffer | string;

  if (format === 'svg') {
    result = await QRCode.toString(shortUrl, { ...options, type: 'svg' });
    await redis.set(cacheKey, result, 'EX', CACHE_TTL);
  } else {
    result = await QRCode.toBuffer(shortUrl, { ...options, type: 'png' });
    await redis.set(cacheKey, result.toString('base64'), 'EX', CACHE_TTL);
  }

  return result;
}
```

---

## 9. Link Service (CRUD)

```typescript
// apps/api/src/server/modules/links/links.service.ts
import { db } from '@/db';
import { links } from '@/db/schema';
import { eq, and, isNull, desc, sql } from 'drizzle-orm';
import { generateUniqueCode, validateCustomAlias } from './shortcode.service';
import { validateUrl } from './url-validator';
import { sanitizeMetaTags } from '../lib/sanitize';
import { redis } from '../lib/redis';

// ═══════════════════════════════════════════════════════════════════
// CREATE
// ═══════════════════════════════════════════════════════════════════
export async function createLink(input: CreateLinkInput, userId?: string) {
  // 1. Validar URL
  const validation = validateUrl(input.url);
  if (!validation.valid) throw new Error(validation.error);

  // 2. Gerar ou validar código
  let shortCode: string;
  if (input.customAlias) {
    if (!userId) throw new Error('AUTH_REQUIRED');
    const valid = await validateCustomAlias(input.customAlias);
    if (!valid) throw new Error('ALIAS_UNAVAILABLE');
    shortCode = input.customAlias;
  } else {
    shortCode = await generateUniqueCode();
  }

  // 3. Hash senha se fornecida
  const passwordHash = input.password
    ? await Bun.password.hash(input.password, 'argon2id')
    : null;

  // 4. Sanitizar meta tags
  const meta = sanitizeMetaTags({
    title: input.metaTitle,
    description: input.metaDescription,
    image: input.metaImage
  });

  // 5. Criar link
  const [link] = await db
    .insert(links)
    .values({
      userId,
      originalUrl: input.url,
      shortCode,
      redirectType: input.redirectType ?? 302,
      expiresAt: input.expiresAt,
      maxClicks: input.maxClicks,
      passwordHash,
      ...meta,
      utmSource: input.utmSource,
      utmMedium: input.utmMedium,
      utmCampaign: input.utmCampaign
    })
    .returning();

  return link;
}

// ═══════════════════════════════════════════════════════════════════
// LIST (Paginated)
// ═══════════════════════════════════════════════════════════════════
export async function listUserLinks(userId: string, page = 1, perPage = 20) {
  const offset = (page - 1) * perPage;

  const [items, countResult] = await Promise.all([
    db
      .select()
      .from(links)
      .where(and(eq(links.userId, userId), isNull(links.deletedAt)))
      .orderBy(desc(links.createdAt))
      .limit(perPage)
      .offset(offset),

    db
      .select({ count: sql<number>`count(*)` })
      .from(links)
      .where(and(eq(links.userId, userId), isNull(links.deletedAt)))
  ]);

  const total = countResult[0]?.count ?? 0;

  return {
    data: items,
    meta: {
      total,
      page,
      perPage,
      lastPage: Math.ceil(total / perPage),
      hasMore: offset + items.length < total
    }
  };
}

// ═══════════════════════════════════════════════════════════════════
// UPDATE
// ═══════════════════════════════════════════════════════════════════
export async function updateLink(
  id: string,
  userId: string,
  input: UpdateLinkInput
) {
  const link = await db.query.links.findFirst({
    where: and(
      eq(links.id, id),
      eq(links.userId, userId),
      isNull(links.deletedAt)
    )
  });

  if (!link) throw new Error('LINK_NOT_FOUND');

  // Atualiza campos permitidos
  const [updated] = await db
    .update(links)
    .set({
      ...input,
      ...sanitizeMetaTags({
        title: input.metaTitle,
        description: input.metaDescription,
        image: input.metaImage
      }),
      updatedAt: new Date()
    })
    .where(eq(links.id, id))
    .returning();

  // Invalida cache
  await invalidateLinkCache(link.shortCode, 'update');

  return updated;
}

// ═══════════════════════════════════════════════════════════════════
// SOFT DELETE
// ═══════════════════════════════════════════════════════════════════
export async function softDeleteLink(id: string, userId: string) {
  const link = await db.query.links.findFirst({
    where: and(
      eq(links.id, id),
      eq(links.userId, userId),
      isNull(links.deletedAt)
    )
  });

  if (!link) throw new Error('LINK_NOT_FOUND');

  await db
    .update(links)
    .set({ deletedAt: new Date(), isActive: false })
    .where(eq(links.id, id));

  await invalidateLinkCache(link.shortCode, 'delete');
}

// ═══════════════════════════════════════════════════════════════════
// DUPLICATE
// ═══════════════════════════════════════════════════════════════════
export async function duplicateLink(id: string, userId: string) {
  const original = await db.query.links.findFirst({
    where: and(
      eq(links.id, id),
      eq(links.userId, userId),
      isNull(links.deletedAt)
    )
  });

  if (!original) throw new Error('LINK_NOT_FOUND');

  const newCode = await generateUniqueCode();

  const [duplicate] = await db
    .insert(links)
    .values({
      userId,
      originalUrl: original.originalUrl,
      shortCode: newCode,
      redirectType: original.redirectType,
      metaTitle: original.metaTitle,
      metaDescription: original.metaDescription,
      metaImage: original.metaImage,
      utmSource: original.utmSource,
      utmMedium: original.utmMedium,
      utmCampaign: original.utmCampaign,
      tags: original.tags,
      notes: original.notes
      // Reset: não copia senha, expiração, clicks
    })
    .returning();

  return duplicate;
}

// ═══════════════════════════════════════════════════════════════════
// CACHE INVALIDATION
// ═══════════════════════════════════════════════════════════════════
async function invalidateLinkCache(
  code: string,
  reason: 'update' | 'ban' | 'delete'
) {
  const pipeline = redis.pipeline();

  pipeline.del(`link:${code}`);
  pipeline.del(`link:meta:${code}`);

  if (reason === 'delete') {
    pipeline.set(`link:404:${code}`, '1', 'EX', 300);
  }

  // Invalida QR codes
  const qrKeys = await redis.keys(`qr:${code}:*`);
  if (qrKeys.length > 0) pipeline.del(...qrKeys);

  await pipeline.exec();
}
```

---

## 10. Idempotency Keys

```typescript
// src/server/lib/idempotency.ts
import { redis } from './redis';

const TTL = 86400; // 24h

export async function checkIdempotency(key: string): Promise<string | null> {
  return redis.get(`idempotency:${key}`);
}

export async function setIdempotency(
  key: string,
  responseId: string
): Promise<void> {
  await redis.set(`idempotency:${key}`, responseId, 'EX', TTL);
}
```

---

## 11. Padrões Elysia para Links (MVC)

> 📖 **Referência:** [elysiajs.com/essential/best-practice](https://elysiajs.com/essential/best-practice)

Este módulo exemplifica a aplicação completa dos padrões recomendados do Elysia no contexto de gestão de links.

### 11.1 Estrutura Feature-Based

```
src/server/
├── api/links/
│   └── index.ts          # Controller (Elysia instance)
├── api/models/
│   └── links.models.ts   # Models (TypeBox schemas)
└── services/
    └── link.service.ts   # Service (abstract class + static)
```

### 11.2 Controller Pattern (1 Elysia = 1 Controller)

```typescript
// ✅ Correto: Instância Elysia como controller
import { Elysia } from 'elysia';
import { LinkModel } from './links.schema';
import { LinkService } from './links.service';

export const linksController = new Elysia({ prefix: '/links' })
  // Injeta models para cache de tipos e OpenAPI
  .model(LinkModel)
  // Handlers delegam para services
  .post(
    '/',
    async ({ body, user }) => {
      const link = await LinkService.createLink(body, user?.id);
      return { success: true, data: link };
    },
    { body: 'link.create' }
  );

// ❌ Incorreto: Classe controller tradicional
class LinksController {
  static create(context: Context) {
    /* NÃO FAZER */
  }
}
```

### 11.3 Service Pattern (Non-Request Dependent)

```typescript
// apps/api/src/server/modules/links/links.service.ts
// ✅ Correto: abstract class + static methods
abstract class LinkService {
  static async create(input: CreateLinkInput, userId?: string): Promise<Link> {
    // Lógica de negócio pura, sem dependência de HTTP
    const validation = validateUrl(input.url);
    if (!validation.valid) throw new Error(validation.error);

    const shortCode = input.customAlias || await generateUniqueCode();
    return db.insert(links).values({ ... }).returning();
  }

  static async getByCode(code: string): Promise<Link | null> {
    return db.query.links.findFirst({ where: eq(links.shortCode, code) });
  }
}
```

### 11.4 Model Pattern (Single Source of Truth)

```typescript
// apps/api/src/server/modules/links/links.schema.ts
import { Elysia, t } from 'elysia';

// ✅ TypeBox para validação + inferência de tipos
export const LinkCreateBody = t.Object({
  url: t.String({ maxLength: 2048 }),
  customAlias: t.Optional(t.String({ minLength: 3, maxLength: 20 }))
  // ... outros campos
});
type LinkCreateBodyType = typeof LinkCreateBody.static;

// ✅ Model injection para OpenAPI e type cache
export const linksModels = new Elysia().model({
  'links.create': LinkCreateBody,
  'links.update': LinkUpdateBody,
  'links.response': LinkResponse
});

// ❌ Incorreto: Interface separada
interface LinkInput {
  url: string;
} // NÃO FAZER
```

### 11.5 Testes com handle()

```typescript
import { describe, it, expect } from 'bun:test';
import { linksRouter } from './index';

describe('Links Controller', () => {
  it('should create link', async () => {
    const response = await linksRouter
      .handle(
        new Request('http://localhost/links', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: 'https://example.com' })
        })
      )
      .then((r) => r.json());

    expect(response.success).toBe(true);
    expect(response.data.shortCode).toBeDefined();
  });
});
```

---

## 12. API Routes (ElysiaJS)

```typescript
// src/server/modules/links/links.controller.ts
import { Elysia, t } from 'elysia';
import { authMiddleware, optionalAuth } from '../../middleware/auth';
import { LinkService } from './links.service';

export const linksController = new Elysia({ prefix: '/links' })
  // ═══════════════════════════════════════════════════════════════
  // POST /links - Criar link
  // ═══════════════════════════════════════════════════════════════
  .post(
    '/',
    async ({ body, user, headers, set }) => {
      const idempotencyKey = headers['idempotency-key'];

      if (idempotencyKey) {
        const cached = await checkIdempotency(idempotencyKey);
        if (cached) return { success: true, data: JSON.parse(cached) };
      }

      const link = await LinkService.createLink(body, user?.id);

      if (idempotencyKey) {
        await setIdempotency(idempotencyKey, JSON.stringify(link));
      }

      set.status = 201;
      return { success: true, data: LinkService.formatLinkResponse(link) };
    },
    {
      beforeHandle: [optionalAuth],
      body: t.Object({
        url: t.String({ maxLength: 2048 }),
        customAlias: t.Optional(t.String({ minLength: 3, maxLength: 20 })),
        expiresAt: t.Optional(t.String({ format: 'date-time' })),
        maxClicks: t.Optional(t.Integer({ minimum: 1 })),
        password: t.Optional(t.String({ minLength: 4, maxLength: 64 })),
        redirectType: t.Optional(t.Union([t.Literal(301), t.Literal(302)])),
        metaTitle: t.Optional(t.String({ maxLength: 60 })),
        metaDescription: t.Optional(t.String({ maxLength: 160 })),
        metaImage: t.Optional(t.String({ maxLength: 500 })),
        utmSource: t.Optional(t.String({ maxLength: 100 })),
        utmMedium: t.Optional(t.String({ maxLength: 100 })),
        utmCampaign: t.Optional(t.String({ maxLength: 100 }))
      })
    }
  )

  // ═══════════════════════════════════════════════════════════════
  // GET /links - Listar links do usuário
  // ═══════════════════════════════════════════════════════════════
  .get(
    '/',
    async ({ user, query }) => {
      const result = await linkService.listUserLinks(
        user.id,
        query.page ?? 1,
        query.perPage ?? 20
      );
      return { success: true, ...result };
    },
    {
      beforeHandle: [authMiddleware],
      query: t.Object({
        page: t.Optional(t.Integer({ minimum: 1 })),
        perPage: t.Optional(t.Integer({ minimum: 1, maximum: 100 }))
      })
    }
  )

  // ═══════════════════════════════════════════════════════════════
  // DELETE /links/:id
  // ═══════════════════════════════════════════════════════════════
  .delete(
    '/:id',
    async ({ params, user }) => {
      await linkService.softDeleteLink(params.id, user.id);
      return { success: true };
    },
    { beforeHandle: [authMiddleware] }
  )

  // ═══════════════════════════════════════════════════════════════
  // POST /links/:id/duplicate
  // ═══════════════════════════════════════════════════════════════
  .post(
    '/:id/duplicate',
    async ({ params, user, set }) => {
      const link = await linkService.duplicateLink(params.id, user.id);
      set.status = 201;
      return { success: true, data: formatLinkResponse(link) };
    },
    { beforeHandle: [authMiddleware] }
  );
```

---

## 13. Checklist de Implementação

| Item | Descrição                                  | Status |
| ---- | ------------------------------------------ | ------ |
| 3.1  | Schema de links com Drizzle                | ✅     |
| 3.2  | Short code generator (NanoID)              | ✅     |
| 3.3  | Slugs reservados (seed + validação)        | ✅     |
| 3.4  | URL validator (protocolo, blacklist)       | ✅     |
| 3.5  | Features premium (alias, senha, expiração) | ✅     |
| 3.6  | Meta tags sanitization (DOMPurify)         | ✅     |
| 3.7  | QR Code service                            | ✅     |
| 3.8  | UTM tracking                               | ✅     |
| 3.9  | Idempotency keys                           | ✅     |
| 3.10 | Tags & Notes                               | ✅     |
| 3.11 | API routes (CRUD + duplicate)              | ✅     |
| 3.12 | Testes unitários                           | ✅     |

---

## 14. Funções Auxiliares

### 14.1 Formatador de Resposta

```typescript
// apps/api/src/server/modules/links/links.service.ts

const BASE_URL = process.env.PUBLIC_APP_URL || 'https://urlfy.cc';

export function formatLinkResponse(link: Link): LinkResponse {
  return {
    id: link.id,
    shortCode: link.shortCode,
    shortUrl: `${BASE_URL}/${link.shortCode}`,
    originalUrl: link.originalUrl,
    redirectType: link.redirectType as 301 | 302,
    clicksCount: link.clicksCount,
    maxClicks: link.maxClicks,
    isActive: link.isActive,
    isProtected: !!link.passwordHash,
    expiresAt: link.expiresAt?.toISOString() ?? null,
    metaTitle: link.metaTitle,
    metaDescription: link.metaDescription,
    metaImage: link.metaImage,
    utmSource: link.utmSource,
    utmMedium: link.utmMedium,
    utmCampaign: link.utmCampaign,
    tags: link.tags,
    notes: link.notes,
    lastClickedAt: link.lastClickedAt?.toISOString() ?? null,
    createdAt: link.createdAt.toISOString(),
    updatedAt: link.updatedAt.toISOString()
  };
}
```

### 14.2 Toggle Active Status

```typescript
// apps/api/src/server/modules/links/links.service.ts

export async function toggleLinkActive(id: string, userId: string) {
  const link = await db.query.links.findFirst({
    where: and(
      eq(links.id, id),
      eq(links.userId, userId),
      isNull(links.deletedAt)
    )
  });

  if (!link) throw new Error('LINK_NOT_FOUND');

  const [updated] = await db
    .update(links)
    .set({
      isActive: !link.isActive,
      updatedAt: new Date()
    })
    .where(eq(links.id, id))
    .returning();

  await invalidateLinkCache(link.shortCode, 'update');

  return updated;
}
```

### 14.3 Get Single Link

```typescript
// apps/api/src/server/modules/links/links.service.ts

export async function getLinkById(id: string, userId: string) {
  const link = await db.query.links.findFirst({
    where: and(
      eq(links.id, id),
      eq(links.userId, userId),
      isNull(links.deletedAt)
    )
  });

  if (!link) throw new Error('LINK_NOT_FOUND');

  return link;
}

export async function getLinkByCode(code: string) {
  const link = await db.query.links.findFirst({
    where: and(eq(links.shortCode, code), isNull(links.deletedAt))
  });

  return link;
}
```

---

## 15. Error Handling

```typescript
// src/server/lib/errors.ts

export class LinkError extends Error {
  constructor(
    public code: LinkErrorCode,
    public httpStatus: number = 400
  ) {
    super(code);
    this.name = 'LinkError';
  }
}

export type LinkErrorCode =
  | 'LINK_NOT_FOUND'
  | 'ALIAS_UNAVAILABLE'
  | 'AUTH_REQUIRED'
  | 'INVALID_FORMAT'
  | 'INVALID_PROTOCOL'
  | 'SHORTENER_BLOCKED'
  | 'DOMAIN_BANNED'
  | 'URL_TOO_LONG'
  | 'QUOTA_EXCEEDED'
  | 'SHORTCODE_GENERATION_FAILED';

export const ERROR_HTTP_MAP: Record<LinkErrorCode, number> = {
  LINK_NOT_FOUND: 404,
  ALIAS_UNAVAILABLE: 409,
  AUTH_REQUIRED: 401,
  INVALID_FORMAT: 400,
  INVALID_PROTOCOL: 400,
  SHORTENER_BLOCKED: 422,
  DOMAIN_BANNED: 422,
  URL_TOO_LONG: 400,
  QUOTA_EXCEEDED: 402,
  SHORTCODE_GENERATION_FAILED: 500
};

// Middleware de erro para Elysia
export function handleLinkError(error: unknown) {
  if (error instanceof LinkError) {
    return {
      success: false,
      error: {
        code: error.code,
        message: getErrorMessage(error.code)
      }
    };
  }
  throw error;
}

function getErrorMessage(code: LinkErrorCode): string {
  const messages: Record<LinkErrorCode, string> = {
    LINK_NOT_FOUND: 'Link não encontrado',
    ALIAS_UNAVAILABLE: 'Este alias já está em uso',
    AUTH_REQUIRED: 'Autenticação necessária para esta ação',
    INVALID_FORMAT: 'URL com formato inválido',
    INVALID_PROTOCOL: 'Apenas URLs http/https são permitidas',
    SHORTENER_BLOCKED: 'URLs de outros encurtadores não são permitidas',
    DOMAIN_BANNED: 'Este domínio está bloqueado',
    URL_TOO_LONG: 'URL excede o limite de 2048 caracteres',
    QUOTA_EXCEEDED: 'Limite de links do plano atingido',
    SHORTCODE_GENERATION_FAILED: 'Erro ao gerar código curto'
  };
  return messages[code];
}
```

---

## 16. Drizzle Relations

```typescript
// packages/data/src/schema/links.ts (adicionar ao final)

import { relations } from 'drizzle-orm';
import { users } from './auth';

export const linksRelations = relations(links, ({ one }) => ({
  user: one(users, {
    fields: [links.userId],
    references: [users.id]
  })
}));
```

---

## 17. Migração SQL

```sql
-- migrations/0002_create_links.sql

-- Tabela de slugs reservados
CREATE TABLE IF NOT EXISTS reserved_slugs (
  slug VARCHAR(50) PRIMARY KEY,
  reason VARCHAR(255) NOT NULL
);

-- Seed de slugs reservados
INSERT INTO reserved_slugs (slug, reason) VALUES
  ('api', 'system_route'),
  ('auth', 'system_route'),
  ('dashboard', 'system_route'),
  ('admin', 'system_route'),
  ('login', 'system_route'),
  ('signup', 'system_route'),
  ('logout', 'system_route'),
  ('settings', 'system_route'),
  ('health', 'system_route'),
  ('metrics', 'system_route'),
  ('docs', 'system_route'),
  ('help', 'system_route'),
  ('support', 'system_route'),
  ('favicon.ico', 'browser'),
  ('robots.txt', 'seo'),
  ('sitemap.xml', 'seo'),
  ('.well-known', 'browser'),
  ('privacy', 'legal'),
  ('terms', 'legal'),
  ('tos', 'legal'),
  ('legal', 'legal'),
  ('dmca', 'legal'),
  ('abuse', 'legal')
ON CONFLICT (slug) DO NOTHING;

-- Tabela de links
CREATE TABLE IF NOT EXISTS links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Core
  original_url TEXT NOT NULL,
  short_code VARCHAR(20) NOT NULL UNIQUE,
  redirect_type SMALLINT NOT NULL DEFAULT 302,

  -- Contadores
  clicks_count INTEGER NOT NULL DEFAULT 0,
  max_clicks INTEGER,

  -- Proteção
  password_hash VARCHAR(255),

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_banned BOOLEAN NOT NULL DEFAULT false,
  banned_at TIMESTAMPTZ,
  banned_reason VARCHAR(255),
  expires_at TIMESTAMPTZ,

  -- Meta Tags
  meta_title VARCHAR(255),
  meta_description TEXT,
  meta_image VARCHAR(500),

  -- UTM
  utm_source VARCHAR(100),
  utm_medium VARCHAR(100),
  utm_campaign VARCHAR(100),

  -- Organização
  tags VARCHAR(50)[],
  notes TEXT,

  -- Timestamps
  last_clicked_at TIMESTAMPTZ,
  qr_generated_at TIMESTAMPTZ,
  created_by_ip_hash VARCHAR(64),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Índices
CREATE UNIQUE INDEX idx_links_short_code ON links(short_code);
CREATE INDEX idx_links_user_active ON links(user_id, deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_links_created_at ON links(created_at);
CREATE INDEX idx_links_expires ON links(expires_at) WHERE expires_at IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX idx_links_tags ON links USING GIN(tags);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER links_updated_at
  BEFORE UPDATE ON links
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
```

---

## 18. Testes Unitários

```typescript
// src/server/services/__tests__/link.service.test.ts
import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { validateUrl } from '../url-validator';
import { generateUniqueCode, validateCustomAlias } from '../shortcode.service';

describe('URL Validator', () => {
  it('should accept valid https URLs', () => {
    const result = validateUrl('https://example.com/path?query=1');
    expect(result).toEqual({ valid: true });
  });

  it('should reject non-http protocols', () => {
    const result = validateUrl('ftp://example.com');
    expect(result).toEqual({ valid: false, error: 'INVALID_PROTOCOL' });
  });

  it('should block other shorteners', () => {
    const result = validateUrl('https://bit.ly/abc123');
    expect(result).toEqual({ valid: false, error: 'SHORTENER_BLOCKED' });
  });

  it('should reject URLs over 2048 chars', () => {
    const longUrl = 'https://example.com/' + 'a'.repeat(2040);
    const result = validateUrl(longUrl);
    expect(result).toEqual({ valid: false, error: 'URL_TOO_LONG' });
  });

  it('should reject invalid formats', () => {
    const result = validateUrl('not-a-url');
    expect(result).toEqual({ valid: false, error: 'INVALID_FORMAT' });
  });
});

describe('Custom Alias Validator', () => {
  it('should accept valid aliases', async () => {
    // Mock DB para retornar vazio
    const result = await validateCustomAlias('my-custom-link');
    expect(result).toBe(true);
  });

  it('should reject aliases with invalid characters', async () => {
    const result = await validateCustomAlias('my_link!');
    expect(result).toBe(false);
  });

  it('should reject aliases too short', async () => {
    const result = await validateCustomAlias('ab');
    expect(result).toBe(false);
  });
});
```

---

## 19. Checklist de Implementação (Atualizado)

| Item | Descrição                                  | Status |
| ---- | ------------------------------------------ | ------ |
| 3.1  | Tipos TypeScript (input/response)          | ✅     |
| 3.2  | Schema de links com Drizzle + Relations    | ✅     |
| 3.3  | Migração SQL                               | ✅     |
| 3.4  | Short code generator (NanoID)              | ✅     |
| 3.5  | Slugs reservados (seed + validação)        | ✅     |
| 3.6  | URL validator (protocolo, blacklist)       | ✅     |
| 3.7  | Features premium (alias, senha, expiração) | ✅     |
| 3.8  | Meta tags sanitization (DOMPurify)         | ✅     |
| 3.9  | QR Code service com cache                  | ✅     |
| 3.10 | UTM tracking                               | ✅     |
| 3.11 | Idempotency keys                           | ✅     |
| 3.12 | Tags & Notes                               | ✅     |
| 3.13 | Link Service (CRUD completo)               | ✅     |
| 3.14 | Toggle active status                       | ✅     |
| 3.15 | Error handling com códigos HTTP            | ✅     |
| 3.16 | API routes ElysiaJS                        | ✅     |
| 3.17 | Testes unitários                           | ✅     |
| 3.18 | Padrões Elysia MVC                         | ✅     |

---

## 20. Referências

- [PRD - Requisitos RF-01 a RF-11, RF-22 a RF-26](../prd.md)
- [Database Schema](../architecture/database-schema.md)
- [Caching Strategy](../architecture/caching-strategy.md)
- [API Endpoints](../api/endpoints.md)
- [Elysia Best Practices](https://elysiajs.com/essential/best-practice)
