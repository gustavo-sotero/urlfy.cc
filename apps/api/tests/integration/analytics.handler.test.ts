/**
 * ═════════════════════════════════════════════════════════════════════
 * ANALYTICS ENDPOINTS - HANDLER-LEVEL TESTS
 * ═════════════════════════════════════════════════════════════════════
 * Tests for analytics endpoints using Elysia's app.handle()
 *
 * Note: These tests require infrastructure (Redis, PostgreSQL) to be running.
 * Run with: docker compose -f docker/docker-compose.yml up -d
 * ═════════════════════════════════════════════════════════════════════
 */

import { afterAll, beforeAll, describe, test } from 'bun:test';
import { Elysia } from 'elysia';
import {
  createElysiaTestClient,
  type ElysiaTestClient,
  expectUnauthorized
} from '../helpers/elysia-test-client';

describe('Analytics Endpoints (handler-level)', () => {
  let client: ElysiaTestClient;

  beforeAll(async () => {
    const [{ ResponseModels }, { createAnalyticsController }] =
      await Promise.all([
        import('../../src/server/lib/response.schema'),
        import(
          `../../src/server/modules/analytics/analytics.controller?handler=${Date.now()}`
        )
      ]);

    const requireAuthMock = new Elysia({
      name: 'require-auth.analytics-handler.mock'
    })
      .onBeforeHandle({ as: 'scoped' }, ({ request, set }) => {
        const requestId =
          request.headers.get('x-request-id') ||
          `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

        set.status = 401;
        set.headers['x-request-id'] = requestId;

        return {
          success: false as const,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
            requestId
          }
        };
      })
      .as('scoped');

    const app = new Elysia({ prefix: '/api' })
      .use(ResponseModels)
      .use(createAnalyticsController(requireAuthMock));

    client = createElysiaTestClient(app);
  });

  afterAll(() => {
    // No shared module mocks to restore in this file.
  });

  describe('GET /api/analytics/:linkId/summary', () => {
    test('should require authentication', async () => {
      const response = await client.get<{
        success: boolean;
        error?: { code: string };
      }>('/api/analytics/00000000-0000-0000-0000-000000000000/summary');

      expectUnauthorized(response);
    });
  });

  describe('GET /api/analytics/:linkId/breakdown', () => {
    test('should require authentication', async () => {
      const response = await client.get<{
        success: boolean;
        error?: { code: string };
      }>('/api/analytics/00000000-0000-0000-0000-000000000000/breakdown');

      expectUnauthorized(response);
    });
  });

  describe('GET /api/analytics/:linkId/timeseries', () => {
    test('should require authentication', async () => {
      const response = await client.get<{
        success: boolean;
        error?: { code: string };
      }>('/api/analytics/00000000-0000-0000-0000-000000000000/timeseries');

      expectUnauthorized(response);
    });
  });

  describe('GET /api/analytics/:linkId/daily', () => {
    test('should require authentication', async () => {
      const response = await client.get<{
        success: boolean;
        error?: { code: string };
      }>('/api/analytics/00000000-0000-0000-0000-000000000000/daily');

      expectUnauthorized(response);
    });
  });

  describe('GET /api/analytics/:linkId/countries', () => {
    test('should require authentication', async () => {
      const response = await client.get<{
        success: boolean;
        error?: { code: string };
      }>('/api/analytics/00000000-0000-0000-0000-000000000000/countries');

      expectUnauthorized(response);
    });
  });

  describe('GET /api/analytics/:linkId/devices', () => {
    test('should require authentication', async () => {
      const response = await client.get<{
        success: boolean;
        error?: { code: string };
      }>('/api/analytics/00000000-0000-0000-0000-000000000000/devices');

      expectUnauthorized(response);
    });
  });

  describe('GET /api/analytics/:linkId/browsers', () => {
    test('should require authentication', async () => {
      const response = await client.get<{
        success: boolean;
        error?: { code: string };
      }>('/api/analytics/00000000-0000-0000-0000-000000000000/browsers');

      expectUnauthorized(response);
    });
  });
});
