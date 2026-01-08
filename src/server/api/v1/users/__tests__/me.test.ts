/**
 * ═════════════════════════════════════════════════════════════════════
 * USER DATA & COMPLIANCE TESTS
 * ═════════════════════════════════════════════════════════════════════
 * Test suite for LGPD/GDPR compliance endpoints
 *
 * Module: Authentication & Identity (Module 2)
 * Requirements: RF-36, RF-37, RF-38
 * ═════════════════════════════════════════════════════════════════════
 */

import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/db";
import { dataDeletionRequest } from "@/db/schema/audit";
import { session as sessionTable, user as userTable } from "@/db/schema/auth";
import { auth } from "@/lib/auth";

describe("User Data & Compliance API", () => {
  let testUser: {
    id: string;
    email: string;
    password: string;
    sessionToken?: string;
  };

  beforeAll(async () => {
    // Create test user
    testUser = {
      id: nanoid(),
      email: `test-lgpd-${nanoid()}@urlfy.test`,
      password: "TestPassword123!",
    };

    // Register
    const signUpResult = await auth.api.signUpEmail({
      body: {
        email: testUser.email,
        password: testUser.password,
        name: "LGPD Test User",
      },
      headers: new Headers(),
    });

    if (signUpResult?.user) {
      testUser.id = signUpResult.user.id;
    }

    // Sign in
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
    // Cleanup
    if (testUser.id) {
      await db
        .delete(dataDeletionRequest)
        .where(eq(dataDeletionRequest.userId, testUser.id));
      await db.delete(sessionTable).where(eq(sessionTable.userId, testUser.id));
      await db.delete(userTable).where(eq(userTable.id, testUser.id));
    }
  });

  // ═══════════════════════════════════════════════════════════════════
  // PROFILE TESTS
  // ═══════════════════════════════════════════════════════════════════

  describe("GET /api/v1/me", () => {
    it("should return user profile", async () => {
      const response = await fetch("http://localhost:3000/api/v1/me", {
        headers: {
          Cookie: `urlfy.session=${testUser.sessionToken}`,
        },
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.email).toBe(testUser.email);
      expect(data.data.role).toBe("user");
    });

    it("should return 401 for unauthenticated request", async () => {
      const response = await fetch("http://localhost:3000/api/v1/me");
      expect(response.status).toBe(401);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // QUOTA TESTS
  // ═══════════════════════════════════════════════════════════════════

  describe("GET /api/v1/me/quota", () => {
    it("should return quota information", async () => {
      const response = await fetch("http://localhost:3000/api/v1/me/quota", {
        headers: {
          Cookie: `urlfy.session=${testUser.sessionToken}`,
        },
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.limit).toBe(100); // Default quota
      expect(data.data.used).toBe(0);
      expect(data.data.remaining).toBe(100);
      expect(data.data.percentUsed).toBe(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // DATA EXPORT TESTS (LGPD - RF-36)
  // ═══════════════════════════════════════════════════════════════════

  describe("GET /api/v1/me/export", () => {
    it("should export user data", async () => {
      const response = await fetch("http://localhost:3000/api/v1/me/export", {
        headers: {
          Cookie: `urlfy.session=${testUser.sessionToken}`,
        },
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.user).toBeDefined();
      expect(data.data.user.email).toBe(testUser.email);
      expect(data.data.sessions).toBeInstanceOf(Array);
      expect(data.data.accounts).toBeInstanceOf(Array);
      expect(data.data.exportDate).toBeDefined();
    });

    it("should include all user data fields", async () => {
      const response = await fetch("http://localhost:3000/api/v1/me/export", {
        headers: {
          Cookie: `urlfy.session=${testUser.sessionToken}`,
        },
      });

      const data = await response.json();
      const userData = data.data.user;

      expect(userData.id).toBeDefined();
      expect(userData.email).toBeDefined();
      expect(userData.name).toBeDefined();
      expect(userData.role).toBeDefined();
      expect(userData.linksQuota).toBeDefined();
      expect(userData.linksCount).toBeDefined();
      expect(userData.createdAt).toBeDefined();
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // DATA DELETION TESTS (LGPD - RF-37, RF-38)
  // ═══════════════════════════════════════════════════════════════════

  describe("DELETE /api/v1/me/data", () => {
    it("should create data deletion request", async () => {
      const response = await fetch("http://localhost:3000/api/v1/me/data", {
        method: "DELETE",
        headers: {
          Cookie: `urlfy.session=${testUser.sessionToken}`,
        },
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.requestId).toBeDefined();
      expect(data.data.requestedAt).toBeDefined();
      expect(data.data.deadlineAt).toBeDefined();

      // Verify deadline is within 72 hours
      const requestedAt = new Date(data.data.requestedAt);
      const deadlineAt = new Date(data.data.deadlineAt);
      const hoursDiff =
        (deadlineAt.getTime() - requestedAt.getTime()) / (1000 * 60 * 60);
      expect(hoursDiff).toBeLessThanOrEqual(72);
    });

    it("should prevent duplicate deletion requests", async () => {
      // Try to create another request
      const response = await fetch("http://localhost:3000/api/v1/me/data", {
        method: "DELETE",
        headers: {
          Cookie: `urlfy.session=${testUser.sessionToken}`,
        },
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error.code).toBe("REQUEST_ALREADY_EXISTS");
    });
  });

  describe("GET /api/v1/me/deletion-request", () => {
    it("should return deletion request status", async () => {
      const response = await fetch(
        "http://localhost:3000/api/v1/me/deletion-request",
        {
          headers: {
            Cookie: `urlfy.session=${testUser.sessionToken}`,
          },
        },
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
      expect(data.data.status).toBe("pending");
    });

    it("should return null when no deletion request exists", async () => {
      // Create a new user without deletion request
      const tempUser = {
        email: `temp-${nanoid()}@urlfy.test`,
        password: "TempPassword123!",
      };

      const signUpResult = await auth.api.signUpEmail({
        body: {
          email: tempUser.email,
          password: tempUser.password,
          name: "Temp User",
        },
        headers: new Headers(),
      });

      const signInResult = await auth.api.signInEmail({
        body: {
          email: tempUser.email,
          password: tempUser.password,
        },
        headers: new Headers(),
      });

      const response = await fetch(
        "http://localhost:3000/api/v1/me/deletion-request",
        {
          headers: {
            Cookie: `urlfy.session=${signInResult?.token}`,
          },
        },
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data).toBeNull();

      // Cleanup temp user
      if (signUpResult?.user) {
        await db
          .delete(sessionTable)
          .where(eq(sessionTable.userId, signUpResult.user.id));
        await db
          .delete(userTable)
          .where(eq(userTable.id, signUpResult.user.id));
      }
    });
  });
});
