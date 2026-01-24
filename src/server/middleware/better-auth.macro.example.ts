// @ts-nocheck - Example file demonstrating macro usage patterns
/**
 * ═══════════════════════════════════════════════════════════════════
 * BETTER-AUTH MACRO - Example Usage
 * ═══════════════════════════════════════════════════════════════════
 *
 * This file demonstrates how to use the betterAuthMacro in controllers
 * following ElysiaJS recommended patterns for Better-Auth integration.
 *
 * NOTE: TypeScript checks are disabled for this example file as Elysia's
 * macro type inference can be complex. In real code, types will work.
 *
 * ═══════════════════════════════════════════════════════════════════
 */

import { Elysia, t } from 'elysia';
import { betterAuthMacro } from '@/server/middleware/better-auth.macro';

// ─── Example 1: Protected Routes (Required Auth) ──────────────────

const protectedRoutes = new Elysia({ prefix: '/api/protected' })
  .use(betterAuthMacro)

  .get(
    '/profile',
    ({ user, session }) => {
      // ✅ With auth: true, user and session are guaranteed non-null
      return {
        success: true,
        data: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          sessionId: session.id
        }
      };
    },
    { auth: true }
  )

  .post(
    '/update-settings',
    ({ user }) => {
      console.log(`User ${user.id} updating settings`);
      return { success: true, data: { updated: true } };
    },
    {
      auth: true,
      body: t.Object({
        theme: t.Union([t.Literal('light'), t.Literal('dark')]),
        notifications: t.Boolean()
      })
    }
  );

// ─── Example 2: Optional Auth ──────────────────────────────────────

const publicRoutes = new Elysia({ prefix: '/api/public' })
  .use(betterAuthMacro)

  .get(
    '/feed',
    ({ user }) => {
      if (user) {
        return {
          success: true,
          data: {
            personalized: true,
            userId: user.id,
            feed: ['item1', 'item2']
          }
        };
      }

      return {
        success: true,
        data: {
          personalized: false,
          feed: ['public-item1', 'public-item2']
        }
      };
    },
    { auth: false }
  );

// ─── Example 3: Mixed Controller ───────────────────────────────────

const mixedController = new Elysia({ prefix: '/api/mixed' })
  .use(betterAuthMacro)

  .get('/stats', () => ({ stats: 'public' }), { auth: false })

  .get(
    '/admin-stats',
    ({ user }) => {
      if (user.role !== 'admin') {
        return {
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Admin access required'
          }
        };
      }
      return { success: true, data: { stats: 'admin-only' } };
    },
    { auth: true }
  );

// ─── Example 4: Session Data ───────────────────────────────────────

const sessionRoutes = new Elysia({ prefix: '/api/session' })
  .use(betterAuthMacro)

  .get(
    '/info',
    ({ user, session }) => ({
      success: true,
      data: {
        userId: user.id,
        sessionId: session.id,
        expiresAt: session.expiresAt,
        ipAddress: session.ipAddress
      }
    }),
    { auth: true }
  );

// ─── Example 5: Role-Based Access ──────────────────────────────────

const adminRoutes = new Elysia({ prefix: '/api/admin' })
  .use(betterAuthMacro)

  .get(
    '/users',
    ({ user }) => {
      const isAdmin = user.role === 'admin';

      if (!isAdmin) {
        return {
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Admin access required'
          }
        };
      }

      return {
        success: true,
        data: { users: [] }
      };
    },
    { auth: true }
  );

// ─── Export Examples ────────────────────────────────────────────────

export const exampleApp = new Elysia()
  .use(protectedRoutes)
  .use(publicRoutes)
  .use(mixedController)
  .use(sessionRoutes)
  .use(adminRoutes);

/* ═══════════════════════════════════════════════════════════════════
   MIGRATION GUIDE
   ═══════════════════════════════════════════════════════════════════

OLD PATTERN (middleware):
────────────────────────────────────────────────────────────────────
import { requireAuth } from '@/server/middleware/auth.middleware';

const controller = new Elysia()
  .use(requireAuth())  // Applied to ALL routes
  .get('/route', ({ user }) => user);


NEW PATTERN (macro - RECOMMENDED):
────────────────────────────────────────────────────────────────────
import { betterAuthMacro } from '@/server/middleware/better-auth.macro';

const controller = new Elysia()
  .use(betterAuthMacro)
  .get('/route', ({ user }) => user, { auth: true });  // Per-route
  //                                   ^^^^^^^^^^^^^^
  //                                   Declarative!


BENEFITS:
  ✅ Declarative (per-route control)
  ✅ Better TypeScript inference
  ✅ Follows ElysiaJS official pattern
  ✅ No middleware stacking issues
  ✅ Clearer in OpenAPI/Swagger docs

═══════════════════════════════════════════════════════════════════ */
