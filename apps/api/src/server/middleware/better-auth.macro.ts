/**
 * ═══════════════════════════════════════════════════════════════════
 * BETTER-AUTH MACRO - Elysia macro for session-based authentication
 * ═══════════════════════════════════════════════════════════════════
 *
 * Pattern: Request-dependent service via macro (ElysiaJS recommended)
 * Docs: https://elysiajs.com/integrations/better-auth#macro
 *
 * Usage:
 *   .get('/user', ({ user }) => user, { auth: true })
 *
 * This provides session and user info to routes declaratively.
 *
 * ═══════════════════════════════════════════════════════════════════
 */

import { Elysia } from 'elysia';
import type { Session, User } from '@/lib/auth';
import { auth } from '@/lib/auth';
import { createLogger } from '@/server/lib/telemetry';

const logger = createLogger('better-auth-macro');

// ─── Types ────────────────────────────────────────────────────────

interface AuthMacroOptions {
  /** Whether authentication is required (default: true) */
  required?: boolean;
}

// ─── Better-Auth Macro ─────────────────────────────────────────────

export const betterAuthMacro = new Elysia({ name: 'Macro.BetterAuth' }).macro({
  auth: (options: AuthMacroOptions | boolean = true) => {
    // Normalize options
    const opts: AuthMacroOptions =
      typeof options === 'boolean' ? { required: options } : options;
    const required = opts.required ?? true;

    return {
      async resolve({ status, request: { headers } }) {
        try {
          // Call Better-Auth session API
          const session = await auth.api.getSession({ headers });

          // If no session and auth is required, return 401
          if (!session) {
            if (required) {
              logger.warn('Unauthorized access attempt', {
                path: new URL(headers.get('referer') || '').pathname
              });

              return status(401, {
                success: false,
                error: {
                  code: 'UNAUTHORIZED',
                  message: 'Authentication required'
                }
              });
            }

            // Optional auth - return null user/session
            return {
              user: null as User | null,
              session: null as Session | null
            };
          }

          // Return user and session to route handlers
          return {
            user: session.user as User,
            session: session.session as Session
          };
        } catch (error) {
          logger.error('Better-Auth macro error', {
            error: error instanceof Error ? error.message : String(error)
          });

          // On error, return 500 if required, or null if optional
          if (required) {
            return status(500, {
              success: false,
              error: {
                code: 'AUTH_ERROR',
                message: 'Authentication check failed'
              }
            });
          }

          return {
            user: null as User | null,
            session: null as Session | null
          };
        }
      }
    };
  }
});

// ─── Export Type ──────────────────────────────────────────────────

export type BetterAuthMacro = typeof betterAuthMacro;
