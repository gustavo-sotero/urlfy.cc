/**
 * ═════════════════════════════════════════════════════════════════════
 * AUTH ENDPOINTS - HANDLER-LEVEL TESTS
 * ═════════════════════════════════════════════════════════════════════
 * Tests for authentication endpoints using Elysia's app.handle()
 *
 * Note: These tests require infrastructure (Redis, PostgreSQL) to be running.
 * Run with: docker compose -f docker/docker-compose.yml up -d
 * ═════════════════════════════════════════════════════════════════════
 */

import { beforeAll, describe, expect, test } from 'bun:test';
import {
  createElysiaTestClient,
  type ElysiaTestClient,
  expectOk,
  expectUnauthorized
} from '../helpers/elysia-test-client';

describe('Auth Endpoints (handler-level)', () => {
  let client: ElysiaTestClient;

  beforeAll(async () => {
    // Lazy import to avoid initialization issues when infrastructure isn't running
    const { api } = await import('@/server/api');
    client = createElysiaTestClient(api);
  });

  describe('GET /api/auth/session', () => {
    test('should return null user when not authenticated', async () => {
      const response = await client.get<{
        success: boolean;
        data: {
          user: null | object;
          session: null | object;
        };
      }>('/api/auth/session');

      expectOk(response);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user).toBeNull();
      expect(response.body.data.session).toBeNull();
    });
  });

  describe('GET /api/auth/two-factor/status', () => {
    test('should require authentication', async () => {
      const response = await client.get<{
        success: boolean;
        error?: { code: string };
      }>('/api/auth/two-factor/status');

      expectUnauthorized(response);
    });
  });

  describe('GET /api/auth/sessions', () => {
    test('should require authentication', async () => {
      const response = await client.get<{
        success: boolean;
        error?: { code: string };
      }>('/api/auth/sessions');

      expectUnauthorized(response);
    });
  });

  describe('DELETE /api/auth/sessions/:sessionId', () => {
    test('should require authentication', async () => {
      const response = await client.delete<{
        success: boolean;
        error?: { code: string };
      }>('/api/auth/sessions/some-session-id');

      expectUnauthorized(response);
    });
  });

  describe('POST /api/auth/sessions/revoke-all', () => {
    test('should require authentication', async () => {
      const response = await client.post<{
        success: boolean;
        error?: { code: string };
      }>('/api/auth/sessions/revoke-all');

      expectUnauthorized(response);
    });
  });
});
