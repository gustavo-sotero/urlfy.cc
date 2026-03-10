/**
 * Rate Limit Configuration
 * Single source of truth: packages/contracts/src/rate-limit-policy.ts
 * This file re-exports from the canonical shared registry.
 */
export type { RateLimitEntry, RateLimitKey } from '@urlfy/contracts';
export { getRateLimit, RATE_LIMITS } from '@urlfy/contracts';
