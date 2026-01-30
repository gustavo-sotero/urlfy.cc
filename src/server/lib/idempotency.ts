// src/server/lib/idempotency.ts

import { redis } from './redis';
import { createLogger } from './telemetry';

const logger = createLogger('idempotency');
const TTL = 86400; // 24 hours

/**
 * Check whether an idempotency key was already processed
 * @param key - Idempotency key
 * @returns Previously created resource ID or null
 */
export async function checkIdempotency(key: string): Promise<string | null> {
  try {
    return await redis.get(`idempotency:${key}`);
  } catch (error) {
    logger.warn('Redis unavailable for idempotency check', {
      error: error instanceof Error ? error.message : String(error)
    });
    return null;
  }
}

/**
 * Store result of an idempotent operation
 * @param key - Idempotency key
 * @param resourceId - Created resource ID
 */
export async function setIdempotency(
  key: string,
  resourceId: string
): Promise<void> {
  try {
    await redis.set(`idempotency:${key}`, resourceId, 'EX', TTL);
  } catch (error) {
    logger.warn('Failed to set idempotency key', {
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

/**
 * Validate idempotency key format
 * Must be a UUID or a 16-64 character alphanumeric string
 * @param key - Key to validate
 * @returns true if valid
 */
export function validateIdempotencyKey(key: string): boolean {
  // UUID format or a 16-64 character alphanumeric string
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const alphanumericRegex = /^[a-zA-Z0-9_-]{16,64}$/;

  return uuidRegex.test(key) || alphanumericRegex.test(key);
}
