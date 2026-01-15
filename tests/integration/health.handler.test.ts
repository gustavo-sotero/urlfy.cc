/**
 * ═════════════════════════════════════════════════════════════════════
 * HEALTH ENDPOINTS - HANDLER-LEVEL TESTS
 * ═════════════════════════════════════════════════════════════════════
 * Tests for health check endpoints using Elysia's app.handle()
 *
 * Note: These tests require infrastructure (Redis, PostgreSQL) to be running.
 * Run with: docker compose -f docker/docker-compose.yml up -d
 * ═════════════════════════════════════════════════════════════════════
 */

import { beforeAll, describe, expect, test } from 'bun:test';
import {
  createElysiaTestClient,
  type ElysiaTestClient,
  expectOk
} from '../helpers/elysia-test-client';

describe('Health Endpoints (handler-level)', () => {
  let client: ElysiaTestClient;

  beforeAll(async () => {
    // Lazy import to avoid initialization issues when infrastructure isn't running
    const { api } = await import('@/server/api');
    client = createElysiaTestClient(api);
  });

  describe('GET /api/health', () => {
    test('should return ok status', async () => {
      const response = await client.get<{
        status: string;
        timestamp: string;
      }>('/api/health');

      expectOk(response);
      expect(response.body.status).toBe('ok');
      expect(response.body.timestamp).toBeDefined();
      expect(new Date(response.body.timestamp).getTime()).not.toBeNaN();
    });
  });

  describe('GET /api/health/ready', () => {
    test('should return readiness status with services', async () => {
      const response = await client.get<{
        status: string;
        services: {
          database: string;
          redis: string;
        };
      }>('/api/health/ready');

      // Status can be 'ready' or 'not_ready' depending on services
      expect(['ready', 'not_ready']).toContain(response.body.status);
      expect(response.body.services).toBeDefined();
      expect(response.body.services.database).toBeDefined();
      expect(response.body.services.redis).toBeDefined();
    });
  });
});
