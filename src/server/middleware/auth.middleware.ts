import { and, eq, gt, isNull } from "drizzle-orm";
import { Elysia } from "elysia";
import {
  apiKey as apiKeyTable,
  twoFactor as twoFactorTable,
  user as userTable,
} from "@/db/schema/auth";
import type { Session, User } from "@/lib/auth";
import { auth } from "@/lib/auth";
import { db } from "@/server/lib/db";

// ═══════════════════════════════════════════════════════════════════
// OPTIONAL AUTH MIDDLEWARE (populates context if authenticated)
// ═══════════════════════════════════════════════════════════════════
export const optionalAuth = new Elysia({ name: "optional-auth" }).derive(
  async ({ request }) => {
    try {
      const sessionData = await auth.api.getSession({
        headers: request.headers,
      });

      if (sessionData?.user && sessionData?.session) {
        return {
          user: sessionData.user as User,
          session: sessionData.session as Session,
          isAuthenticated: true as const,
        };
      }
    } catch {
      // Session validation failed, continue as unauthenticated
    }

    return {
      user: null,
      session: null,
      isAuthenticated: false as const,
    };
  },
);

// ═══════════════════════════════════════════════════════════════════
// REQUIRE AUTH MIDDLEWARE (requires authentication)
// ═══════════════════════════════════════════════════════════════════
export const requireAuth = new Elysia({ name: "require-auth" }).derive(
  async ({ request, set }) => {
    try {
      const sessionData = await auth.api.getSession({
        headers: request.headers,
      });

      if (!sessionData?.user || !sessionData?.session) {
        set.status = 401;
        throw new Error("Authentication required");
      }

      // Check if user is deleted or banned
      if (sessionData.user.deletedAt || sessionData.user.bannedAt) {
        set.status = 403;
        throw new Error("Account is not accessible");
      }

      return {
        user: sessionData.user as User,
        session: sessionData.session as Session,
        isAuthenticated: true as const,
      };
    } catch {
      set.status = 401;
      throw new Error("Invalid or expired session");
    }
  },
);

// ═══════════════════════════════════════════════════════════════════
// API KEY AUTH MIDDLEWARE
// ═══════════════════════════════════════════════════════════════════
export const apiKeyAuth = new Elysia({ name: "api-key-auth" }).derive(
  async ({ headers, set }) => {
    const apiKey = headers["x-api-key"];

    if (!apiKey || typeof apiKey !== "string") {
      set.status = 401;
      throw new Error("API key required");
    }

    // Validate API key format (should start with urlfy_sk_)
    if (!apiKey.startsWith("urlfy_sk_")) {
      set.status = 401;
      throw new Error("Invalid API key format");
    }

    // Hash the API key
    const keyHash = await hashApiKey(apiKey);

    // Query API key
    const [apiKeyResult] = await db
      .select({
        id: apiKeyTable.id,
        name: apiKeyTable.name,
        permissions: apiKeyTable.permissions,
        rateLimit: apiKeyTable.rateLimit,
        userId: apiKeyTable.userId,
      })
      .from(apiKeyTable)
      .where(
        and(
          eq(apiKeyTable.keyHash, keyHash),
          isNull(apiKeyTable.revokedAt),
          apiKeyTable.expiresAt
            ? gt(apiKeyTable.expiresAt, new Date())
            : undefined,
        ),
      )
      .limit(1);

    if (!apiKeyResult) {
      set.status = 401;
      throw new Error("Invalid or revoked API key");
    }

    // Get user
    const [user] = await db
      .select()
      .from(userTable)
      .where(eq(userTable.id, apiKeyResult.userId))
      .limit(1);

    if (!user) {
      set.status = 401;
      throw new Error("User not found");
    }

    // Update last used timestamp asynchronously
    updateApiKeyUsage(apiKeyResult.id).catch(console.error);

    return {
      user: user as User,
      apiKey: {
        id: apiKeyResult.id,
        name: apiKeyResult.name,
        permissions: apiKeyResult.permissions,
        rateLimit: apiKeyResult.rateLimit,
      },
      isAuthenticated: true as const,
    };
  },
);

// ═══════════════════════════════════════════════════════════════════
// ADMIN MIDDLEWARE (requires admin role)
// ═══════════════════════════════════════════════════════════════════
export const requireAdmin = new Elysia({ name: "require-admin" })
  .use(requireAuth)
  .derive(async (context) => {
    // Extract user and session from context (already decorated by requireAuth)
    const { user, session, set } = context as typeof context & {
      user: User;
      session: Session;
      isAuthenticated: true;
    };

    // Check if user has admin role
    if (user.role !== "admin") {
      set.status = 403;
      throw new Error("Admin access required");
    }

    // Check if 2FA is enabled for admin (required)
    const hasTwoFactor = await checkTwoFactorEnabled(user.id);

    if (!hasTwoFactor) {
      set.status = 403;
      throw new Error("Two-factor authentication is required for admin access");
    }

    return {
      user: user as User & { role: "admin" },
      session,
      isAuthenticated: true as const,
      isAdmin: true as const,
    };
  });

// ═══════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════

/**
 * Hash an API key using SHA-256
 */
async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Update API key usage statistics
 */
async function updateApiKeyUsage(keyId: string): Promise<void> {
  // Simple query to increment usage count
  const [current] = await db
    .select({ usageCount: apiKeyTable.usageCount })
    .from(apiKeyTable)
    .where(eq(apiKeyTable.id, keyId))
    .limit(1);

  await db
    .update(apiKeyTable)
    .set({
      lastUsedAt: new Date(),
      usageCount: (current?.usageCount || 0) + 1,
    })
    .where(eq(apiKeyTable.id, keyId));
}

/**
 * Check if user has 2FA enabled and verified
 */
async function checkTwoFactorEnabled(userId: string): Promise<boolean> {
  const result = await db
    .select({ verified: twoFactorTable.verified })
    .from(twoFactorTable)
    .where(eq(twoFactorTable.userId, userId))
    .limit(1);

  return result.length > 0 && result[0].verified;
}
