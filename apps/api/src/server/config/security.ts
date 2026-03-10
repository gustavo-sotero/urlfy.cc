/**
 * Centralized Security Headers Configuration
 * Single source of truth: packages/contracts/src/security-headers.ts
 * This file re-exports from the canonical shared policy package.
 */
export {
  getNextJSHeaders,
  HEADERS_TO_REMOVE,
  SECURITY_HEADERS
} from '@urlfy/contracts';
