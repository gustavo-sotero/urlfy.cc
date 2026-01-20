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

import { beforeAll, describe, test } from 'bun:test';
import {
  createElysiaTestClient,
  type ElysiaTestClient,
  expectUnauthorized
} from '../helpers/elysia-test-client';

describe('Analytics Endpoints (handler-level)', () => {
  let client: ElysiaTestClient;

  beforeAll(async () => {
    // Lazy import to avoid initialization issues when infrastructure isn't running
    const { api } = await import('@/server/api');
    client = createElysiaTestClient(api);
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
