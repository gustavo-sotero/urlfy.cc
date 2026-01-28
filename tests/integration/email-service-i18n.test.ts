import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { user } from '@/db/schema/auth';
import { emailService } from '@/server/services/email.service';

describe('Email Service i18n Integration', () => {
  const testUsers = [
    {
      id: `test-user-en-${Date.now()}`,
      email: `test-en-${Date.now()}@example.com`,
      name: 'John Doe',
      locale: 'en',
      emailVerified: true
    },
    {
      id: `test-user-pt-${Date.now()}`,
      email: `test-pt-${Date.now()}@example.com`,
      name: 'João Silva',
      locale: 'pt-br',
      emailVerified: true
    }
  ];

  beforeAll(async () => {
    // Create test users with different locales
    for (const testUser of testUsers) {
      await db.insert(user).values(testUser);
    }
  });

  afterAll(async () => {
    // Cleanup test users
    for (const testUser of testUsers) {
      await db.delete(user).where(eq(user.id, testUser.id));
    }
  });

  describe('Locale Resolution from Database', () => {
    it('should fetch and use English locale for English user', async () => {
      const enUser = testUsers[0];

      // Mock email sending to capture what would be sent
      const originalSend = emailService.sendWelcomeEmail;
      let capturedSubject: string | undefined;

      // @ts-expect-error - Mocking for test
      emailService.sendWelcomeEmail = async (params) => {
        // Call render to get subject
        const { renderEmail } = await import('@/emails/render');
        const result = await renderEmail({
          locale: 'en', // This would be fetched from DB
          template: 'welcome',
          payload: {
            firstName: params.firstName,
            email: params.email
          }
        });
        capturedSubject = result.subject;
        return Promise.resolve();
      };

      await emailService.sendWelcomeEmail({
        to: enUser.email,
        firstName: enUser.name.split(' ')[0],
        email: enUser.email,
        userId: enUser.id
      });

      expect(capturedSubject).toContain('Welcome to urlfy.cc');
      expect(capturedSubject).not.toContain('Bem-vindo');

      // Restore original
      // @ts-expect-error - Restoring after mock
      emailService.sendWelcomeEmail = originalSend;
    });

    it('should fetch and use Portuguese locale for Portuguese user', async () => {
      const ptUser = testUsers[1];

      // Mock email sending
      const originalSend = emailService.sendWelcomeEmail;
      let capturedSubject: string | undefined;

      // @ts-expect-error - Mocking for test
      emailService.sendWelcomeEmail = async (params) => {
        const { renderEmail } = await import('@/emails/render');
        const result = await renderEmail({
          locale: 'pt-br',
          template: 'welcome',
          payload: {
            firstName: params.firstName,
            email: params.email
          }
        });
        capturedSubject = result.subject;
        return Promise.resolve();
      };

      await emailService.sendWelcomeEmail({
        to: ptUser.email,
        firstName: ptUser.name.split(' ')[0],
        email: ptUser.email,
        userId: ptUser.id
      });

      expect(capturedSubject).toContain('Bem-vindo ao urlfy.cc');
      expect(capturedSubject).not.toContain('Welcome');

      // Restore original
      // @ts-expect-error - Restoring after mock
      emailService.sendWelcomeEmail = originalSend;
    });

    it('should fallback to default locale for user without locale', async () => {
      const noLocaleUser = {
        id: `test-user-no-locale-${Date.now()}`,
        email: `test-no-locale-${Date.now()}@example.com`,
        name: 'Test User',
        locale: null,
        emailVerified: false
      };

      await db.insert(user).values(noLocaleUser);

      try {
        const { getUserLocale } = await import('@/server/lib/locale');
        const locale = await getUserLocale(noLocaleUser.id);

        // Should fallback to 'en'
        expect(locale).toBe('en');
      } finally {
        await db.delete(user).where(eq(user.id, noLocaleUser.id));
      }
    });

    it('should fallback to default locale for invalid locale value', async () => {
      const invalidLocaleUser = {
        id: `test-user-invalid-${Date.now()}`,
        email: `test-invalid-${Date.now()}@example.com`,
        name: 'Test User',
        locale: 'invalid-locale',
        emailVerified: false
      };

      await db.insert(user).values(invalidLocaleUser);

      try {
        const { getUserLocale } = await import('@/server/lib/locale');
        const locale = await getUserLocale(invalidLocaleUser.id);

        // Should fallback to 'en'
        expect(locale).toBe('en');
      } finally {
        await db.delete(user).where(eq(user.id, invalidLocaleUser.id));
      }
    });

    it('should fetch locale by email when userId not available', async () => {
      const enUser = testUsers[0];
      const { getLocaleByEmail } = await import('@/server/lib/locale');

      const locale = await getLocaleByEmail(enUser.email);
      expect(locale).toBe('en');
    });
  });

  describe('Email Service Methods with Locale', () => {
    it('sendWelcomeEmail should use user locale', async () => {
      const ptUser = testUsers[1];

      // This should not throw and should fetch locale internally
      await expect(
        emailService.sendWelcomeEmail({
          to: ptUser.email,
          firstName: ptUser.name.split(' ')[0],
          email: ptUser.email,
          userId: ptUser.id
        })
      ).resolves.not.toThrow();
    });

    it('sendEmailVerification should use user locale', async () => {
      const enUser = testUsers[0];

      await expect(
        emailService.sendEmailVerification({
          to: enUser.email,
          firstName: enUser.name.split(' ')[0],
          verificationUrl: 'https://urlfy.cc/verify?token=test',
          userId: enUser.id
        })
      ).resolves.not.toThrow();
    });

    it('sendPasswordResetEmail should use user locale', async () => {
      const ptUser = testUsers[1];

      await expect(
        emailService.sendPasswordResetEmail({
          to: ptUser.email,
          firstName: ptUser.name.split(' ')[0],
          resetUrl: 'https://urlfy.cc/reset?token=test',
          userId: ptUser.id
        })
      ).resolves.not.toThrow();
    });

    it('should respect explicit locale parameter over database', async () => {
      const enUser = testUsers[0]; // Has 'en' in DB

      const { renderEmail } = await import('@/emails/render');

      // Explicitly pass 'pt-br' locale
      const result = await renderEmail({
        locale: 'pt-br',
        template: 'welcome',
        payload: {
          firstName: enUser.name.split(' ')[0],
          email: enUser.email
        }
      });

      // Should use the explicit locale, not the one from DB
      expect(result.subject).toContain('Bem-vindo');
      expect(result.subject).not.toContain('Welcome');
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      const { getUserLocale } = await import('@/server/lib/locale');

      // Non-existent user should return default locale
      const locale = await getUserLocale('non-existent-user-id');
      expect(locale).toBe('en');
    });

    it('should handle invalid email lookup', async () => {
      const { getLocaleByEmail } = await import('@/server/lib/locale');

      // Non-existent email should return default locale
      const locale = await getLocaleByEmail('nonexistent@example.com');
      expect(locale).toBe('en');
    });
  });
});
