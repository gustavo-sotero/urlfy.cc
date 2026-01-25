/**
 * Integration Tests: Email Verification Enforcement
 * Tests that unverified users can log in but cannot create links
 */

import { beforeAll, describe, expect, test } from 'bun:test';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { user as userTable } from '@/db/schema/auth';
import { links } from '@/db/schema/links';
import { api } from '@/server/api';
import { createElysiaTestClient } from '../helpers/elysia-test-client';
import { isDatabaseAvailable } from '../helpers/integration-helper';

// Initialize test client
const client = createElysiaTestClient(api);

function createTestUrl(path: string): string {
  const nonce = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `https://test-${nonce}.com/${path}`;
}

describe('Email Verification Enforcement', () => {
  let testUser: { id: string; email: string };
  let verifiedUser: { id: string; email: string };
  let databaseAvailable = false;

  beforeAll(async () => {
    databaseAvailable = await isDatabaseAvailable();
    if (!databaseAvailable) {
      console.warn(
        '⚠️  Database not available. Skipping email verification tests.'
      );
      return;
    }

    // Note: In production, these users would be created via Better-Auth
    // For testing, we need to provide all required fields including 'id'

    // Create unverified test user
    const unverifiedEmail = `unverified-${Date.now()}@test.com`;
    const unverifiedUserId = `test-unverified-${Date.now()}`;
    const [createdUnverified] = await db
      .insert(userTable)
      .values({
        id: unverifiedUserId,
        email: unverifiedEmail,
        name: 'Unverified User',
        emailVerified: false
      })
      .returning({ id: userTable.id, email: userTable.email });

    testUser = createdUnverified;

    // Create verified test user
    const verifiedEmail = `verified-${Date.now()}@test.com`;
    const verifiedUserId = `test-verified-${Date.now()}`;
    const [createdVerified] = await db
      .insert(userTable)
      .values({
        id: verifiedUserId,
        email: verifiedEmail,
        name: 'Verified User',
        emailVerified: true
      })
      .returning({ id: userTable.id, email: userTable.email });

    verifiedUser = createdVerified;
  });

  describe('POST /api/links (unverified user)', () => {
    test('should reject link creation from unverified user', async () => {
      if (!databaseAvailable) return;
      const response = await client.post<{
        success: boolean;
        error?: { code: string; message: string };
      }>(
        '/api/links',
        {
          url: createTestUrl('unverified-test')
        },
        {
          headers: {
            // Mock authenticated but unverified user
            'x-test-user-id': testUser.id,
            'x-test-email-verified': 'false'
          }
        }
      );

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.error?.code).toBe('EMAIL_VERIFICATION_REQUIRED');
      expect(response.body.error?.message).toContain('verificar seu e-mail');
    });

    test('should allow link creation from verified user', async () => {
      if (!databaseAvailable) return;
      const response = await client.post<{
        success: boolean;
        data?: { id: string; shortCode: string };
        error?: { code?: string };
      }>(
        '/api/links',
        {
          url: createTestUrl('verified-test')
        },
        {
          headers: {
            'x-test-user-id': verifiedUser.id,
            'x-test-email-verified': 'true'
          }
        }
      );

      if (response.status === 422) {
        expect(response.body.error?.code).not.toBe(
          'EMAIL_VERIFICATION_REQUIRED'
        );
        return;
      }

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data?.shortCode).toBeDefined();

      // Cleanup
      if (response.body.data?.id) {
        await db.delete(links).where(eq(links.id, response.body.data.id));
      }
    });
  });

  describe('POST /api/links/bulk (unverified user)', () => {
    test('should reject bulk creation from unverified user', async () => {
      if (!databaseAvailable) return;
      const response = await client.post<{
        success: boolean;
        error?: { code: string; message: string };
      }>(
        '/api/links/bulk',
        {
          links: [
            { url: createTestUrl('bulk-1') },
            { url: createTestUrl('bulk-2') }
          ]
        },
        {
          headers: {
            'x-test-user-id': testUser.id,
            'x-test-email-verified': 'false'
          }
        }
      );

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.error?.code).toBe('EMAIL_VERIFICATION_REQUIRED');
    });

    test('should allow bulk creation from verified user', async () => {
      if (!databaseAvailable) return;
      const response = await client.post<{
        success: boolean;
        data?: { created: number; links: Array<{ id: string }> };
        error?: { code?: string };
      }>(
        '/api/links/bulk',
        {
          links: [
            { url: createTestUrl('bulk-verified-1') },
            { url: createTestUrl('bulk-verified-2') }
          ]
        },
        {
          headers: {
            'x-test-user-id': verifiedUser.id,
            'x-test-email-verified': 'true'
          }
        }
      );

      if (response.status === 422) {
        expect(response.body.error?.code).not.toBe(
          'EMAIL_VERIFICATION_REQUIRED'
        );
        return;
      }

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data?.created).toBe(2);

      // Cleanup
      if (response.body.data?.links) {
        const linkIds = response.body.data.links.map((link) => link.id);
        await db.delete(links).where(eq(links.id, linkIds[0]));
        await db.delete(links).where(eq(links.id, linkIds[1]));
      }
    });
  });

  describe('Guest users (no authentication)', () => {
    test('should allow guest link creation without email verification check', async () => {
      if (!databaseAvailable) return;
      const response = await client.post<{
        success: boolean;
        data?: { shortCode: string };
        error?: { code?: string };
      }>('/api/links', {
        url: createTestUrl('guest-test')
      });

      // Guest users should be allowed
      if (response.status === 422) {
        expect(response.body.error?.code).not.toBe(
          'EMAIL_VERIFICATION_REQUIRED'
        );
        return;
      }

      expect(response.status).toBeLessThan(400);

      // Note: May fail validation for other reasons, but should not fail on email verification
      if (response.body.success === false) {
        expect(
          (response.body as { error?: { code: string } }).error?.code
        ).not.toBe('EMAIL_VERIFICATION_REQUIRED');
      }
    });
  });
});
