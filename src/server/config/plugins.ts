/**
 * Shared Elysia plugin configurations
 * JWT, CORS, Bearer token handling
 */

import bearer from '@elysiajs/bearer';
import cors from '@elysiajs/cors';
import jwt from '@elysiajs/jwt';
import { Elysia } from 'elysia';

/**
 * JWT Plugin Configuration
 * Used for password-protected link unlock tokens
 */

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;

  // Enforce the requirement at all times
  if (!secret) {
    throw new Error(
      'FATAL: JWT_SECRET environment variable is not defined. ' +
        'This is required for secure token generation. ' +
        'Generate a secure secret with: openssl rand -base64 32'
    );
  }

  return secret;
}

export const jwtPlugin = new Elysia({ name: 'jwt' }).use(
  jwt({
    name: 'jwt',
    secret: getJwtSecret()
  })
);

/**
 * CORS Plugin Configuration
 * Configures allowed origins based on environment
 */
export const corsPlugin = new Elysia({ name: 'cors' }).use(
  cors({
    origin: (request) => {
      const origin = request.headers.get('origin');
      if (!origin) return true;

      // Development: allow localhost
      if (process.env.NODE_ENV === 'development') {
        if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
          return true;
        }
      }

      // Production: check against allowed origins
      const allowedOrigins = [
        process.env.NEXT_PUBLIC_APP_URL,
        'https://urlfy.cc',
        'https://www.urlfy.cc'
      ].filter(Boolean) as string[];

      // Check TRUSTED_ORIGINS from env (comma-separated)
      const trustedOrigins = process.env.TRUSTED_ORIGINS?.split(',').map((o) =>
        o.trim()
      );
      if (trustedOrigins) {
        allowedOrigins.push(...trustedOrigins);
      }

      return allowedOrigins.includes(origin);
    },
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-API-Key',
      'Idempotency-Key',
      'X-Request-Id'
    ],
    credentials: true,
    maxAge: 86400 // 24 hours
  })
);

/**
 * Bearer Token Plugin Configuration
 * Automatically extracts Bearer tokens from Authorization header
 */
export const bearerPlugin = new Elysia({ name: 'bearer' }).use(bearer());
