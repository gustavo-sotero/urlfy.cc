/**
 * CORS Configuration
 * Single source of truth: packages/contracts/src/cors-policy.ts
 * This file re-exports from the canonical shared policy package.
 */
export {
  ALLOWED_HEADERS,
  ALLOWED_METHODS,
  assertCorsConfigSafe,
  EXPOSED_HEADERS,
  getAllowedOrigins,
  getCorsHeaders,
  getElysiaCorsConfig,
  isOriginAllowed,
  MAX_AGE
} from '@urlfy/contracts';
