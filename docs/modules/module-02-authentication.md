# Módulo 2: Autenticação & Identidade

> 📖 [← Módulo 1: Infraestrutura](./module-01-infrastructure.md) | [Módulo 3: Gestão de Links →](./module-03-links.md)

**Requisitos Cobertos:** RF-27, RF-28, RF-29, RF-30, DB Schema (users, sessions, accounts)

---

## 1. Visão Geral

Este módulo implementa todo o sistema de **autenticação e gerenciamento de identidade** do urlfy.cc, utilizando **Better-Auth** como biblioteca principal com plugins específicos para funcionalidades avançadas.

### Funcionalidades Cobertas

- Autenticação via Email/Password
- OAuth com Google e GitHub
- Two-Factor Authentication (TOTP) obrigatório para admins
- API Keys para acesso programático
- Sistema de roles (Guest, User, Admin)
- Gerenciamento de sessões seguras
- Documentação automática OpenAPI
- **Envio de emails transacionais via Resend** (verificação, reset, boas-vindas e LGPD)

---

## 2. Stack de Autenticação

| Componente       | Tecnologia            | Função                                          |
| ---------------- | --------------------- | ----------------------------------------------- |
| **Core**         | Better-Auth           | Gerenciamento de autenticação                   |
| **Plugin 2FA**   | `twoFactor`           | TOTP para autenticação em duas etapas           |
| **Plugin Admin** | `admin`               | Gestão de usuários e roles                      |
| **Plugin API**   | `apiKey`              | Geração e validação de API keys                 |
| **Plugin Docs**  | `openAPI`             | Documentação automática                         |
| **Email**        | **Resend**            | **Envio de emails transacionais (obrigatório)** |
| **Hashing**      | Bun.password (Argon2) | Hash seguro de senhas                           |
| **JWT**          | jose                  | Tokens para unlock de links protegidos          |

---

## 3. Estrutura de Diretórios

```
src/
├── lib/
│   ├── auth.ts              # Configuração principal Better-Auth
│   ├── auth.client.ts       # Cliente para frontend
│   └── auth.cli.ts          # CLI para geração de schemas
├── server/
│   ├── api/
│   │   └── v1/
│   │       ├── auth/
│   │       │   ├── index.ts     # Routes de auth customizadas
│   │       │   └── api-keys.ts  # Gestão de API keys
│   │       └── users/
│   │           └── index.ts     # CRUD de usuários (admin)
│   ├── services/
│   │   ├── auth.service.ts      # Lógica de autenticação
│   │   └── user.service.ts      # Lógica de usuários
│   └── middleware/
│       ├── auth.middleware.ts   # Middleware de autenticação
│       └── admin.middleware.ts  # Middleware de admin
├── db/
│   └── schema/
│       └── auth.ts              # Schemas de autenticação
└── types/
    └── auth.types.ts            # Tipos TypeScript
```

---

## 4. Schema do Banco de Dados

### 4.1 Tabelas Gerenciadas pelo Better-Auth

> ⚠️ **Geradas automaticamente:** `bun run db:generate:auth`

```typescript
// packages/data/src/schema/auth.ts
import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  uuid,
  varchar,
  jsonb
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ═══════════════════════════════════════════════════════════════════
// USERS - Tabela principal de usuários
// ═══════════════════════════════════════════════════════════════════
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  emailVerified: boolean('email_verified').default(false).notNull(),
  name: varchar('name', { length: 255 }),
  image: text('image'),

  // Campos customizados
  role: varchar('role', { length: 20 }).default('user').notNull(), // 'user' | 'admin'
  linksQuota: integer('links_quota').default(100).notNull(),
  linksCount: integer('links_count').default(0).notNull(),

  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),

  // Soft delete
  bannedAt: timestamp('banned_at'),
  bannedReason: varchar('banned_reason', { length: 255 }),
  deletedAt: timestamp('deleted_at')
});

// ═══════════════════════════════════════════════════════════════════
// SESSIONS - Sessões ativas dos usuários
// ═══════════════════════════════════════════════════════════════════
export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),

  // Metadata da sessão
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

// ═══════════════════════════════════════════════════════════════════
// ACCOUNTS - Contas OAuth vinculadas
// ═══════════════════════════════════════════════════════════════════
export const accounts = pgTable('accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),

  // Provider info
  providerId: varchar('provider_id', { length: 50 }).notNull(), // 'google', 'github'
  providerAccountId: varchar('provider_account_id', { length: 255 }).notNull(),

  // Tokens
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at'),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),

  // Scopes
  scope: text('scope'),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

// ═══════════════════════════════════════════════════════════════════
// VERIFICATIONS - Tokens de verificação (email, reset password)
// ═══════════════════════════════════════════════════════════════════
export const verifications = pgTable('verifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  identifier: varchar('identifier', { length: 255 }).notNull(), // email
  value: text('value').notNull(), // token
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

// ═══════════════════════════════════════════════════════════════════
// TWO FACTORS - Configurações de 2FA
// ═══════════════════════════════════════════════════════════════════
export const twoFactors = pgTable('two_factors', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),

  // TOTP Secret (criptografado)
  secret: text('secret').notNull(),

  // Backup codes (JSON array, criptografado)
  backupCodes: text('backup_codes').notNull(),

  // Status
  verified: boolean('verified').default(false).notNull(),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

// ═══════════════════════════════════════════════════════════════════
// API KEYS - Chaves de API para acesso programático
// ═══════════════════════════════════════════════════════════════════
export const apiKeys = pgTable('api_keys', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),

  // Identificação
  name: varchar('name', { length: 100 }).notNull(),
  keyHash: varchar('key_hash', { length: 64 }).notNull().unique(), // SHA-256 do prefixo
  keyPrefix: varchar('key_prefix', { length: 12 }).notNull(), // Primeiros 8 chars para identificação

  // Permissões
  permissions: jsonb('permissions').$type<ApiKeyPermissions>().notNull(),

  // Rate limiting específico
  rateLimit: integer('rate_limit').default(1000).notNull(), // req/hora

  // Metadata
  lastUsedAt: timestamp('last_used_at'),
  usageCount: integer('usage_count').default(0).notNull(),

  // Expiração
  expiresAt: timestamp('expires_at'),

  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  revokedAt: timestamp('revoked_at')
});

// ═══════════════════════════════════════════════════════════════════
// RELATIONS
// ═══════════════════════════════════════════════════════════════════
export const usersRelations = relations(users, ({ many, one }) => ({
  sessions: many(sessions),
  accounts: many(accounts),
  apiKeys: many(apiKeys),
  twoFactor: one(twoFactors, {
    fields: [users.id],
    references: [twoFactors.userId]
  })
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id]
  })
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, {
    fields: [accounts.userId],
    references: [users.id]
  })
}));

export const apiKeysRelations = relations(apiKeys, ({ one }) => ({
  user: one(users, {
    fields: [apiKeys.userId],
    references: [users.id]
  })
}));

// ═══════════════════════════════════════════════════════════════════
// TIPOS
// ═══════════════════════════════════════════════════════════════════
export interface ApiKeyPermissions {
  links: {
    create: boolean;
    read: boolean;
    update: boolean;
    delete: boolean;
  };
  analytics: {
    read: boolean;
  };
}

export type UserRole = 'user' | 'admin';
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type ApiKey = typeof apiKeys.$inferSelect;
```

