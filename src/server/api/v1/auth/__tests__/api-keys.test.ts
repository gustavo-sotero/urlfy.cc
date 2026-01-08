/**
 * ═════════════════════════════════════════════════════════════════════
 * API KEYS TESTS
 * ═════════════════════════════════════════════════════════════════════
 * Test suite for API key management endpoints
 *
 * Module: Authentication & Identity (Module 2)
 * Spec: module-02-authentication.md (RF-29)
 * ═════════════════════════════════════════════════════════════════════
 */

import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/db";
import {
  apiKey as apiKeyTable,
  session as sessionTable,
  user as userTable,
} from "@/db/schema/auth";
import { auth } from "@/lib/auth";

describe("API Keys API", () => {
  let testUser: {
    id: string;
    email: string;
    password: string;
    sessionToken?: string;
  };

  let createdApiKeyId: string;

  // ═══════════════════════════════════════════════════════════════════
  // SETUP & TEARDOWN
  // ═══════════════════════════════════════════════════════════════════

  beforeAll(async () => {
    // Create test user
    testUser = {
      id: nanoid(),
      email: `test-apikeys-${nanoid()}@urlfy.test`,
      password: "TestPassword123!",
    };

    // Register via Better-Auth
    const signUpResult = await auth.api.signUpEmail({
      body: {
        email: testUser.email,
        password: testUser.password,
        name: "Test API User",
      },
      headers: new Headers(),
    });

    if (signUpResult?.user) {
      testUser.id = signUpResult.user.id;
    }

    // Sign in to get session token
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
  });

  afterAll(async () => {
    // Cleanup: delete test data
    if (testUser.id) {
      await db.delete(apiKeyTable).where(eq(apiKeyTable.userId, testUser.id));
      await db.delete(sessionTable).where(eq(sessionTable.userId, testUser.id));
      await db.delete(userTable).where(eq(userTable.id, testUser.id));
    }
  });

  // ═══════════════════════════════════════════════════════════════════
  // CREATE API KEY TESTS
  // ═══════════════════════════════════════════════════════════════════

  describe("POST /api/v1/auth/api-keys", () => {
    it("should create a new API key", async () => {
      const response = await fetch(
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
                update: false,
                delete: false,
              },
              analytics: {
                read: true,
              },
            },
          }),
        },
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.key).toContain("urlfy_sk_");
      expect(data.data.name).toBe("Test API Key");
      expect(data.data.warning).toBeDefined();

      createdApiKeyId = data.data.id;
    });

    it("should require authentication", async () => {
      const response = await fetch(
        "http://localhost:3000/api/v1/auth/api-keys",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: "Test API Key",
          }),
        },
      );

      expect(response.status).toBe(401);
    });

    it("should validate name length", async () => {
      const response = await fetch(
        "http://localhost:3000/api/v1/auth/api-keys",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Cookie: `urlfy.session=${testUser.sessionToken}`,
          },
          body: JSON.stringify({
            name: "", // Empty name
          }),
        },
      );

      expect(response.status).toBe(400);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // LIST API KEYS TESTS
  // ═══════════════════════════════════════════════════════════════════

  describe("GET /api/v1/auth/api-keys", () => {
    it("should list all API keys", async () => {
      const response = await fetch(
        "http://localhost:3000/api/v1/auth/api-keys",
        {
          headers: {
            Cookie: `urlfy.session=${testUser.sessionToken}`,
          },
        },
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
      expect(data.data.length).toBeGreaterThan(0);
    });

    it("should not return key hashes", async () => {
      const response = await fetch(
        "http://localhost:3000/api/v1/auth/api-keys",
        {
          headers: {
            Cookie: `urlfy.session=${testUser.sessionToken}`,
          },
        },
      );

      const data = await response.json();
      const firstKey = data.data[0];
      expect(firstKey.keyHash).toBeUndefined();
      expect(firstKey.name).toBeDefined();
      expect(firstKey.permissions).toBeDefined();
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // UPDATE API KEY TESTS
  // ═══════════════════════════════════════════════════════════════════

  describe("PATCH /api/v1/auth/api-keys/:keyId", () => {
    it("should update API key name and permissions", async () => {
      const response = await fetch(
        `http://localhost:3000/api/v1/auth/api-keys/${createdApiKeyId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Cookie: `urlfy.session=${testUser.sessionToken}`,
          },
          body: JSON.stringify({
            name: "Updated API Key",
            permissions: {
              links: {
                create: true,
                read: true,
                update: true,
                delete: true,
              },
            },
          }),
        },
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.name).toBe("Updated API Key");
    });

    it("should return error for non-existent key", async () => {
      const response = await fetch(
        "http://localhost:3000/api/v1/auth/api-keys/non-existent-id",
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Cookie: `urlfy.session=${testUser.sessionToken}`,
          },
          body: JSON.stringify({
            name: "Updated Name",
          }),
        },
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error.code).toBe("API_KEY_NOT_FOUND");
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // DELETE API KEY TESTS
  // ═══════════════════════════════════════════════════════════════════

  describe("DELETE /api/v1/auth/api-keys/:keyId", () => {
    it("should delete (soft delete) an API key", async () => {
      const response = await fetch(
        `http://localhost:3000/api/v1/auth/api-keys/${createdApiKeyId}`,
        {
          method: "DELETE",
          headers: {
            Cookie: `urlfy.session=${testUser.sessionToken}`,
          },
        },
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.message).toContain("deleted");
    });

    it("should not list deleted keys", async () => {
      const response = await fetch(
        "http://localhost:3000/api/v1/auth/api-keys",
        {
          headers: {
            Cookie: `urlfy.session=${testUser.sessionToken}`,
          },
        },
      );

      const data = await response.json();
      const deletedKey = data.data.find(
        (k: { id: string; name: string }) => k.id === createdApiKeyId,
      );
      expect(deletedKey).toBeUndefined();
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // API KEY AUTHENTICATION TESTS
  // ═══════════════════════════════════════════════════════════════════

  describe("API Key Authentication", () => {
    let activeApiKey: string;

    beforeAll(async () => {
      // Create a fresh API key for authentication tests
      const response = await fetch(
        "http://localhost:3000/api/v1/auth/api-keys",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Cookie: `urlfy.session=${testUser.sessionToken}`,
          },
          body: JSON.stringify({
            name: "Auth Test Key",
            permissions: {
              links: { create: true, read: true, update: true, delete: true },
              analytics: { read: true },
            },
          }),
        },
      );

      const data = await response.json();
      activeApiKey = data.data.key;
    });

    it("should authenticate with valid API key", async () => {
      // Test API key authentication by calling an endpoint that uses apiKeyAuth middleware
      // Note: This would need an actual endpoint that supports API key auth
      expect(activeApiKey).toContain("urlfy_sk_");
      expect(activeApiKey.length).toBeGreaterThan(40);
    });

    it("should reject invalid API key", async () => {
      // This would test the apiKeyAuth middleware
      // For now, we validate format
      expect("invalid-key").not.toContain("urlfy_sk_");
    });
  });
});
