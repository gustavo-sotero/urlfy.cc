import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

// ═══════════════════════════════════════════════════════════════════
// USERS - Main user table with custom fields
// ═══════════════════════════════════════════════════════════════════
export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),

  // Custom fields for urlfy.cc
  role: varchar("role", { length: 20 }).default("user").notNull(), // 'user' | 'admin'
  linksQuota: integer("links_quota").default(100).notNull(),
  linksCount: integer("links_count").default(0).notNull(),

  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),

  // Soft delete and ban
  bannedAt: timestamp("banned_at"),
  bannedReason: varchar("banned_reason", { length: 255 }),
  deletedAt: timestamp("deleted_at"),
});

// ═══════════════════════════════════════════════════════════════════
// SESSIONS - Active user sessions
// ═══════════════════════════════════════════════════════════════════
export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [
    index("session_userId_idx").on(table.userId),
    index("session_token_idx").on(table.token),
  ],
);

// ═══════════════════════════════════════════════════════════════════
// ACCOUNTS - OAuth linked accounts
// ═══════════════════════════════════════════════════════════════════
export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("account_userId_idx").on(table.userId),
    index("account_providerId_idx").on(table.providerId, table.accountId),
  ],
);

// ═══════════════════════════════════════════════════════════════════
// VERIFICATIONS - Email verification and password reset tokens
// ═══════════════════════════════════════════════════════════════════
export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("verification_identifier_idx").on(table.identifier),
    index("verification_expiresAt_idx").on(table.expiresAt),
  ],
);

// ═══════════════════════════════════════════════════════════════════
// TWO FACTORS - TOTP 2FA configuration
// ═══════════════════════════════════════════════════════════════════
export const twoFactor = pgTable(
  "two_factor",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" })
      .unique(),
    secret: text("secret").notNull(),
    backupCodes: text("backup_codes").notNull(),
    verified: boolean("verified").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("twoFactor_userId_idx").on(table.userId)],
);

// ═══════════════════════════════════════════════════════════════════
// API KEYS - Programmatic access keys
// ═══════════════════════════════════════════════════════════════════
export const apiKey = pgTable(
  "api_key",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 100 }).notNull(),
    keyHash: varchar("key_hash", { length: 64 }).notNull().unique(),
    keyPrefix: varchar("key_prefix", { length: 12 }).notNull(),
    permissions: jsonb("permissions")
      .$type<{
        links: {
          create: boolean;
          read: boolean;
          update: boolean;
          delete: boolean;
        };
        analytics: { read: boolean };
      }>()
      .notNull(),
    rateLimit: integer("rate_limit").default(1000).notNull(),
    lastUsedAt: timestamp("last_used_at"),
    usageCount: integer("usage_count").default(0).notNull(),
    expiresAt: timestamp("expires_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    revokedAt: timestamp("revoked_at"),
    deletedAt: timestamp("deleted_at"),
  },
  (table) => [
    index("apiKey_userId_idx").on(table.userId),
    index("apiKey_keyHash_idx").on(table.keyHash),
  ],
);

// ═══════════════════════════════════════════════════════════════════
// RELATIONS
// ═══════════════════════════════════════════════════════════════════
export const userRelations = relations(user, ({ many, one }) => ({
  sessions: many(session),
  accounts: many(account),
  apiKeys: many(apiKey),
  twoFactor: one(twoFactor, {
    fields: [user.id],
    references: [twoFactor.userId],
  }),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}));

export const twoFactorRelations = relations(twoFactor, ({ one }) => ({
  user: one(user, {
    fields: [twoFactor.userId],
    references: [user.id],
  }),
}));

export const apiKeyRelations = relations(apiKey, ({ one }) => ({
  user: one(user, {
    fields: [apiKey.userId],
    references: [user.id],
  }),
}));

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════
export type User = typeof user.$inferSelect;
export type NewUser = typeof user.$inferInsert;
export type Session = typeof session.$inferSelect;
export type Account = typeof account.$inferSelect;
export type Verification = typeof verification.$inferSelect;
export type TwoFactor = typeof twoFactor.$inferSelect;
export type ApiKey = typeof apiKey.$inferSelect;
export type NewApiKey = typeof apiKey.$inferInsert;

export type UserRole = "user" | "admin";

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