### 4.2 Índices de Performance

```sql
-- Lookup rápido por email
CREATE INDEX idx_users_email ON users(email) WHERE deleted_at IS NULL;

-- Sessões ativas
CREATE INDEX idx_sessions_user_active ON sessions(user_id, expires_at)
  WHERE expires_at > NOW();

-- Sessões por token
CREATE UNIQUE INDEX idx_sessions_token ON sessions(token);

-- Contas OAuth
CREATE UNIQUE INDEX idx_accounts_provider ON accounts(provider_id, provider_account_id);
CREATE INDEX idx_accounts_user ON accounts(user_id);

-- API Keys ativas
CREATE INDEX idx_api_keys_user ON api_keys(user_id) WHERE revoked_at IS NULL;
CREATE UNIQUE INDEX idx_api_keys_hash ON api_keys(key_hash);

-- Cleanup de verificações expiradas
CREATE INDEX idx_verifications_expires ON verifications(expires_at);
```

---

## 5. Configuração do Better-Auth

### 5.1 Configuração Principal (`src/lib/auth.ts`)

```typescript
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { twoFactor } from 'better-auth/plugins/two-factor';
import { admin } from 'better-auth/plugins/admin';
import { apiKey } from 'better-auth/plugins/api-key';
import { openAPI } from 'better-auth/plugins/open-api';
import { db } from '@/server/lib/db';
import * as schema from '@/db/schema/auth';

export const auth = betterAuth({
  // ═══════════════════════════════════════════════════════════════════
  // DATABASE ADAPTER
  // ═══════════════════════════════════════════════════════════════════
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: {
      users: schema.users,
      sessions: schema.sessions,
      accounts: schema.accounts,
      verifications: schema.verifications,
      twoFactors: schema.twoFactors,
      apiKeys: schema.apiKeys
    }
  }),

  // ═══════════════════════════════════════════════════════════════════
  // APP INFO
  // ═══════════════════════════════════════════════════════════════════
  appName: 'urlfy.cc',
  baseURL: process.env.BETTER_AUTH_URL || 'http://localhost:3000',
  secret: process.env.BETTER_AUTH_SECRET!,

  // ═══════════════════════════════════════════════════════════════════
  // EMAIL & PASSWORD
  // ═══════════════════════════════════════════════════════════════════
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,

    // Password hashing com Argon2 (Bun nativo)
    password: {
      hash: async (password: string) => {
        return Bun.password.hash(password, {
          algorithm: 'argon2id',
          memoryCost: 65536, // 64 MB
          timeCost: 3
        });
      },
      verify: async (password: string, hash: string) => {
        return Bun.password.verify(password, hash);
      }
    },

    // Callbacks de email
    sendVerificationEmail: async ({ user, url }) => {
      await sendEmail({
        to: user.email,
        subject: 'Verifique seu email - urlfy.cc',
        template: 'email-verification',
        data: { name: user.name, url }
      });
    },
    sendResetPasswordEmail: async ({ user, url }) => {
      await sendEmail({
        to: user.email,
        subject: 'Reset de senha - urlfy.cc',
        template: 'password-reset',
        data: { name: user.name, url }
      });
    }
  },

  // ═══════════════════════════════════════════════════════════════════
  // OAUTH PROVIDERS
  // ═══════════════════════════════════════════════════════════════════
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      scope: ['openid', 'email', 'profile']
    },
    github: {
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      scope: ['user:email', 'read:user']
    }
  },

  // ═══════════════════════════════════════════════════════════════════
  // SESSION CONFIGURATION
  // ═══════════════════════════════════════════════════════════════════
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 dias
    updateAge: 60 * 60 * 24, // Refresh a cada 24 horas

    cookieCache: {
      enabled: true,
      maxAge: 60 * 5 // Cache de 5 minutos
    }
  },

  // ═══════════════════════════════════════════════════════════════════
  // COOKIE CONFIGURATION
  // ═══════════════════════════════════════════════════════════════════
  cookies: {
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    httpOnly: true,
    path: '/'
  },

  // ═══════════════════════════════════════════════════════════════════
  // USER CONFIGURATION
  // ═══════════════════════════════════════════════════════════════════
  user: {
    additionalFields: {
      role: {
        type: 'string',
        required: false,
        defaultValue: 'user',
        input: false // Não permite input do usuário
      },
      linksQuota: {
        type: 'number',
        required: false,
        defaultValue: 100,
        input: false
      },
      linksCount: {
        type: 'number',
        required: false,
        defaultValue: 0,
        input: false
      }
    }
  },

  // ═══════════════════════════════════════════════════════════════════
  // RATE LIMITING
  // ═══════════════════════════════════════════════════════════════════
  rateLimit: {
    enabled: true,
    window: 60, // 1 minuto
    max: 100 // 100 requisições por minuto
  },

  // ═══════════════════════════════════════════════════════════════════
  // PLUGINS
  // ═══════════════════════════════════════════════════════════════════
  plugins: [
    // Two-Factor Authentication
    twoFactor({
      issuer: 'urlfy.cc',

      // Exige 2FA para admins
      skipVerificationOnEnable: false,

      // Backup codes
      backupCodes: {
        amount: 10,
        length: 10
      }
    }),

    // Admin Plugin
    admin({
      defaultRole: 'user',
      adminRole: 'admin'
    }),

    // API Keys
    apiKey({
      // Prefixo das chaves
      prefix: 'urlfy_sk_',

      // Rate limiting por API key
      rateLimit: {
        enabled: true,
        window: 3600, // 1 hora
        max: 1000 // 1000 req/hora (padrão)
      },

      // Expiração padrão
      defaultExpiresIn: 60 * 60 * 24 * 365 // 1 ano
    }),

    // OpenAPI Documentation
    openAPI({
      path: '/api/auth/reference'
    })
  ],

  // ═══════════════════════════════════════════════════════════════════
  // CALLBACKS
  // ═══════════════════════════════════════════════════════════════════
  callbacks: {
    // Callback após login
    onSignIn: async ({ user, session }) => {
      // Log de auditoria
      await logAuditEvent({
        action: 'user.login',
        userId: user.id,
        metadata: {
          sessionId: session.id,
          ipAddress: session.ipAddress
        }
      });
    },

    // Callback após logout
    onSignOut: async ({ session }) => {
      await logAuditEvent({
        action: 'user.logout',
        userId: session.userId,
        metadata: { sessionId: session.id }
      });
    },

    // Callback após criação de usuário
    onUserCreated: async ({ user }) => {
      // Envia email de boas-vindas
      await sendEmail({
        to: user.email,
        subject: 'Bem-vindo ao urlfy.cc!',
        template: 'welcome',
        data: { name: user.name }
      });
    }
  }
});

// Export types
export type Auth = typeof auth;
export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.User;
```

