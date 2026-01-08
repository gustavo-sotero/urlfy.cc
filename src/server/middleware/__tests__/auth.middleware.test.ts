/**
 * ═════════════════════════════════════════════════════════════════════
 * AUTH MIDDLEWARE TESTS
 * ═════════════════════════════════════════════════════════════════════
 * Test suite for authentication middleware
 *
 * Module: Authentication & Identity (Module 2)
 * Spec: module-02-authentication.md
 * ═════════════════════════════════════════════════════════════════════
 */

import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { eq } from "drizzle-orm";
import { Elysia } from "elysia";
import { nanoid } from "nanoid";
import { db } from "@/db";
import {
  apiKey as apiKeyTable,
  session as sessionTable,
  twoFactor as twoFactorTable,
  user as userTable,
} from "@/db/schema/auth";
import { auth } from "@/lib/auth";
import {
  apiKeyAuth,
  optionalAuth,
  requireAdmin,
  requireAuth,
} from "@/server/middleware/auth.middleware";

describe("Auth Middleware", () => {
  let testUser: {
    id: string;
    email: string;
    password: string;
    sessionToken?: string;
  };

  let adminUser: {
    id: string;
    email: string;
    password: string;
    sessionToken?: string;
  };

  let testApiKey: string;

  // ═══════════════════════════════════════════════════════════════════
  // SETUP & TEARDOWN
  // ═══════════════════════════════════════════════════════════════════

  beforeAll(async () => {
    // Create regular test user
    testUser = {
      id: nanoid(),
      email: `test-middleware-${nanoid()}@urlfy.test`,
      password: "TestPassword123!",
    };

    const signUpResult = await auth.api.signUpEmail({
      body: {
        email: testUser.email,
        password: testUser.password,
        name: "Test User",
      },
      headers: new Headers(),
    });

    if (signUpResult?.user) {
      testUser.id = signUpResult.user.id;
    }

    const signInResult = await auth.api.signInEmail({
      body: {
        email: testUser.email,
        password: testUser.password,
      },
      headers: new Headers(),
    });

    if (signInResult?.token) {
      testUser.sessionToken = signInResult.token;
    }

    // Create admin user
    adminUser = {
      id: nanoid(),
      email: `admin-middleware-${nanoid()}@urlfy.test`,
      password: "AdminPassword123!",
    };

    const adminSignUpResult = await auth.api.signUpEmail({
      body: {
        email: adminUser.email,
        password: adminUser.password,
        name: "Admin User",
      },
      headers: new Headers(),
    });

    if (adminSignUpResult?.user) {
      adminUser.id = adminSignUpResult.user.id;

      // Update to admin role
      await db
        .update(userTable)
        .set({ role: "admin" })
        .where(eq(userTable.id, adminUser.id));

      // Enable 2FA for admin
      await db.insert(twoFactorTable).values({
        id: nanoid(),
        userId: adminUser.id,
        secret: "test-secret",
        backupCodes: JSON.stringify(["code1", "code2"]),
        verified: true,
      });
    }

    const adminSignInResult = await auth.api.signInEmail({
      body: {
        email: adminUser.email,
        password: adminUser.password,
      },
      headers: new Headers(),
    });

    if (adminSignInResult?.token) {
      adminUser.sessionToken = adminSignInResult.token;
    }

    // Create test API key
    const encoder = new TextEncoder();
    testApiKey = `urlfy_sk_${nanoid(32)}`;
    const data = encoder.encode(testApiKey);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const keyHash = hashArray
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    await db.insert(apiKeyTable).values({
      id: nanoid(),
      userId: testUser.id,
      name: "Test API Key",
      keyHash,
      keyPrefix: testApiKey.slice(0, 12),
      permissions: {
        links: { create: true, read: true, update: true, delete: true },
        analytics: { read: true },
      },
      rateLimit: 1000,
    });
  });

  afterAll(async () => {
    // Cleanup
    if (testUser.id) {
      await db.delete(apiKeyTable).where(eq(apiKeyTable.userId, testUser.id));
      await db.delete(sessionTable).where(eq(sessionTable.userId, testUser.id));
      await db.delete(userTable).where(eq(userTable.id, testUser.id));
    }
    if (adminUser.id) {
      await db
        .delete(twoFactorTable)
        .where(eq(twoFactorTable.userId, adminUser.id));
      await db
        .delete(sessionTable)
        .where(eq(sessionTable.userId, adminUser.id));
      await db.delete(userTable).where(eq(userTable.id, adminUser.id));
    }
  });

  // ═══════════════════════════════════════════════════════════════════
  // OPTIONAL AUTH MIDDLEWARE
  // ═══════════════════════════════════════════════════════════════════

  describe("optionalAuth middleware", () => {
    const app = new Elysia().use(optionalAuth).get("/test", (context) => ({
      isAuth: (context as { isAuthenticated?: boolean }).isAuthenticated,
      userId: (context as { user?: { id: string } }).user?.id,
    }));

    it("should populate user context when authenticated", async () => {
      const response = await app.handle(
        new Request("http://localhost:3000/test", {
          headers: {
            Cookie: `urlfy.session=${testUser.sessionToken}`,
          },
        }),
      );

      const data = await response.json();
      expect(data.isAuth).toBe(true);
      expect(data.userId).toBe(testUser.id);
    });

    it("should allow request without authentication", async () => {
      const response = await app.handle(
        new Request("http://localhost:3000/test"),
      );

      const data = await response.json();
      expect(data.isAuth).toBe(false);
      expect(data.userId).toBeNull();
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // REQUIRE AUTH MIDDLEWARE
  // ═══════════════════════════════════════════════════════════════════

  describe("requireAuth middleware", () => {
    const app = new Elysia().use(requireAuth).get("/test", (context) => ({
      // biome-ignore lint/suspicious/noExplicitAny: Test context typing
      userId: (context as any).user.id,
    }));

    it("should allow authenticated requests", async () => {
      const response = await app.handle(
        new Request("http://localhost:3000/test", {
          headers: {
            Cookie: `urlfy.session=${testUser.sessionToken}`,
          },
        }),
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.userId).toBe(testUser.id);
    });

    it("should reject unauthenticated requests", async () => {
      const response = await app.handle(
        new Request("http://localhost:3000/test"),
      );

      expect(response.status).toBe(401);
    });

    it("should reject requests with invalid session token", async () => {
      const response = await app.handle(
        new Request("http://localhost:3000/test", {
          headers: {
            Cookie: "urlfy.session=invalid-token",
          },
        }),
      );

      expect(response.status).toBe(401);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // API KEY AUTH MIDDLEWARE
  // ═══════════════════════════════════════════════════════════════════

  describe("apiKeyAuth middleware", () => {
    const app = new Elysia().use(apiKeyAuth).get("/test", (context) => ({
      // biome-ignore lint/suspicious/noExplicitAny: Test context typing
      userId: (context as any).user.id,
      // biome-ignore lint/suspicious/noExplicitAny: Test context typing
      keyName: (context as any).apiKey?.name,
    }));

    it("should authenticate with valid API key", async () => {
      const response = await app.handle(
        new Request("http://localhost:3000/test", {
          headers: {
            "x-api-key": testApiKey,
          },
        }),
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.userId).toBe(testUser.id);
      expect(data.keyName).toBe("Test API Key");
    });

    it("should reject requests without API key", async () => {
      const response = await app.handle(
        new Request("http://localhost:3000/test"),
      );

      expect(response.status).toBe(401);
    });

    it("should reject requests with invalid API key", async () => {
      const response = await app.handle(
        new Request("http://localhost:3000/test", {
          headers: {
            "x-api-key": "urlfy_sk_invalid_key",
          },
        }),
      );

      expect(response.status).toBe(401);
    });

    it("should reject requests with malformed API key", async () => {
      const response = await app.handle(
        new Request("http://localhost:3000/test", {
          headers: {
            "x-api-key": "invalid-format",
          },
        }),
      );

      expect(response.status).toBe(401);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // REQUIRE ADMIN MIDDLEWARE
  // ═══════════════════════════════════════════════════════════════════

  describe("requireAdmin middleware", () => {
    const app = new Elysia().use(requireAdmin).get("/test", (context) => ({
      // biome-ignore lint/suspicious/noExplicitAny: Test context typing
      userId: (context as any).user.id,
      // biome-ignore lint/suspicious/noExplicitAny: Test context typing
      isAdmin: (context as any).isAdmin,
    }));

    it("should allow admin users with 2FA enabled", async () => {
      const response = await app.handle(
        new Request("http://localhost:3000/test", {
          headers: {
            Cookie: `urlfy.session=${adminUser.sessionToken}`,
          },
        }),
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.userId).toBe(adminUser.id);
      expect(data.isAdmin).toBe(true);
    });

    it("should reject regular users", async () => {
      const response = await app.handle(
        new Request("http://localhost:3000/test", {
          headers: {
            Cookie: `urlfy.session=${testUser.sessionToken}`,
          },
        }),
      );

      expect(response.status).toBe(403);
    });

    it("should reject unauthenticated requests", async () => {
      const response = await app.handle(
        new Request("http://localhost:3000/test"),
      );

      expect(response.status).toBe(401);
    });
  });
});
