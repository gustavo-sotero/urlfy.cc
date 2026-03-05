/**
 * Shared Elysia plugin configurations
 * JWT, CORS, Bearer token handling
 */

import bearer from '@elysiajs/bearer';
import cors from '@elysiajs/cors';
import jwt from '@elysiajs/jwt';
import { Elysia } from 'elysia';
import { getElysiaCorsConfig } from './cors';

/**
 * JWT Plugin Configuration
 * Used for password-protected link unlock tokens
 */

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;

  // Allow builds to proceed without JWT_SECRET
  // It will be validated at runtime when the server actually starts
  if (!secret && process.env.NEXT_PHASE !== 'phase-production-build') {
    throw new Error(
      'FATAL: JWT_SECRET environment variable is not defined. ' +
        'This is required for secure token generation. ' +
        'Generate a secure secret with: openssl rand -base64 32'
    );
  }

  // Provide a dummy value during build phase only (never used at runtime)
  // This is NOT a secret - it's a build-time marker that gets replaced by env var
  if (!secret) {
    // Build-time only: generate a random placeholder that won't be used
    return `build_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  }

  return secret;
}

// @ts-ignore: TS2742 - jose internal type reference (harmless for Eden Treaty)
export const jwtPlugin = new Elysia({ name: 'jwt' }).use(
  jwt({
    name: 'jwt',
    secret: getJwtSecret()
  })
);

/**
 * CORS Plugin Configuration
 * Uses centralized configuration from @/server/config/cors
 */
export const corsPlugin = new Elysia({ name: 'cors' }).use(
  cors(getElysiaCorsConfig())
);

/**
 * Bearer Token Plugin Configuration
 * Automatically extracts Bearer tokens from Authorization header
 */
export const bearerPlugin = new Elysia({ name: 'bearer' }).use(bearer());