### 5.2 Cliente de Autenticação (`src/lib/auth.client.ts`)

```typescript
import { createAuthClient } from 'better-auth/react';
import { twoFactorClient } from 'better-auth/client/plugins';
import { adminClient } from 'better-auth/client/plugins';
import { apiKeyClient } from 'better-auth/client/plugins';

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',

  plugins: [twoFactorClient(), adminClient(), apiKeyClient()]
});

// Exports convenientes
export const { signIn, signUp, signOut, useSession, getSession } = authClient;

// Two-Factor
export const {
  enableTwoFactor,
  disableTwoFactor,
  verifyTwoFactor,
  generateBackupCodes
} = authClient.twoFactor;

// Admin
export const { listUsers, banUser, unbanUser, updateUserRole } =
  authClient.admin;

// API Keys
export const { createApiKey, listApiKeys, revokeApiKey } = authClient.apiKey;
```

---

## 6. Middlewares de Autenticação

### 6.1 Middleware Base (`src/server/middleware/auth.middleware.ts`)

```typescript
import { Elysia } from 'elysia';
import { auth } from '@/lib/auth';
import { redis, CACHE_KEYS, CACHE_TTL } from '@/server/lib/redis';
import type { User, Session } from '@/lib/auth';

// ═══════════════════════════════════════════════════════════════════
// TIPOS
// ═══════════════════════════════════════════════════════════════════
interface AuthContext {
  user: User | null;
  session: Session | null;
  isAuthenticated: boolean;
}

interface RequireAuthContext {
  user: User;
  session: Session;
  isAuthenticated: true;
}

// ═══════════════════════════════════════════════════════════════════
// MIDDLEWARE OPCIONAL (popula contexto se autenticado)
// ═══════════════════════════════════════════════════════════════════
export const optionalAuth = new Elysia({ name: 'optional-auth' }).derive(
  async ({ request, headers }): Promise<AuthContext> => {
    // Tenta extrair sessão do cookie ou header
    const sessionResult = await extractSession(request, headers);

    if (!sessionResult) {
      return {
        user: null,
        session: null,
        isAuthenticated: false
      };
    }

    return {
      user: sessionResult.user,
      session: sessionResult.session,
      isAuthenticated: true
    };
  }
);

// ═══════════════════════════════════════════════════════════════════
// MIDDLEWARE OBRIGATÓRIO (requer autenticação)
// ═══════════════════════════════════════════════════════════════════
export const requireAuth = new Elysia({ name: 'require-auth' }).derive(
  async ({ request, headers, set }): Promise<RequireAuthContext> => {
    const sessionResult = await extractSession(request, headers);

    if (!sessionResult) {
      set.status = 401;
      throw new Error('UNAUTHORIZED');
    }

    // Verifica se usuário está banido
    if (sessionResult.user.bannedAt) {
      set.status = 403;
      throw new Error('USER_BANNED');
    }

    return {
      user: sessionResult.user,
      session: sessionResult.session,
      isAuthenticated: true
    };
  }
);

// ═══════════════════════════════════════════════════════════════════
// MIDDLEWARE DE API KEY
// ═══════════════════════════════════════════════════════════════════
export const apiKeyAuth = new Elysia({ name: 'api-key-auth' }).derive(
  async ({ headers, set }): Promise<RequireAuthContext> => {
    const apiKey = headers['x-api-key'];

    if (!apiKey) {
      set.status = 401;
      throw new Error('API_KEY_REQUIRED');
    }

    // Valida API key
    const result = await validateApiKey(apiKey);

    if (!result) {
      set.status = 401;
      throw new Error('INVALID_API_KEY');
    }

    // Verifica rate limit da API key
    const rateLimitKey = `rl:apikey:${result.keyId}`;
    const current = await redis.incr(rateLimitKey);

    if (current === 1) {
      await redis.expire(rateLimitKey, 3600); // 1 hora
    }

    if (current > result.rateLimit) {
      set.status = 429;
      throw new Error('RATE_LIMITED');
    }

    // Atualiza último uso
    await updateApiKeyUsage(result.keyId);

    return {
      user: result.user,
      session: { id: result.keyId } as Session, // Pseudo-session
      isAuthenticated: true
    };
  }
);

// ═══════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════
async function extractSession(
  request: Request,
  headers: Record<string, string | undefined>
): Promise<{ user: User; session: Session } | null> {
  // 1. Tenta Bearer token
  const authHeader = headers['authorization'];
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    return await auth.api.getSession({
      headers: { authorization: `Bearer ${token}` }
    });
  }

  // 2. Tenta cookie de sessão
  return await auth.api.getSession({ headers: request.headers });
}

async function validateApiKey(key: string): Promise<{
  keyId: string;
  user: User;
  permissions: ApiKeyPermissions;
  rateLimit: number;
} | null> {
  // Extrai prefixo (primeiros 12 caracteres)
  const prefix = key.slice(0, 12);

  // Hash do key completo
  const keyHash = await hashApiKey(key);

  // Busca no banco
  const result = await db
    .select()
    .from(apiKeys)
    .innerJoin(users, eq(apiKeys.userId, users.id))
    .where(
      and(
        eq(apiKeys.keyHash, keyHash),
        isNull(apiKeys.revokedAt),
        or(isNull(apiKeys.expiresAt), gt(apiKeys.expiresAt, new Date()))
      )
    )
    .limit(1);

  if (result.length === 0) return null;

  const { api_keys, users: user } = result[0];

  return {
    keyId: api_keys.id,
    user: user as User,
    permissions: api_keys.permissions,
    rateLimit: api_keys.rateLimit
  };
}

async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function updateApiKeyUsage(keyId: string): Promise<void> {
  await db
    .update(apiKeys)
    .set({
      lastUsedAt: new Date(),
      usageCount: sql`usage_count + 1`
    })
    .where(eq(apiKeys.id, keyId));
}
```

