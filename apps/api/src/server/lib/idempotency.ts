// src/server/lib/idempotency.ts

import {
  canAttemptRedisCommand,
  getRedisClient,
  markRedisCommandFailure,
  markRedisCommandSuccess,
  shouldLogRedisFailure
} from '@urlfy/cache';
import { createLogger } from './telemetry';

const logger = createLogger('idempotency');
const TTL = 86400; // 24 hours
const LOCK_TTL_SECONDS = 30;

type IdempotencyRedisClient = Pick<
  ReturnType<typeof getRedisClient>,
  'get' | 'set' | 'del' | 'send'
>;

interface IdempotencyRuntime {
  canAttemptRedisCommand: typeof canAttemptRedisCommand;
  getRedisClient: () => IdempotencyRedisClient;
  markRedisCommandFailure: typeof markRedisCommandFailure;
  markRedisCommandSuccess: typeof markRedisCommandSuccess;
  shouldLogRedisFailure: typeof shouldLogRedisFailure;
}

const defaultIdempotencyRuntime: IdempotencyRuntime = {
  canAttemptRedisCommand,
  getRedisClient: () => getRedisClient() as IdempotencyRedisClient,
  markRedisCommandFailure,
  markRedisCommandSuccess,
  shouldLogRedisFailure
};

function getIdempotencyRuntime(): IdempotencyRuntime {
  return (
    (globalThis as { __IDEMPOTENCY_RUNTIME__?: IdempotencyRuntime })
      .__IDEMPOTENCY_RUNTIME__ ?? defaultIdempotencyRuntime
  );
}

/**
 * Persisted record shape.  Stored as JSON so future fields can be added
 * without breaking existing Redis entries.  Legacy entries (plain string)
 * are up-cast automatically in `checkIdempotency`.
 */
interface IdempotencyRecord {
  resourceId: string;
  /** SHA-256 hex of the canonical request payload. Absent in legacy entries. */
  payloadHash?: string;
}

/**
 * Build a scoped idempotency cache key.
 * Format: `idempotency:{principal}:{route}:{key}`
 *
 * @param key       - Caller-supplied idempotency key
 * @param principal - User ID, API key ID, or 'guest:<guestId>'
 * @param route     - Logical route identifier (e.g. 'POST /links')
 */
function buildScopedKey(key: string, principal: string, route: string): string {
  return `idempotency:${principal}:${route}:${key}`;
}

function buildLockKey(key: string, principal: string, route: string): string {
  return `idempotency:lock:${principal}:${route}:${key}`;
}

/**
 * Compute a deterministic SHA-256 fingerprint for an arbitrary payload object.
 * Keys are sorted to guarantee stability regardless of insertion order.
 */
