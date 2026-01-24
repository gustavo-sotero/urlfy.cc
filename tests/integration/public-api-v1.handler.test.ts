/**
 * ═════════════════════════════════════════════════════════════════════
 * PUBLIC API V1 - HANDLER-LEVEL TESTS
 * ═════════════════════════════════════════════════════════════════════
 * Tests for public API v1 endpoints using Elysia's app.handle()
 *
 * Note: These tests require infrastructure (Redis, PostgreSQL) to be running.
 * Run with: docker compose -f docker/docker-compose.yml up -d
 * ═════════════════════════════════════════════════════════════════════
 */

import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { and, eq, inArray } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '@/db';
import { apikey, links, user } from '@/db/schema';
import { Scopes } from '@/server/config/scopes';
import { ApiKeysService } from '@/server/modules/api-keys/api-keys.service';
import {
  createElysiaTestClient,
  type ElysiaTestClient
} from '../helpers/elysia-test-client';
import { requireDatabase } from '../helpers/integration-helper';

type ErrorResponse = {
  success: false;
  error: { code: string; message: string };
};

describe('Public API v1 (handler-level)', () => {
  let client: ElysiaTestClient;
  const testUserId = `test-user-${nanoid(8)}`;
  const testEmail = `test-${nanoid(8)}@urlfy.test`;
  const createdKeyIds: string[] = [];
  const createdLinkIds: string[] = [];

  let readKey = '';
  let writeKey = '';
  let quotaKey = '';

  beforeAll(async () => {
    await requireDatabase();

    // Create a user for FK integrity
    await db.insert(user).values({
      id: testUserId,
      name: 'Public API Test User',
      email: testEmail
    });

    const { api } = await import('@/server/api');
    client = createElysiaTestClient(api);

    const readKeyRecord = await ApiKeysService.create(testUserId, {
      name: 'Public API Read Key',
      scopes: [Scopes.LINKS_READ]
    });
    createdKeyIds.push(readKeyRecord.id);
    readKey = readKeyRecord.key;

    const writeKeyRecord = await ApiKeysService.create(testUserId, {
      name: 'Public API Write Key',
      scopes: [Scopes.LINKS_READ, Scopes.LINKS_WRITE]
    });
    createdKeyIds.push(writeKeyRecord.id);
    writeKey = writeKeyRecord.key;

    const quotaKeyRecord = await ApiKeysService.create(testUserId, {
      name: 'Public API Quota Key',
      scopes: [Scopes.LINKS_READ],
      rateLimit: {
        enabled: true,
        max: 1,
        windowMs: 60000
      }
    });
    createdKeyIds.push(quotaKeyRecord.id);
    quotaKey = quotaKeyRecord.key;

    // Exhaust quota for quotaKey
    await db
      .update(apikey)
      .set({ usageCount: 1 })
      .where(eq(apikey.id, quotaKeyRecord.id));
  });

  afterAll(async () => {
    if (createdLinkIds.length > 0) {
      await db.delete(links).where(inArray(links.id, createdLinkIds));
    }

    if (createdKeyIds.length > 0) {
      await db.delete(apikey).where(inArray(apikey.id, createdKeyIds));
    }

    await db
      .delete(user)
      .where(and(eq(user.id, testUserId), eq(user.email, testEmail)));
  });

  test('rejects requests without API key', async () => {
    const response = await client.get<ErrorResponse>('/api/v1/links');

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('MISSING_KEY');
  });

  test('rejects requests with invalid API key', async () => {
    const response = await client
      .withApiKey('urlfy_sk_invalid')
      .get<ErrorResponse>('/api/v1/links');

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('INVALID_KEY');
  });

  test('rejects requests with insufficient scope', async () => {
    const response = await client
      .withApiKey(readKey)
      .post<ErrorResponse>('/api/v1/links/shorten', {
        url: 'https://example.com'
      });

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('SCOPE_DENIED');
  });

  test('creates and reads a link via public API', async () => {
    const createResponse = await client
      .withApiKey(writeKey)
      .post<{ success: true; data: { id: string; shortCode: string } }>(
        '/api/v1/links/shorten',
        { url: 'https://example.com' }
      );

    expect(createResponse.status).toBe(200);
    expect(createResponse.body.success).toBe(true);
    expect(createResponse.body.data.id).toBeTruthy();

    createdLinkIds.push(createResponse.body.data.id);

    const getResponse = await client
      .withApiKey(readKey)
      .get<{ success: true; data: { id: string } }>(
        `/api/v1/links/${createResponse.body.data.id}`
      );

    expect(getResponse.status).toBe(200);
    expect(getResponse.body.success).toBe(true);
    expect(getResponse.body.data.id).toBe(createResponse.body.data.id);
  });

  test('returns quota exceeded when usage is at limit', async () => {
    const response = await client
      .withApiKey(quotaKey)
      .get<ErrorResponse>('/api/v1/links');

    expect(response.status).toBe(429);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('QUOTA_EXCEEDED');
  });
});
