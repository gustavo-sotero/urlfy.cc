/**
 * ═════════════════════════════════════════════════════════════════════
 * AUTH API TESTS
 * ═════════════════════════════════════════════════════════════════════
 * Test suite for authentication endpoints
 *
 * Module: Authentication & Identity (Module 2)
 * Spec: module-02-authentication.md
 * ═════════════════════════════════════════════════════════════════════
 */

import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/db";
import {
  session as sessionTable,
  twoFactor as twoFactorTable,
  user as userTable,
} from "@/db/schema/auth";
import { auth } from "@/lib/auth";

describe("Auth API", () => {
  let testUser: {
    id: string;
    email: string;
    password: string;
    sessionToken?: string;
  };

  // ═══════════════════════════════════════════════════════════════════
  // SETUP & TEARDOWN
  // ═══════════════════════════════════════════════════════════════════

  beforeAll(async () => {
    // Create test user
    testUser = {
      id: nanoid(),
      email: `test-${nanoid()}@urlfy.test`,
      password: "TestPassword123!",
    };

    // Register via Better-Auth
    const signUpResult = await auth.api.signUpEmail({
      body: {
        email: testUser.email,
        password: testUser.password,
        name: "Test User",
      },
      headers: new Headers(),
    });

    // Extract user ID from response
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
    // Cleanup: delete test user and related data
    if (testUser.id) {
      await db.delete(sessionTable).where(eq(sessionTable.userId, testUser.id));
      await db
        .delete(twoFactorTable)
        .where(eq(twoFactorTable.userId, testUser.id));
      await db.delete(userTable).where(eq(userTable.id, testUser.id));
    }
  });

  // ═══════════════════════════════════════════════════════════════════
  // SESSION TESTS
  // ═══════════════════════════════════════════════════════════════════

  describe("GET /api/v1/auth/session", () => {
    it("should return current session details", async () => {
      const response = await fetch(
        "http://localhost:3000/api/v1/auth/session",
        {
          headers: {
            Cookie: `urlfy.session=${testUser.sessionToken}`,
          },
        },
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.user.email).toBe(testUser.email);
    });

    it("should return 401 for unauthenticated request", async () => {
      const response = await fetch("http://localhost:3000/api/v1/auth/session");
      expect(response.status).toBe(401);
    });
  });

  describe("GET /api/v1/auth/sessions", () => {
    it("should list all user sessions", async () => {
      const response = await fetch(
        "http://localhost:3000/api/v1/auth/sessions",
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
  });

  // ═══════════════════════════════════════════════════════════════════
  // TWO-FACTOR TESTS
  // ═══════════════════════════════════════════════════════════════════

  describe("GET /api/v1/auth/two-factor/status", () => {
    it("should return 2FA status as disabled initially", async () => {
      const response = await fetch(
        "http://localhost:3000/api/v1/auth/two-factor/status",
        {
          headers: {
            Cookie: `urlfy.session=${testUser.sessionToken}`,
          },
        },
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.enabled).toBe(false);
      expect(data.data.verified).toBe(false);
    });

    it("should return enabled status after enabling 2FA", async () => {
      // Manually insert 2FA record for testing
      await db.insert(twoFactorTable).values({
        id: nanoid(),
        userId: testUser.id,
        secret: "test-secret",
        backupCodes: JSON.stringify(["code1", "code2"]),
        verified: true,
      });

      const response = await fetch(
        "http://localhost:3000/api/v1/auth/two-factor/status",
        {
          headers: {
            Cookie: `urlfy.session=${testUser.sessionToken}`,
          },
        },
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.enabled).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // SESSION MANAGEMENT TESTS
  // ═══════════════════════════════════════════════════════════════════

  describe("DELETE /api/v1/auth/sessions/:sessionId", () => {
    it("should revoke a specific session", async () => {
      // Get current sessions
      const listResponse = await fetch(
        "http://localhost:3000/api/v1/auth/sessions",
        {
          headers: {
            Cookie: `urlfy.session=${testUser.sessionToken}`,
          },
        },
      );
      const sessions = (await listResponse.json()).data;
      const sessionToRevoke = sessions[0];

      // Revoke the session
      const response = await fetch(
        `http://localhost:3000/api/v1/auth/sessions/${sessionToRevoke.id}`,
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
    });

    it("should return 404 for non-existent session", async () => {
      const response = await fetch(
        "http://localhost:3000/api/v1/auth/sessions/non-existent-id",
        {
          method: "DELETE",
          headers: {
            Cookie: `urlfy.session=${testUser.sessionToken}`,
          },
        },
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error.code).toBe("SESSION_NOT_FOUND");
    });
  });

  describe("DELETE /api/v1/auth/sessions", () => {
    it("should revoke all other sessions", async () => {
      const response = await fetch(
        "http://localhost:3000/api/v1/auth/sessions",
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
      expect(data.data.message).toContain("revoked");

      // Verify only current session remains
      const listResponse = await fetch(
        "http://localhost:3000/api/v1/auth/sessions",
        {
          headers: {
            Cookie: `urlfy.session=${testUser.sessionToken}`,
          },
        },
      );
      const sessions = (await listResponse.json()).data;
      expect(sessions.length).toBe(1);
    });
  });
});
