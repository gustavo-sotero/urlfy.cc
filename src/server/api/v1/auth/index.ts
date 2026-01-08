/**
 * ═════════════════════════════════════════════════════════════════════
 * AUTH ROUTES
 * ═════════════════════════════════════════════════════════════════════
 * Custom auth endpoints beyond Better-Auth defaults
 *
 * Module: Authentication & Identity (Module 2)
 * Spec: module-02-authentication.md
 * ═════════════════════════════════════════════════════════════════════
 */

import { and, desc, eq, ne } from "drizzle-orm";
import { Elysia, t } from "elysia";
import { db } from "@/db";
import {
  session as sessionTable,
  twoFactor as twoFactorTable,
} from "@/db/schema/auth";
import type { Session, User } from "@/lib/auth";
import { requireAuth } from "@/server/middleware/auth.middleware";

export const authRoutes = new Elysia({ prefix: "/auth" })
  // Apply authentication middleware to all routes in this group
  .use(requireAuth)

  // ═══════════════════════════════════════════════════════════════════
  // GET CURRENT SESSION WITH FULL USER DETAILS
  // ═══════════════════════════════════════════════════════════════════
  .get(
    "/session",
    async (context) => {
      // Access decorated context properties from requireAuth middleware
      const { user, session } = context as typeof context & {
        user: User;
        session: Session;
      };
      return {
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            emailVerified: user.emailVerified,
            image: user.image,
            role: user.role,
            linksQuota: user.linksQuota,
            linksCount: user.linksCount,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
          },
          session: {
            id: session.id,
            expiresAt: session.expiresAt,
            ipAddress: session.ipAddress,
            userAgent: session.userAgent,
          },
        },
      };
    },
    {
      detail: {
        tags: ["Auth"],
        summary: "Get current session details",
        description: "Returns the current user session with full user details",
      },
    },
  )

  // ═══════════════════════════════════════════════════════════════════
  // TWO-FACTOR STATUS
  // ═══════════════════════════════════════════════════════════════════
  .get(
    "/two-factor/status",
    async (context) => {
      const { user } = context as typeof context & {
        user: { id: string };
      };
      try {
        // Check if user has 2FA enabled by querying database directly
        const result = await db
          .select({ verified: twoFactorTable.verified })
          .from(twoFactorTable)
          .where(eq(twoFactorTable.userId, user.id))
          .limit(1);

        const enabled = result.length > 0 && result[0].verified;

        return {
          success: true,
          data: {
            enabled,
            verified: enabled,
          },
        };
      } catch {
        // If error, assume 2FA is not enabled
        return {
          success: true,
          data: {
            enabled: false,
            verified: false,
          },
        };
      }
    },
    {
      detail: {
        tags: ["Auth", "2FA"],
        summary: "Get 2FA status",
        description:
          "Check if two-factor authentication is enabled for the current user",
      },
    },
  )

  // ═══════════════════════════════════════════════════════════════════
  // LIST USER SESSIONS
  // ═══════════════════════════════════════════════════════════════════
  .get(
    "/sessions",
    async (context) => {
      const { user } = context as typeof context & {
        user: { id: string };
      };
      const sessions = await db
        .select()
        .from(sessionTable)
        .where(eq(sessionTable.userId, user.id))
        .orderBy(desc(sessionTable.createdAt));

      return {
        success: true,
        data: sessions.map((s) => ({
          id: s.id,
          ipAddress: s.ipAddress,
          userAgent: s.userAgent,
          expiresAt: s.expiresAt,
          createdAt: s.createdAt,
        })),
      };
    },
    {
      detail: {
        tags: ["Auth", "Sessions"],
        summary: "List user sessions",
        description: "Get all active sessions for the current user",
      },
    },
  )

  // ═══════════════════════════════════════════════════════════════════
  // REVOKE SESSION
  // ═══════════════════════════════════════════════════════════════════
  .delete(
    "/sessions/:sessionId",
    async (context) => {
      const {
        params: { sessionId },
        user,
      } = context as typeof context & {
        params: { sessionId: string };
        user: { id: string };
      };
      // Delete the session
      const deleted = await db
        .delete(sessionTable)
        .where(
          and(eq(sessionTable.id, sessionId), eq(sessionTable.userId, user.id)),
        )
        .returning();

      if (deleted.length === 0) {
        return {
          success: false,
          error: {
            code: "SESSION_NOT_FOUND",
            message: "Session not found or already revoked",
          },
        };
      }

      return {
        success: true,
        data: {
          message: "Session revoked successfully",
        },
      };
    },
    {
      params: t.Object({
        sessionId: t.String(),
      }),
      detail: {
        tags: ["Auth", "Sessions"],
        summary: "Revoke session",
        description: "Revoke a specific session (logout from that device)",
      },
    },
  )

  // ═══════════════════════════════════════════════════════════════════
  // REVOKE ALL OTHER SESSIONS
  // ═══════════════════════════════════════════════════════════════════
  .delete(
    "/sessions",
    async (context) => {
      const { user, session } = context as typeof context & {
        user: { id: string };
        session: { id: string };
      };
      // Delete all sessions except the current one
      await db.delete(sessionTable).where(
        and(
          eq(sessionTable.userId, user.id),
          // Don't delete current session
          ne(sessionTable.id, session.id),
        ),
      );

      return {
        success: true,
        data: {
          message: "All other sessions revoked successfully",
        },
      };
    },
    {
      detail: {
        tags: ["Auth", "Sessions"],
        summary: "Revoke all other sessions",
        description: "Logout from all devices except the current one",
      },
    },
  );
