/**
 * ═════════════════════════════════════════════════════════════════════
 * USERS ADMIN API TESTS
 * ═════════════════════════════════════════════════════════════════════
 * Test suite for admin user management endpoints
 *
 * Module: Authentication & Identity (Module 2)
 * Spec: module-02-authentication.md (RF-31 to RF-34)
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

describe("Users Admin API", () => {
  let adminUser: {
    id: string;
    email: string;
    password: string;
    sessionToken?: string;
  };

  let regularUser: {
    id: string;
    email: string;
    password: string;
    sessionToken?: string;
  };

  // ═══════════════════════════════════════════════════════════════════
  // SETUP & TEARDOWN
  // ═══════════════════════════════════════════════════════════════════

  beforeAll(async () => {
    // Create admin user
    adminUser = {
      id: nanoid(),
      email: `admin-${nanoid()}@urlfy.test`,
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

      // Upgrade to admin
      await db
        .update(userTable)
        .set({ role: "admin" })
        .where(eq(userTable.id, adminUser.id));

      // Enable 2FA for admin (required)
      await db.insert(twoFactorTable).values({
        id: nanoid(),
        userId: adminUser.id,
        secret: "test-secret",
        backupCodes: JSON.stringify(["backup1", "backup2"]),
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

    // Create regular user
    regularUser = {
      id: nanoid(),
      email: `regular-${nanoid()}@urlfy.test`,
      password: "RegularPassword123!",
    };

    const regularSignUpResult = await auth.api.signUpEmail({
      body: {
        email: regularUser.email,
        password: regularUser.password,
        name: "Regular User",
      },
      headers: new Headers(),
    });

    if (regularSignUpResult?.user) {
      regularUser.id = regularSignUpResult.user.id;
    }

    const regularSignInResult = await auth.api.signInEmail({
      body: {
        email: regularUser.email,
        password: regularUser.password,
      },
      headers: new Headers(),
    });

    if (regularSignInResult?.token) {
      regularUser.sessionToken = regularSignInResult.token;
    }
  });

  afterAll(async () => {
    // Cleanup
    if (adminUser.id) {
      await db
        .delete(sessionTable)
        .where(eq(sessionTable.userId, adminUser.id));
      await db
        .delete(twoFactorTable)
        .where(eq(twoFactorTable.userId, adminUser.id));
      await db.delete(userTable).where(eq(userTable.id, adminUser.id));
    }

    if (regularUser.id) {
      await db
        .delete(sessionTable)
        .where(eq(sessionTable.userId, regularUser.id));
      await db.delete(userTable).where(eq(userTable.id, regularUser.id));
    }
  });

  // ═══════════════════════════════════════════════════════════════════
  // ACCESS CONTROL TESTS
  // ═══════════════════════════════════════════════════════════════════

  describe("Access Control", () => {
    it("should deny regular users access to admin endpoints", async () => {
      const response = await fetch("http://localhost:3000/api/v1/users", {
        headers: {
          Cookie: `urlfy.session=${regularUser.sessionToken}`,
        },
      });

      expect(response.status).toBe(403);
    });

    it("should allow admin users with 2FA to access admin endpoints", async () => {
      const response = await fetch("http://localhost:3000/api/v1/users", {
        headers: {
          Cookie: `urlfy.session=${adminUser.sessionToken}`,
        },
      });

      expect(response.status).toBe(200);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // LIST USERS TESTS
  // ═══════════════════════════════════════════════════════════════════

  describe("GET /api/v1/users", () => {
    it("should list all users with pagination", async () => {
      const response = await fetch(
        "http://localhost:3000/api/v1/users?page=1&perPage=10",
        {
          headers: {
            Cookie: `urlfy.session=${adminUser.sessionToken}`,
          },
        },
      );

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
      expect(data.meta).toBeDefined();
      expect(data.meta.page).toBe(1);
      expect(data.meta.perPage).toBe(10);
    });

    it("should search users by email", async () => {
      const response = await fetch(
        `http://localhost:3000/api/v1/users?search=${encodeURIComponent(
          regularUser.email,
        )}`,
        {
          headers: {
            Cookie: `urlfy.session=${adminUser.sessionToken}`,
          },
        },
      );

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data.length).toBeGreaterThan(0);
      expect(data.data[0].email).toBe(regularUser.email);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // GET USER BY ID TESTS
  // ═══════════════════════════════════════════════════════════════════

  describe("GET /api/v1/users/:userId", () => {
    it("should get user details", async () => {
      const response = await fetch(
        `http://localhost:3000/api/v1/users/${regularUser.id}`,
        {
          headers: {
            Cookie: `urlfy.session=${adminUser.sessionToken}`,
          },
        },
      );

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data.id).toBe(regularUser.id);
      expect(data.data.email).toBe(regularUser.email);
    });

    it("should return 404 for non-existent user", async () => {
      const response = await fetch(
        `http://localhost:3000/api/v1/users/non-existent-id`,
        {
          headers: {
            Cookie: `urlfy.session=${adminUser.sessionToken}`,
          },
        },
      );

      const data = await response.json();
      expect(data.success).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // BAN/UNBAN USER TESTS
  // ═══════════════════════════════════════════════════════════════════

  describe("PATCH /api/v1/users/:userId/ban", () => {
    it("should ban a user", async () => {
      const response = await fetch(
        `http://localhost:3000/api/v1/users/${regularUser.id}/ban`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Cookie: `urlfy.session=${adminUser.sessionToken}`,
          },
          body: JSON.stringify({
            reason: "Test ban reason",
          }),
        },
      );

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data.bannedAt).toBeDefined();
      expect(data.data.bannedReason).toBe("Test ban reason");

      // Verify user is actually banned
      const [user] = await db
        .select()
        .from(userTable)
        .where(eq(userTable.id, regularUser.id))
        .limit(1);

      expect(user.bannedAt).toBeDefined();
    });

    it("should revoke all sessions when banning", async () => {
      // Check sessions were revoked
      const sessions = await db
        .select()
        .from(sessionTable)
        .where(eq(sessionTable.userId, regularUser.id));

      expect(sessions.length).toBe(0);
    });
  });

  describe("PATCH /api/v1/users/:userId/unban", () => {
    it("should unban a user", async () => {
      const response = await fetch(
        `http://localhost:3000/api/v1/users/${regularUser.id}/unban`,
        {
          method: "PATCH",
          headers: {
            Cookie: `urlfy.session=${adminUser.sessionToken}`,
          },
        },
      );

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.success).toBe(true);

      // Verify user is actually unbanned
      const [user] = await db
        .select()
        .from(userTable)
        .where(eq(userTable.id, regularUser.id))
        .limit(1);

      expect(user.bannedAt).toBeNull();
      expect(user.bannedReason).toBeNull();
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // UPDATE ROLE TESTS
  // ═══════════════════════════════════════════════════════════════════

  describe("PATCH /api/v1/users/:userId/role", () => {
    it("should update user role to admin", async () => {
      const response = await fetch(
        `http://localhost:3000/api/v1/users/${regularUser.id}/role`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Cookie: `urlfy.session=${adminUser.sessionToken}`,
          },
          body: JSON.stringify({
            role: "admin",
          }),
        },
      );

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data.role).toBe("admin");
    });

    it("should update user role back to user", async () => {
      const response = await fetch(
        `http://localhost:3000/api/v1/users/${regularUser.id}/role`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Cookie: `urlfy.session=${adminUser.sessionToken}`,
          },
          body: JSON.stringify({
            role: "user",
          }),
        },
      );

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data.role).toBe("user");
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // UPDATE QUOTA TESTS
  // ═══════════════════════════════════════════════════════════════════

  describe("PATCH /api/v1/users/:userId/quota", () => {
    it("should update user quota", async () => {
      const response = await fetch(
        `http://localhost:3000/api/v1/users/${regularUser.id}/quota`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Cookie: `urlfy.session=${adminUser.sessionToken}`,
          },
          body: JSON.stringify({
            linksQuota: 500,
          }),
        },
      );

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data.linksQuota).toBe(500);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // STATS TESTS
  // ═══════════════════════════════════════════════════════════════════

  describe("GET /api/v1/users/stats/global", () => {
    it("should return global user statistics", async () => {
      const response = await fetch(
        "http://localhost:3000/api/v1/users/stats/global",
        {
          headers: {
            Cookie: `urlfy.session=${adminUser.sessionToken}`,
          },
        },
      );

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data.totalUsers).toBeGreaterThan(0);
      expect(data.data.activeUsers).toBeDefined();
      expect(data.data.bannedUsers).toBeDefined();
      expect(data.data.adminUsers).toBeGreaterThan(0);
    });
  });
});
