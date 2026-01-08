/**
 * ═════════════════════════════════════════════════════════════════════
 * API KEY AUTHENTICATION TESTS
 * ═════════════════════════════════════════════════════════════════════
 * Test suite for API key authentication middleware
 *
 * Module: Authentication & Identity (Module 2)
 * Requirement: RF-29
 * ═════════════════════════════════════════════════════════════════════
 */

import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/db";
import { apiKey as apiKeyTable } from "@/db/schema/auth";
import { auth } from "@/lib/auth";

describe("API Key Authentication", () => {
  let testUser: {
    id: string;
    email: string;
    sessionToken?: string;
  };

  let testApiKey: {
    id: string;
    key: string;
    name: string;
  };

  beforeAll(async () => {
    // Create test user
    const email = `test-apikey-${nanoid()}@urlfy.test`;
    const password = "TestPassword123!";

    const signUpResult = await auth.api.signUpEmail({
      body: {
        email,
        password,
        name: "API Key Test User",
      },
      headers: new Headers(),
    });

    const signInResult = await auth.api.signInEmail({
      body: { email, password },
      headers: new Headers(),
    });

    testUser = {
      id: signUpResult?.user?.id || "",
      email,
      sessionToken: signInResult?.token,
    };

    // Create API key
    const createKeyResponse = await fetch(
      "http://localhost:3000/api/v1/auth/api-keys",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `urlfy.session=${testUser.sessionToken}`,
        },
        body: JSON.stringify({
          name: "Test API Key",
          permissions: {
            links: {
              create: true,
              read: true,
              update: true,
              delete: false,
            },
            analytics: {
              read: true,
            },
          },
        }),
      },
    );

    const keyData = await createKeyResponse.json();
    testApiKey = {
      id: keyData.data.id,
      key: keyData.data.key,
      name: keyData.data.name,
    };
  });

  afterAll(async () => {
    // Cleanup
    if (testApiKey.id) {
      await db.delete(apiKeyTable).where(eq(apiKeyTable.id, testApiKey.id));
    }
    if (testUser.id) {
      const { session: sessionTable, user: userTable } = await import(
        "@/db/schema/auth"
      );
      await db.delete(sessionTable).where(eq(sessionTable.userId, testUser.id));
      await db.delete(userTable).where(eq(userTable.id, testUser.id));
    }
  });

  // ═══════════════════════════════════════════════════════════════════
  // API KEY FORMAT VALIDATION
  // ═══════════════════════════════════════════════════════════════════

  describe("API Key Format", () => {
    it("should start with urlfy_sk_ prefix", () => {
      expect(testApiKey.key).toMatch(/^urlfy_sk_/);
    });

    it("should be at least 40 characters long", () => {
      expect(testApiKey.key.length).toBeGreaterThanOrEqual(40);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // AUTHENTICATION TESTS
  // ═══════════════════════════════════════════════════════════════════

  describe("Authentication with API Key", () => {
    it("should authenticate with valid API key", async () => {
      const response = await fetch("http://localhost:3000/api/v1/me", {
        headers: {
          "x-api-key": testApiKey.key,
        },
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.email).toBe(testUser.email);
    });

    it("should reject request without API key", async () => {
      const response = await fetch("http://localhost:3000/api/v1/me");
      expect(response.status).toBe(401);
    });

    it("should reject invalid API key", async () => {
      const response = await fetch("http://localhost:3000/api/v1/me", {
        headers: {
          "x-api-key": "urlfy_sk_invalid_key_12345678901234567890",
        },
      });

      expect(response.status).toBe(401);
    });

    it("should reject API key with wrong prefix", async () => {
      const response = await fetch("http://localhost:3000/api/v1/me", {
        headers: {
          "x-api-key": "wrong_prefix_12345678901234567890",
        },
      });

      expect(response.status).toBe(401);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // USAGE TRACKING TESTS
  // ═══════════════════════════════════════════════════════════════════

  describe("API Key Usage Tracking", () => {
    it("should track API key usage", async () => {
      // Get initial usage count
      const initialResponse = await fetch(
        "http://localhost:3000/api/v1/auth/api-keys",
        {
          headers: {
            Cookie: `urlfy.session=${testUser.sessionToken}`,
          },
        },
      );
      const initialData = await initialResponse.json();
      const initialKey = initialData.data.find(
        (k: { id: string }) => k.id === testApiKey.id,
      );
      const initialCount = initialKey?.usageCount || 0;

      // Make request with API key
      await fetch("http://localhost:3000/api/v1/me", {
        headers: {
          "x-api-key": testApiKey.key,
        },
      });

      // Wait a bit for async update
      await Bun.sleep(100);

      // Check usage count increased
      const finalResponse = await fetch(
        "http://localhost:3000/api/v1/auth/api-keys",
        {
          headers: {
            Cookie: `urlfy.session=${testUser.sessionToken}`,
          },
        },
      );
      const finalData = await finalResponse.json();
      const finalKey = finalData.data.find(
        (k: { id: string }) => k.id === testApiKey.id,
      );
      const finalCount = finalKey?.usageCount || 0;

      expect(finalCount).toBeGreaterThan(initialCount);
    });

    it("should update lastUsedAt timestamp", async () => {
      // Get initial timestamp
      const [initialKey] = await db
        .select()
        .from(apiKeyTable)
        .where(eq(apiKeyTable.id, testApiKey.id))
        .limit(1);

      const initialLastUsed = initialKey?.lastUsedAt;

      // Make request with API key
      await fetch("http://localhost:3000/api/v1/me", {
        headers: {
          "x-api-key": testApiKey.key,
        },
      });

      // Wait for async update
      await Bun.sleep(100);

      // Check timestamp updated
      const [finalKey] = await db
        .select()
        .from(apiKeyTable)
        .where(eq(apiKeyTable.id, testApiKey.id))
        .limit(1);

      const finalLastUsed = finalKey?.lastUsedAt;

      if (initialLastUsed) {
        expect(finalLastUsed?.getTime()).toBeGreaterThan(
          initialLastUsed.getTime(),
        );
      } else {
        expect(finalLastUsed).toBeDefined();
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // REVOCATION TESTS
  // ═══════════════════════════════════════════════════════════════════

  describe("API Key Revocation", () => {
    it("should reject revoked API key", async () => {
      // Create a temporary key
      const createResponse = await fetch(
        "http://localhost:3000/api/v1/auth/api-keys",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Cookie: `urlfy.session=${testUser.sessionToken}`,
          },
          body: JSON.stringify({
            name: "Temporary Key",
            permissions: { links: { read: true }, analytics: { read: true } },
          }),
        },
      );

      const tempKeyData = await createResponse.json();
      const tempKey = tempKeyData.data.key;
      const tempKeyId = tempKeyData.data.id;

      // Verify key works
      const validResponse = await fetch("http://localhost:3000/api/v1/me", {
        headers: { "x-api-key": tempKey },
      });
      expect(validResponse.status).toBe(200);

      // Delete the key
      await fetch(`http://localhost:3000/api/v1/auth/api-keys/${tempKeyId}`, {
        method: "DELETE",
        headers: {
          Cookie: `urlfy.session=${testUser.sessionToken}`,
        },
      });

      // Try to use revoked key
      const revokedResponse = await fetch("http://localhost:3000/api/v1/me", {
        headers: { "x-api-key": tempKey },
      });
      expect(revokedResponse.status).toBe(401);

      // Cleanup
      await db.delete(apiKeyTable).where(eq(apiKeyTable.id, tempKeyId));
    });
  });
});