### 6.2 Middleware de Admin (`src/server/middleware/admin.middleware.ts`)

```typescript
import { Elysia } from 'elysia';
import { requireAuth } from './auth.middleware';
import type { User, Session } from '@/lib/auth';

interface AdminContext {
  user: User & { role: 'admin' };
  session: Session;
  isAuthenticated: true;
  isAdmin: true;
}

// ═══════════════════════════════════════════════════════════════════
// MIDDLEWARE DE ADMIN
// ═══════════════════════════════════════════════════════════════════
export const requireAdmin = new Elysia({ name: 'require-admin' })
  .use(requireAuth)
  .derive(async ({ user, session, set }): Promise<AdminContext> => {
    // Verifica role
    if (user.role !== 'admin') {
      set.status = 403;
      throw new Error('ADMIN_REQUIRED');
    }

    // Verifica se 2FA está ativo (obrigatório para admins)
    const hasTwoFactor = await checkTwoFactorEnabled(user.id);

    if (!hasTwoFactor) {
      set.status = 403;
      throw new Error('TWO_FACTOR_REQUIRED');
    }

    return {
      user: user as User & { role: 'admin' },
      session,
      isAuthenticated: true,
      isAdmin: true
    };
  });

async function checkTwoFactorEnabled(userId: string): Promise<boolean> {
  const result = await db
    .select({ verified: twoFactors.verified })
    .from(twoFactors)
    .where(eq(twoFactors.userId, userId))
    .limit(1);

  return result.length > 0 && result[0].verified;
}
```

---

## 7. Padrões Elysia para Autenticação

