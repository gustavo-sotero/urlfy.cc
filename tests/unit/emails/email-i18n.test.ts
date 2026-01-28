import { describe, expect, it } from 'bun:test';
import { renderEmail } from '@/emails/render';
import type {
  AppLocale,
  EmailVerificationPayload,
  PasswordResetPayload,
  WelcomeEmailPayload
} from '@/emails/types';

describe('Email i18n Rendering', () => {
  describe('Welcome Email', () => {
    it('should render in English', async () => {
      const result = await renderEmail({
        locale: 'en',
        template: 'welcome',
        payload: {
          firstName: 'John',
          email: 'john@example.com'
        }
      });

      expect(result.subject).toContain('Welcome to urlfy.cc');
      expect(result.subject).toContain('John');
      expect(result.html).toContain('Hello, John!');
      expect(result.html).not.toContain('Olá');
    });

    it('should render in Portuguese', async () => {
      const result = await renderEmail({
        locale: 'pt-br',
        template: 'welcome',
        payload: {
          firstName: 'João',
          email: 'joao@example.com'
        }
      });

      expect(result.subject).toContain('Bem-vindo ao urlfy.cc');
      expect(result.subject).toContain('João');
      expect(result.html).toContain('Olá, João!');
      expect(result.html).not.toContain('Hello');
    });

    it('should interpolate firstName in subject', async () => {
      const result = await renderEmail({
        locale: 'en',
        template: 'welcome',
        payload: {
          firstName: 'Alice',
          email: 'alice@example.com'
        }
      });

      expect(result.subject).toBe('Welcome to urlfy.cc, Alice! 🎉');
    });
  });

  describe('Email Verification', () => {
    it('should render in English', async () => {
      const result = await renderEmail({
        locale: 'en',
        template: 'emailVerification',
        payload: {
          firstName: 'Bob',
          verificationUrl: 'https://urlfy.cc/verify?token=abc',
          expiresInMinutes: 30
        }
      });

      expect(result.subject).toBe('Confirm your email - urlfy.cc');
      expect(result.html).toContain('Hello, Bob!');
      expect(result.html).toContain('Confirm My Email');
      expect(result.html).toContain('https://urlfy.cc/verify?token=abc');
    });

    it('should render in Portuguese', async () => {
      const result = await renderEmail({
        locale: 'pt-br',
        template: 'emailVerification',
        payload: {
          firstName: 'Carlos',
          verificationUrl: 'https://urlfy.cc/verify?token=xyz',
          expiresInMinutes: 30
        }
      });

      expect(result.subject).toBe('Confirme seu email - urlfy.cc');
      expect(result.html).toContain('Olá, Carlos!');
      expect(result.html).toContain('Confirmar Meu Email');
      expect(result.html).toContain('https://urlfy.cc/verify?token=xyz');
    });

    it('should interpolate expiration time', async () => {
      const result = await renderEmail({
        locale: 'en',
        template: 'emailVerification',
        payload: {
          firstName: 'Diana',
          verificationUrl: 'https://urlfy.cc/verify',
          expiresInMinutes: 15
        }
      });

      expect(result.html).toContain('15 minutes');
    });
  });

  describe('Password Reset', () => {
    it('should render in English', async () => {
      const result = await renderEmail({
        locale: 'en',
        template: 'passwordReset',
        payload: {
          firstName: 'Eve',
          resetUrl: 'https://urlfy.cc/reset?token=def',
          expiresInMinutes: 15
        }
      });

      expect(result.subject).toBe('Reset your password - urlfy.cc');
      expect(result.html).toContain('Hello, Eve!');
      expect(result.html).toContain('Reset My Password');
    });

    it('should render in Portuguese', async () => {
      const result = await renderEmail({
        locale: 'pt-br',
        template: 'passwordReset',
        payload: {
          firstName: 'Fernando',
          resetUrl: 'https://urlfy.cc/reset?token=ghi',
          expiresInMinutes: 15
        }
      });

      expect(result.subject).toBe('Redefinir sua senha - urlfy.cc');
      expect(result.html).toContain('Olá, Fernando!');
      expect(result.html).toContain('Redefinir Minha Senha');
    });
  });

  describe('Data Deletion Confirmation', () => {
    it('should render in English', async () => {
      const requestDate = new Date('2026-01-28');
      const deadlineDate = new Date('2026-01-31');

      const result = await renderEmail({
        locale: 'en',
        template: 'dataDeletionConfirmation',
        payload: {
          firstName: 'Grace',
          requestDate,
          deadlineDate,
          exportUrl: 'https://urlfy.cc/export'
        }
      });

      expect(result.subject).toBe('Data Deletion Request Received');
      expect(result.html).toContain('Hello, Grace');
      expect(result.html).toContain('https://urlfy.cc/export');
    });

    it('should render in Portuguese', async () => {
      const requestDate = new Date('2026-01-28');
      const deadlineDate = new Date('2026-01-31');

      const result = await renderEmail({
        locale: 'pt-br',
        template: 'dataDeletionConfirmation',
        payload: {
          firstName: 'Henrique',
          requestDate,
          deadlineDate,
          exportUrl: 'https://urlfy.cc/export'
        }
      });

      expect(result.subject).toBe('Solicitação de Exclusão de Dados Recebida');
      expect(result.html).toContain('Olá, Henrique');
      expect(result.html).toContain('https://urlfy.cc/export');
    });
  });

  describe('Link Banned Notification', () => {
    it('should render in English', async () => {
      const result = await renderEmail({
        locale: 'en',
        template: 'linkBanned',
        payload: {
          firstName: 'Ivy',
          linkUrl: 'https://example.com/spam',
          shortCode: 'abc123',
          bannedReason: 'Spam content',
          bannedAt: new Date('2026-01-28'),
          appealUrl: 'https://urlfy.cc/appeal/abc123'
        }
      });

      expect(result.subject).toContain('Link Blocked');
      expect(result.html).toContain('Hello, Ivy');
      expect(result.html).toContain('abc123');
      expect(result.html).toContain('Spam content');
    });

    it('should render in Portuguese', async () => {
      const result = await renderEmail({
        locale: 'pt-br',
        template: 'linkBanned',
        payload: {
          firstName: 'Jorge',
          linkUrl: 'https://example.com/spam',
          shortCode: 'xyz789',
          bannedReason: 'Conteúdo spam',
          bannedAt: new Date('2026-01-28'),
          appealUrl: 'https://urlfy.cc/appeal/xyz789'
        }
      });

      expect(result.subject).toContain('Link Bloqueado');
      expect(result.html).toContain('Olá, Jorge');
      expect(result.html).toContain('xyz789');
      expect(result.html).toContain('Conteúdo spam');
    });
  });

  describe('Quota Warning', () => {
    it('should render in English with interpolated percentage', async () => {
      const result = await renderEmail({
        locale: 'en',
        template: 'quotaWarning',
        payload: {
          firstName: 'Kate',
          currentUsage: 85,
          quotaLimit: 100,
          percentUsed: 85,
          upgradeUrl: 'https://urlfy.cc/upgrade'
        }
      });

      expect(result.subject).toContain('85%');
      expect(result.html).toContain('Hello, Kate!');
      expect(result.html).toContain('85');
      expect(result.html).toContain('100');
      expect(result.html).toContain('links');
    });

    it('should render in Portuguese with interpolated percentage', async () => {
      const result = await renderEmail({
        locale: 'pt-br',
        template: 'quotaWarning',
        payload: {
          firstName: 'Lucas',
          currentUsage: 90,
          quotaLimit: 100,
          percentUsed: 90,
          upgradeUrl: 'https://urlfy.cc/upgrade'
        }
      });

      expect(result.subject).toContain('90%');
      expect(result.html).toContain('Olá, Lucas!');
      expect(result.html).toContain('90');
      expect(result.html).toContain('100');
      expect(result.html).toContain('links');
    });
  });

  describe('Locale Resolution', () => {
    it('should handle all valid locales', async () => {
      const locales: AppLocale[] = ['en', 'pt-br'];

      for (const locale of locales) {
        const result = await renderEmail({
          locale,
          template: 'welcome',
          payload: {
            firstName: 'Test',
            email: 'test@example.com'
          }
        });

        expect(result.subject).toBeTruthy();
        expect(result.html).toBeTruthy();
        expect(result.html.length).toBeGreaterThan(100);
      }
    });

    it('should generate valid HTML for all templates and locales', async () => {
      const templates: Array<{
        template: 'welcome' | 'emailVerification' | 'passwordReset';
        payload:
          | WelcomeEmailPayload
          | EmailVerificationPayload
          | PasswordResetPayload;
      }> = [
        {
          template: 'welcome',
          payload: { firstName: 'Test', email: 'test@example.com' }
        },
        {
          template: 'emailVerification',
          payload: {
            firstName: 'Test',
            verificationUrl: 'https://example.com'
          }
        },
        {
          template: 'passwordReset',
          payload: { firstName: 'Test', resetUrl: 'https://example.com' }
        }
      ];

      const locales: AppLocale[] = ['en', 'pt-br'];

      for (const { template, payload } of templates) {
        for (const locale of locales) {
          const result = await renderEmail({ locale, template, payload });

          // Basic HTML structure validation
          expect(result.html).toContain('<!DOCTYPE html');
          expect(result.html).toContain('</html>');
          expect(result.subject).toBeTruthy();
        }
      }
    });
  });
});
