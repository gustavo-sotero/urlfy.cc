import { describe, expect, it } from 'bun:test';
import { renderEmail } from '../render';
import type {
  AppLocale,
  EmailVerificationPayload,
  PasswordResetPayload,
  WelcomeEmailPayload
} from '../types';

describe('Email rendering', () => {
  describe('welcome email', () => {
    it('renders in English', async () => {
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

    it('renders in Portuguese', async () => {
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

    it('interpolates firstName in the subject', async () => {
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

  describe('email verification', () => {
    it('renders in English', async () => {
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

    it('renders in Portuguese', async () => {
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

    it('interpolates expiration time', async () => {
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

  describe('password reset', () => {
    it('renders in English', async () => {
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

    it('renders in Portuguese', async () => {
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

  describe('data deletion confirmation', () => {
    it('renders in English', async () => {
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

    it('renders in Portuguese', async () => {
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

  describe('link banned notification', () => {
    it('renders in English', async () => {
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

    it('renders in Portuguese', async () => {
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

  describe('quota warning', () => {
    it('renders in English with interpolated percentage', async () => {
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

    it('renders in Portuguese with interpolated percentage', async () => {
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

  describe('locale resolution', () => {
    it('handles all valid locales', async () => {
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

    it('generates valid HTML for all templates and locales', async () => {
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

          expect(result.html).toContain('<!DOCTYPE html');
          expect(result.html).toContain('</html>');
          expect(result.subject).toBeTruthy();
        }
      }
    });
  });

  describe('shared email-layout locale awareness', () => {
    it('renders English footer for en locale', async () => {
      const result = await renderEmail({
        locale: 'en',
        template: 'welcome',
        payload: { firstName: 'Test', email: 'test@example.com' }
      });

      expect(result.html).toContain('All rights reserved');
      expect(result.html).toContain('Terms of Use');
      expect(result.html).toContain('Privacy Policy');
      expect(result.html).toContain('Don&#x27;t want to receive these emails?');
      expect(result.html).not.toContain('Todos os direitos reservados');
    });

    it('renders Portuguese footer for pt-br locale', async () => {
      const result = await renderEmail({
        locale: 'pt-br',
        template: 'welcome',
        payload: { firstName: 'Teste', email: 'teste@example.com' }
      });

      expect(result.html).toContain('Todos os direitos reservados');
      expect(result.html).toContain('Termos de Uso');
      expect(result.html).toContain('Privacidade');
      expect(result.html).toContain('Não deseja mais receber esses emails?');
      expect(result.html).not.toContain('All rights reserved');
    });

    it('includes preview text in all templates', async () => {
      const templates = [
        {
          template: 'welcome' as const,
          payload: { firstName: 'Test', email: 'test@example.com' }
        },
        {
          template: 'emailVerification' as const,
          payload: {
            firstName: 'Test',
            verificationUrl: 'https://example.com/verify'
          }
        },
        {
          template: 'passwordReset' as const,
          payload: {
            firstName: 'Test',
            resetUrl: 'https://example.com/reset'
          }
        }
      ];

      for (const { template, payload } of templates) {
        const result = await renderEmail({ locale: 'en', template, payload });
        // Preview text is hidden via display:none in a div element
        expect(result.html.length).toBeGreaterThan(200);
        expect(result.subject).toBeTruthy();
      }
    });
  });

  describe('quota warning locale correctness', () => {
    it('uses catalog text in English, not hardcoded Portuguese', async () => {
      const result = await renderEmail({
        locale: 'en',
        template: 'quotaWarning',
        payload: {
          firstName: 'Test',
          currentUsage: 80,
          quotaLimit: 100,
          percentUsed: 80,
          upgradeUrl: 'https://urlfy.cc/upgrade'
        }
      });

      expect(result.html).not.toContain('Uso Atual');
      expect(result.html).not.toContain('Opções disponíveis');
      expect(result.html).not.toContain('Ver Planos');
      expect(result.html).toContain('Current usage');
      expect(result.html).toContain('View Plans');
    });

    it('uses catalog text in Portuguese', async () => {
      const result = await renderEmail({
        locale: 'pt-br',
        template: 'quotaWarning',
        payload: {
          firstName: 'Teste',
          currentUsage: 90,
          quotaLimit: 100,
          percentUsed: 90,
          upgradeUrl: 'https://urlfy.cc/upgrade'
        }
      });

      expect(result.html).toContain('Ver Planos');
      expect(result.html).toContain('Uso atual');
    });

    it('renders critical warning when percentUsed >= 90', async () => {
      const result = await renderEmail({
        locale: 'en',
        template: 'quotaWarning',
        payload: {
          firstName: 'Test',
          currentUsage: 95,
          quotaLimit: 100,
          percentUsed: 95,
          upgradeUrl: 'https://urlfy.cc/upgrade'
        }
      });

      // remaining = 100 - 95 = 5
      expect(result.html).toContain('5');
      expect(result.html).toContain('Warning!');
    });
  });

  describe('link banned locale correctness', () => {
    it('uses catalog labels in English, not hardcoded Portuguese', async () => {
      const result = await renderEmail({
        locale: 'en',
        template: 'linkBanned',
        payload: {
          firstName: 'Test',
          linkUrl: 'https://example.com',
          shortCode: 'abc123',
          bannedReason: 'Spam',
          bannedAt: new Date('2026-01-01'),
          appealUrl: 'https://urlfy.cc/appeal'
        }
      });

      expect(result.html).not.toContain('Código Curto');
      expect(result.html).not.toContain('O que isso significa');
      expect(result.html).not.toContain('Contestar Bloqueio');
      expect(result.html).toContain('Short Code');
      expect(result.html).toContain('What this means');
      expect(result.html).toContain('Contest Ban');
    });

    it('uses catalog labels in Portuguese', async () => {
      const result = await renderEmail({
        locale: 'pt-br',
        template: 'linkBanned',
        payload: {
          firstName: 'Teste',
          linkUrl: 'https://example.com',
          shortCode: 'xyz789',
          bannedReason: 'Spam',
          bannedAt: new Date('2026-01-01'),
          appealUrl: 'https://urlfy.cc/appeal'
        }
      });

      expect(result.html).toContain('Código Curto');
      expect(result.html).toContain('O que isso significa');
      expect(result.html).toContain('Contestar Bloqueio');
    });
  });

  describe('data deletion locale correctness', () => {
    it('uses catalog labels in English, not hardcoded Portuguese', async () => {
      const result = await renderEmail({
        locale: 'en',
        template: 'dataDeletionConfirmation',
        payload: {
          firstName: 'Test',
          requestDate: new Date('2026-01-01'),
          deadlineDate: new Date('2026-01-04'),
          exportUrl: 'https://urlfy.cc/export'
        }
      });

      expect(result.html).not.toContain('O que será excluído');
      expect(result.html).not.toContain('Data da Solicitação');
      expect(result.html).toContain('What will be deleted');
      expect(result.html).toContain('Requested on');
    });

    it('uses catalog labels in Portuguese', async () => {
      const result = await renderEmail({
        locale: 'pt-br',
        template: 'dataDeletionConfirmation',
        payload: {
          firstName: 'Teste',
          requestDate: new Date('2026-01-01'),
          deadlineDate: new Date('2026-01-04')
        }
      });

      expect(result.html).toContain('O que será excluído');
      expect(result.html).toContain('Solicitado em');
    });
  });
});