> 📖 **Referência:** [elysiajs.com/essential/best-practice](https://elysiajs.com/essential/best-practice)

### 7.1 Request-Dependent Service (Macro Pattern)

Para serviços que dependem do contexto HTTP (como autenticação), usamos **Elysia plugins com macros**:

```typescript
// ✅ Correto: Middleware como Elysia plugin com macro
export const authMacros = new Elysia({ name: 'Auth.Macros' }).macro({
  // Macro reutilizável para rotas que requerem auth
  requireAuth: {
    async resolve({ request, set }) {
      const session = await extractSession(request);
      if (!session) {
        set.status = 401;
        throw new Error('UNAUTHORIZED');
      }
      return { user: session.user, session: session.session };
    }
  },
  // Macro para rotas de admin
  requireAdmin: {
    async resolve({ request, set }) {
      const session = await extractSession(request);
      if (!session || session.user.role !== 'admin') {
        set.status = 403;
        throw new Error('FORBIDDEN');
      }
      return { user: session.user, isAdmin: true };
    }
  }
});

// Uso no controller
const protectedRoutes = new Elysia()
  .use(authMacros)
  .get('/me', ({ user }) => user, { requireAuth: true })
  .get('/admin/stats', ({ user }) => getStats(), { requireAdmin: true });
```

### 7.2 Non-Request Service Pattern

Para lógica de autenticação que não depende do HTTP:

```typescript
// ✅ Correto: abstract class com métodos static
abstract class AuthService {
  static async hashApiKey(key: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(key);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  static async validateApiKey(key: string): Promise<ApiKeyResult | null> {
    const keyHash = await this.hashApiKey(key);
    // Lógica pura de validação sem HTTP
    return db.query.apiKeys.findFirst({...});
  }
}
```

### 7.3 Model Pattern para Auth

```typescript
// apps/api/src/server/modules/auth/auth.schema.ts
import { Elysia, t } from 'elysia';

// ✅ TypeBox para validação + tipos
export const LoginBody = t.Object({
  email: t.String({ format: 'email' }),
  password: t.String({ minLength: 8 })
});

export const TwoFactorBody = t.Object({
  code: t.String({ minLength: 6, maxLength: 6 })
});

// ✅ Model injection para OpenAPI
export const authModels = new Elysia().model({
  'auth.login': LoginBody,
  'auth.2fa': TwoFactorBody,
  'auth.session': SessionResponse
});
```

---

## 8. Rotas de Autenticação (ElysiaJS)

### 8.1 Handler Principal (`apps/api/src/server/modules/auth/auth.controller.ts`)

```typescript
import { Elysia, t } from 'elysia';
import { auth } from '@/lib/auth';
import { requireAuth, optionalAuth } from '@/server/middleware/auth.middleware';

export const authRoutes = new Elysia({ prefix: '/auth' })
  // ═══════════════════════════════════════════════════════════════════
  // SESSÃO ATUAL
  // ═══════════════════════════════════════════════════════════════════
  .use(optionalAuth)
  .get('/session', async ({ user, session, isAuthenticated }) => {
    if (!isAuthenticated) {
      return { user: null, session: null };
    }

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
        role: user.role,
        emailVerified: user.emailVerified,
        linksQuota: user.linksQuota,
        linksCount: user.linksCount
      },
      session: {
        id: session.id,
        expiresAt: session.expiresAt
      }
    };
  })

  // ═══════════════════════════════════════════════════════════════════
  // VERIFICAR 2FA STATUS
  // ═══════════════════════════════════════════════════════════════════
  .get(
    '/two-factor/status',
    async ({ user }) => {
      const twoFactor = await db
        .select({
          verified: twoFactors.verified,
          createdAt: twoFactors.createdAt
        })
        .from(twoFactors)
        .where(eq(twoFactors.userId, user.id))
        .limit(1);

      return {
        enabled: twoFactor.length > 0 && twoFactor[0].verified,
        setupAt: twoFactor[0]?.createdAt || null
      };
    },
    { beforeHandle: [requireAuth] }
  )

  // ═══════════════════════════════════════════════════════════════════
  // LISTAR SESSÕES ATIVAS
  // ═══════════════════════════════════════════════════════════════════
  .get(
    '/sessions',
    async ({ user }) => {
      const activeSessions = await db
        .select({
          id: sessions.id,
          createdAt: sessions.createdAt,
          expiresAt: sessions.expiresAt,
          ipAddress: sessions.ipAddress,
          userAgent: sessions.userAgent
        })
        .from(sessions)
        .where(
          and(eq(sessions.userId, user.id), gt(sessions.expiresAt, new Date()))
        )
        .orderBy(desc(sessions.createdAt));

      return { sessions: activeSessions };
    },
    { beforeHandle: [requireAuth] }
  )

  // ═══════════════════════════════════════════════════════════════════
  // REVOGAR SESSÃO
  // ═══════════════════════════════════════════════════════════════════
  .delete(
    '/sessions/:sessionId',
    async ({ user, params: { sessionId }, set }) => {
      const result = await db
        .delete(sessions)
        .where(and(eq(sessions.id, sessionId), eq(sessions.userId, user.id)))
        .returning({ id: sessions.id });

      if (result.length === 0) {
        set.status = 404;
        return { error: 'SESSION_NOT_FOUND' };
      }

      return { success: true };
    },
    {
      beforeHandle: [requireAuth],
      params: t.Object({
        sessionId: t.String({ format: 'uuid' })
      })
    }
  )

  // ═══════════════════════════════════════════════════════════════════
  // REVOGAR TODAS AS OUTRAS SESSÕES
  // ═══════════════════════════════════════════════════════════════════
  .post(
    '/sessions/revoke-others',
    async ({ user, session }) => {
      const result = await db
        .delete(sessions)
        .where(
          and(eq(sessions.userId, user.id), not(eq(sessions.id, session.id)))
        )
        .returning({ id: sessions.id });

      return { revokedCount: result.length };
    },
    { beforeHandle: [requireAuth] }
  );
```

### 8.2 Rotas de API Keys (`apps/api/src/server/modules/api-keys/api-keys.controller.ts`)

```typescript
import { Elysia, t } from 'elysia';
import { requireAuth } from '@/server/middleware/auth.middleware';
import { nanoid } from 'nanoid';
import { db } from '@/server/lib/db';
import { apiKeys } from '@/db/schema/auth';

export const apiKeyRoutes = new Elysia({ prefix: '/api-keys' })
  .use(requireAuth)

  // ═══════════════════════════════════════════════════════════════════
  // LISTAR API KEYS
  // ═══════════════════════════════════════════════════════════════════
  .get('/', async ({ user }) => {
    const keys = await db
      .select({
        id: apiKeys.id,
        name: apiKeys.name,
        keyPrefix: apiKeys.keyPrefix,
        permissions: apiKeys.permissions,
        rateLimit: apiKeys.rateLimit,
        lastUsedAt: apiKeys.lastUsedAt,
        usageCount: apiKeys.usageCount,
        expiresAt: apiKeys.expiresAt,
        createdAt: apiKeys.createdAt
      })
      .from(apiKeys)
      .where(and(eq(apiKeys.userId, user.id), isNull(apiKeys.revokedAt)))
      .orderBy(desc(apiKeys.createdAt));

    return { keys };
  })

  // ═══════════════════════════════════════════════════════════════════
  // CRIAR API KEY
  // ═══════════════════════════════════════════════════════════════════
  .post(
    '/',
    async ({ user, body }) => {
      // Gera key segura
      const key = `urlfy_sk_${nanoid(32)}`;
      const keyPrefix = key.slice(0, 12);
      const keyHash = await hashApiKey(key);

      // Calcula expiração
      const expiresAt = body.expiresInDays
        ? new Date(Date.now() + body.expiresInDays * 24 * 60 * 60 * 1000)
        : null;

      // Cria no banco
      const [created] = await db
        .insert(apiKeys)
        .values({
          userId: user.id,
          name: body.name,
          keyHash,
          keyPrefix,
          permissions: body.permissions || {
            links: { create: true, read: true, update: true, delete: false },
            analytics: { read: true }
          },
          rateLimit: body.rateLimit || 1000,
          expiresAt
        })
        .returning();

      // Retorna a key apenas uma vez (não é armazenada em texto)
      return {
        id: created.id,
        name: created.name,
        key, // ⚠️ Mostrado apenas aqui!
        keyPrefix: created.keyPrefix,
        permissions: created.permissions,
        rateLimit: created.rateLimit,
        expiresAt: created.expiresAt,
        createdAt: created.createdAt
      };
    },
    {
      body: t.Object({
        name: t.String({ minLength: 1, maxLength: 100 }),
        permissions: t.Optional(
          t.Object({
            links: t.Object({
              create: t.Boolean(),
              read: t.Boolean(),
              update: t.Boolean(),
              delete: t.Boolean()
            }),
            analytics: t.Object({
              read: t.Boolean()
            })
          })
        ),
        rateLimit: t.Optional(t.Number({ minimum: 100, maximum: 10000 })),
        expiresInDays: t.Optional(t.Number({ minimum: 1, maximum: 365 }))
      })
    }
  )

  // ═══════════════════════════════════════════════════════════════════
  // REVOGAR API KEY
  // ═══════════════════════════════════════════════════════════════════
  .delete(
    '/:keyId',
    async ({ user, params: { keyId }, set }) => {
      const result = await db
        .update(apiKeys)
        .set({ revokedAt: new Date() })
        .where(
          and(
            eq(apiKeys.id, keyId),
            eq(apiKeys.userId, user.id),
            isNull(apiKeys.revokedAt)
          )
        )
        .returning({ id: apiKeys.id });

      if (result.length === 0) {
        set.status = 404;
        return { error: 'API_KEY_NOT_FOUND' };
      }

      // Invalida cache de rate limit
      await redis.del(`rl:apikey:${keyId}`);

      return { success: true };
    },
    {
      params: t.Object({
        keyId: t.String({ format: 'uuid' })
      })
    }
  );
```

---

## 9. Serviço de Usuários

### 9.1 User Service (`src/server/services/user.service.ts`)

```typescript
import { db } from '@/server/lib/db';
import {
  users,
  sessions,
  accounts,
  apiKeys,
  twoFactors
} from '@/db/schema/auth';
import { links, analyticsEvents } from '@/db/schema';
import { eq, and, isNull, sql } from 'drizzle-orm';

export class UserService {
  // ═══════════════════════════════════════════════════════════════════
  // BUSCAR USUÁRIO POR ID
  // ═══════════════════════════════════════════════════════════════════
  static async findById(userId: string) {
    const result = await db
      .select()
      .from(users)
      .where(and(eq(users.id, userId), isNull(users.deletedAt)))
      .limit(1);

    return result[0] || null;
  }

  // ═══════════════════════════════════════════════════════════════════
  // ATUALIZAR PERFIL
  // ═══════════════════════════════════════════════════════════════════
  static async updateProfile(
    userId: string,
    data: {
      name?: string;
      image?: string;
    }
  ) {
    const [updated] = await db
      .update(users)
      .set({
        ...data,
        updatedAt: new Date()
      })
      .where(eq(users.id, userId))
      .returning();

    return updated;
  }

  // ═══════════════════════════════════════════════════════════════════
  // INCREMENTAR CONTADOR DE LINKS
  // ═══════════════════════════════════════════════════════════════════
  static async incrementLinksCount(userId: string): Promise<boolean> {
    // Incremento atômico com verificação de quota
    const result = await db.execute(sql`
      UPDATE users 
      SET links_count = links_count + 1, updated_at = NOW()
      WHERE id = ${userId}
        AND links_count < links_quota
        AND deleted_at IS NULL
      RETURNING id
    `);

    return result.rowCount > 0;
  }

  // ═══════════════════════════════════════════════════════════════════
  // DECREMENTAR CONTADOR DE LINKS
  // ═══════════════════════════════════════════════════════════════════
  static async decrementLinksCount(userId: string): Promise<void> {
    await db.execute(sql`
      UPDATE users 
      SET links_count = GREATEST(links_count - 1, 0), updated_at = NOW()
      WHERE id = ${userId}
    `);
  }

  // ═══════════════════════════════════════════════════════════════════
  // VERIFICAR QUOTA
  // ═══════════════════════════════════════════════════════════════════
  static async checkQuota(userId: string): Promise<{
    current: number;
    limit: number;
    remaining: number;
    percentage: number;
  }> {
    const user = await this.findById(userId);

    if (!user) {
      throw new Error('USER_NOT_FOUND');
    }

    return {
      current: user.linksCount,
      limit: user.linksQuota,
      remaining: Math.max(user.linksQuota - user.linksCount, 0),
      percentage: Math.round((user.linksCount / user.linksQuota) * 100)
    };
  }

  // ═══════════════════════════════════════════════════════════════════
  // BANIR USUÁRIO (Admin)
  // ═══════════════════════════════════════════════════════════════════
  static async banUser(userId: string, reason: string, adminId: string) {
    const [banned] = await db
      .update(users)
      .set({
        bannedAt: new Date(),
        bannedReason: reason,
        updatedAt: new Date()
      })
      .where(eq(users.id, userId))
      .returning();

    // Revoga todas as sessões
    await db.delete(sessions).where(eq(sessions.userId, userId));

    // Revoga todas as API keys
    await db
      .update(apiKeys)
      .set({ revokedAt: new Date() })
      .where(eq(apiKeys.userId, userId));

    // Log de auditoria
    await logAuditEvent({
      action: 'user.ban',
      userId: adminId,
      entityType: 'user',
      entityId: userId,
      metadata: { reason }
    });

    return banned;
  }

  // ═══════════════════════════════════════════════════════════════════
  // DESBANIR USUÁRIO (Admin)
  // ═══════════════════════════════════════════════════════════════════
  static async unbanUser(userId: string, adminId: string) {
    const [unbanned] = await db
      .update(users)
      .set({
        bannedAt: null,
        bannedReason: null,
        updatedAt: new Date()
      })
      .where(eq(users.id, userId))
      .returning();

    await logAuditEvent({
      action: 'user.unban',
      userId: adminId,
      entityType: 'user',
      entityId: userId
    });

    return unbanned;
  }

  // ═══════════════════════════════════════════════════════════════════
  // EXPORTAR DADOS DO USUÁRIO (LGPD)
  // ═══════════════════════════════════════════════════════════════════
  static async exportUserData(userId: string) {
    const [user, userAccounts, userSessions, userLinks, userApiKeys] =
      await Promise.all([
        this.findById(userId),
        db.select().from(accounts).where(eq(accounts.userId, userId)),
        db.select().from(sessions).where(eq(sessions.userId, userId)),
        db.select().from(links).where(eq(links.userId, userId)),
        db
          .select({
            id: apiKeys.id,
            name: apiKeys.name,
            keyPrefix: apiKeys.keyPrefix,
            createdAt: apiKeys.createdAt,
            lastUsedAt: apiKeys.lastUsedAt
          })
          .from(apiKeys)
          .where(eq(apiKeys.userId, userId))
      ]);

    return {
      user: {
        id: user?.id,
        email: user?.email,
        name: user?.name,
        createdAt: user?.createdAt
      },
      accounts: userAccounts.map((a) => ({
        provider: a.providerId,
        createdAt: a.createdAt
      })),
      sessions: userSessions.map((s) => ({
        createdAt: s.createdAt,
        expiresAt: s.expiresAt
      })),
      links: userLinks.map((l) => ({
        id: l.id,
        shortCode: l.shortCode,
        originalUrl: l.originalUrl,
        createdAt: l.createdAt
      })),
      apiKeys: userApiKeys,
      exportedAt: new Date().toISOString()
    };
  }

  // ═══════════════════════════════════════════════════════════════════
  // SOLICITAR EXCLUSÃO DE DADOS (LGPD)
  // ═══════════════════════════════════════════════════════════════════
  static async requestDataDeletion(userId: string) {
    const deadline = new Date(Date.now() + 72 * 60 * 60 * 1000); // 72 horas

    await db.insert(dataDeletionRequests).values({
      userId,
      status: 'pending',
      requestedAt: new Date(),
      deadlineAt: deadline
    });

    // Notifica por email
    const user = await this.findById(userId);
    await sendEmail({
      to: user!.email,
      subject: 'Solicitação de exclusão de dados - urlfy.cc',
      template: 'data-deletion-request',
      data: {
        name: user!.name,
        deadline: deadline.toISOString()
      }
    });

    return { deadline };
  }
}
```

---

## 10. Variáveis de Ambiente

```env
# ═══════════════════════════════════════════════════════════════════
# BETTER-AUTH
# ═══════════════════════════════════════════════════════════════════
BETTER_AUTH_SECRET=your-super-secret-key-min-32-chars
BETTER_AUTH_URL=http://localhost:3000

# ═══════════════════════════════════════════════════════════════════
# OAUTH - GOOGLE
# ═══════════════════════════════════════════════════════════════════
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# ═══════════════════════════════════════════════════════════════════
# OAUTH - GITHUB
# ═══════════════════════════════════════════════════════════════════
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret

# ═══════════════════════════════════════════════════════════════════
# EMAIL (Resend - verificação, reset, boas-vindas e LGPD)
# ═══════════════════════════════════════════════════════════════════
RESEND_API_KEY=re_...
RESEND_FROM=noreply@urlfy.cc
```

---

## 11. Testes

### 11.1 Testes de Autenticação (`apps/api/tests/integration/auth.handler.test.ts`)

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { createElysiaTestClient } from '../helpers/elysia-test-client';

let client;

beforeAll(async () => {
  const { api } = await import('@/server');
  client = createElysiaTestClient(api);
});

describe('Auth API', () => {
  let testUser = {
    email: 'test@example.com',
    password: 'Test@123456'
  };

  describe('POST /auth/sign-up', () => {
    it('should create a new user', async () => {
      const response = await client.post('/api/auth/sign-up', {
        email: testUser.email,
        password: testUser.password,
        name: 'Test User'
      });

      expect(response.status).toBe(201);
      expect(response.body.data?.user.email).toBe(testUser.email);
    });

    it('should reject duplicate email', async () => {
      const response = await api.api.v1.auth['sign-up'].post({
        email: testUser.email,
        password: testUser.password,
        name: 'Test User 2'
      });

      expect(response.status).toBe(400);
      expect(response.error?.code).toBe('EMAIL_EXISTS');
    });

    it('should reject weak password', async () => {
      const response = await api.api.v1.auth['sign-up'].post({
        email: 'weak@example.com',
        password: '123',
        name: 'Weak User'
      });

      expect(response.status).toBe(400);
      expect(response.error?.code).toBe('WEAK_PASSWORD');
    });
  });

  describe('POST /auth/sign-in', () => {
    it('should authenticate valid user', async () => {
      const response = await api.api.v1.auth['sign-in'].post({
        email: testUser.email,
        password: testUser.password
      });

      expect(response.status).toBe(200);
      expect(response.data?.session).toBeDefined();
    });

    it('should reject invalid password', async () => {
      const response = await api.api.v1.auth['sign-in'].post({
        email: testUser.email,
        password: 'wrong-password'
      });

      expect(response.status).toBe(401);
    });
  });

  describe('GET /auth/session', () => {
    it('should return null for unauthenticated request', async () => {
      const response = await api.api.v1.auth.session.get();

      expect(response.status).toBe(200);
      expect(response.data?.user).toBeNull();
    });
  });

  describe('API Keys', () => {
    let authCookie: string;
    let createdKeyId: string;

    beforeAll(async () => {
      const loginResponse = await api.api.v1.auth['sign-in'].post({
        email: testUser.email,
        password: testUser.password
      });
      authCookie = loginResponse.headers.get('set-cookie')!;
    });

    it('should create API key', async () => {
      const response = await api.api.v1.auth['api-keys'].post(
        { name: 'Test Key' },
        { headers: { cookie: authCookie } }
      );

      expect(response.status).toBe(200);
      expect(response.data?.key).toMatch(/^urlfy_sk_/);
      createdKeyId = response.data?.id!;
    });

    it('should list API keys', async () => {
      const response = await api.api.v1.auth['api-keys'].get({
        headers: { cookie: authCookie }
      });

      expect(response.status).toBe(200);
      expect(response.data?.keys.length).toBeGreaterThan(0);
    });

    it('should revoke API key', async () => {
      const response = await api.api.v1.auth['api-keys'][createdKeyId].delete({
        headers: { cookie: authCookie }
      });

      expect(response.status).toBe(200);
      expect(response.data?.success).toBe(true);
    });
  });
});
```

---

## 12. Checklist de Implementação

### Fase 1: Core (Obrigatório)

- [x] Configurar Better-Auth com Drizzle adapter
- [x] Implementar schemas de banco (users, sessions, accounts)
- [x] Configurar Email/Password authentication
- [x] Implementar middleware de autenticação
- [x] Testar fluxo de registro e login

### Fase 2: OAuth

- [x] Configurar Google OAuth
- [x] Configurar GitHub OAuth
- [x] Testar linking de contas

### Fase 3: Two-Factor

- [x] Implementar plugin twoFactor
- [x] Configurar obrigatoriedade para admins
- [x] Implementar backup codes
- [x] Testar fluxo completo de 2FA

### Fase 4: API Keys

- [x] Implementar plugin apiKey
- [x] Criar endpoints de gestão
- [x] Implementar rate limiting por key
- [x] Testar autenticação via API key

### Fase 5: Admin & Compliance

- [x] Implementar rotas de admin
- [x] Criar endpoint de export de dados (LGPD)
- [x] Implementar solicitação de exclusão
- [x] Configurar audit logs

---

## 13. Referências

- [Better-Auth Documentation](https://www.better-auth.com/)
- [Drizzle ORM Docs](https://orm.drizzle.team/)
- [OWASP Authentication Guidelines](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [LGPD Guidelines](https://www.gov.br/cidadania/pt-br/acesso-a-informacao/lgpd)

---

_Este documento define a implementação do sistema de autenticação. Para requisitos, consulte o [PRD](../prd.md)._