export async function computePayloadHash(
  payload: Record<string, unknown>
): Promise<string> {
  const canonical = JSON.stringify(
    Object.fromEntries(
      Object.entries(payload)
        .filter(([, v]) => v !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
    )
  );
  const buffer = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(canonical)
  );
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Result returned by `checkIdempotency`.
 *
 * - `{ status: 'hit', resourceId }` — duplicate replay: return cached resource.
 * - `{ status: 'conflict' }` — key reused with a *different* payload (RFC draft §7.2).
 * - `{ status: 'miss' }` — key not seen before; continue processing.
 */
export type IdempotencyCheckResult =
  | { status: 'hit'; resourceId: string }
  | { status: 'conflict' }
  | { status: 'in_progress' }
  | { status: 'miss' };

/**
 * Check whether an idempotency key was already processed.
 *
 * When `currentPayloadHash` is provided the stored hash is compared to detect
 * key-reuse with a different payload (422 Unprocessable Entity semantics per
 * the IETF Idempotency-Key draft).
 *
 * @param key                - Caller-supplied idempotency key
 * @param principal          - User ID, API key ID, or `guest:<guestId>`
 * @param route              - Logical route identifier
 * @param currentPayloadHash - SHA-256 of the current request body (optional)
 */
export async function checkIdempotency(
  key: string,
  principal: string,
  route: string,
  currentPayloadHash?: string
): Promise<IdempotencyCheckResult> {
  const runtime = getIdempotencyRuntime();

  if (!runtime.canAttemptRedisCommand()) {
    return { status: 'miss' };
  }

  try {
    const redis = runtime.getRedisClient();
    const raw = await redis.get(buildScopedKey(key, principal, route));

    if (!raw) {
      const pendingPayloadHash = await redis.get(
        buildLockKey(key, principal, route)
      );

      runtime.markRedisCommandSuccess();

      if (!pendingPayloadHash) {
        return { status: 'miss' };
      }

      if (
        currentPayloadHash &&
        pendingPayloadHash !== 'pending' &&
        pendingPayloadHash !== currentPayloadHash
      ) {
        return { status: 'conflict' };
      }

      return { status: 'in_progress' };
    }

    runtime.markRedisCommandSuccess();

    // Parse stored value — handle both legacy plain-string and JSON formats
    let record: IdempotencyRecord;
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (
        typeof parsed === 'object' &&
        parsed !== null &&
        typeof (parsed as IdempotencyRecord).resourceId === 'string'
      ) {
        record = parsed as IdempotencyRecord;
      } else {
        // Legacy entry stored as JSON but in an unexpected shape
        record = { resourceId: String(parsed) };
      }
    } catch {
      // Legacy entry stored as a plain string (pre-fingerprint)
      record = { resourceId: raw };
    }

    // Payload fingerprint check — only when both sides supply a hash.
    // If the stored record has no hash (legacy), we cannot compare and
    // treat it as a plain replay (backward-compatible).
    if (
      currentPayloadHash &&
      record.payloadHash &&
      record.payloadHash !== currentPayloadHash
    ) {
      logger.warn('Idempotency key reused with different payload', {
        principal,
        route,
        key: `${key.slice(0, 8)}...`
      });
      return { status: 'conflict' };
    }

    return { status: 'hit', resourceId: record.resourceId };
  } catch (error) {
    runtime.markRedisCommandFailure(error);
    if (runtime.shouldLogRedisFailure()) {
      logger.warn('Redis unavailable for idempotency check', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
    return { status: 'miss' };
  }
}

/**
 * Acquire a short-lived lock while the first request with an idempotency key
 * is still being processed.
 */
export async function acquireIdempotencyLock(
  key: string,
  principal: string,
  route: string,
  payloadHash?: string
): Promise<boolean> {
  const runtime = getIdempotencyRuntime();

  if (!runtime.canAttemptRedisCommand()) {
    return true;
  }

  try {
    const redis = runtime.getRedisClient();
    const response = await redis.send('SET', [
      buildLockKey(key, principal, route),
      payloadHash ?? 'pending',
      'NX',
      'EX',
      String(LOCK_TTL_SECONDS)
    ]);
    runtime.markRedisCommandSuccess();
    return response === 'OK';
  } catch (error) {
    runtime.markRedisCommandFailure(error);
    if (runtime.shouldLogRedisFailure()) {
      logger.warn('Failed to acquire idempotency lock', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
    return true;
  }
}

export async function releaseIdempotencyLock(
  key: string,
  principal: string,
  route: string
): Promise<void> {
  const runtime = getIdempotencyRuntime();

  if (!runtime.canAttemptRedisCommand()) {
    return;
  }

  try {
    const redis = runtime.getRedisClient();
    await redis.del(buildLockKey(key, principal, route));
    runtime.markRedisCommandSuccess();
  } catch (error) {
    runtime.markRedisCommandFailure(error);
    if (runtime.shouldLogRedisFailure()) {
      logger.warn('Failed to release idempotency lock', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
}

/**
 * Store the result of an idempotent operation, including the payload fingerprint.
 *
 * @param key            - Idempotency key
 * @param resourceId     - Created resource ID
 * @param principal      - User ID, API key ID, or `guest:<guestId>`
 * @param route          - Logical route identifier
 * @param payloadHash    - SHA-256 of the request body (optional but recommended)
 */
export async function setIdempotency(
  key: string,
  resourceId: string,
  principal: string,
  route: string,
  payloadHash?: string
): Promise<void> {
  const runtime = getIdempotencyRuntime();

  if (!runtime.canAttemptRedisCommand()) {
    return;
  }

  try {
    const redis = runtime.getRedisClient();
    const record: IdempotencyRecord = {
      resourceId,
      ...(payloadHash && { payloadHash })
    };
    await redis.set(
      buildScopedKey(key, principal, route),
      JSON.stringify(record),
      'EX',
      TTL
    );
    runtime.markRedisCommandSuccess();
  } catch (error) {
    runtime.markRedisCommandFailure(error);
    if (runtime.shouldLogRedisFailure()) {
      logger.warn('Failed to set idempotency key', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
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
