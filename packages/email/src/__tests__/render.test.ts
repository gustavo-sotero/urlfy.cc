import { describe, expect, it } from 'bun:test';
import { renderEmail } from '../render';
import type {
  AppLocale,
  EmailPayloadByTemplate,
  EmailTemplate
} from '../types';

const basePayloads: { [K in EmailTemplate]: EmailPayloadByTemplate[K] } = {
  welcome: {
    firstName: 'Test',
    email: 'test@example.com'
  },
  emailVerification: {
    firstName: 'Test',
    verificationUrl: 'https://urlfy.cc/verify?token=abc123',
    expiresInMinutes: 30
  },
  passwordReset: {
    firstName: 'Test',
    resetUrl: 'https://urlfy.cc/reset?token=def456',
    expiresInMinutes: 15
  },
  dataDeletionConfirmation: {
    firstName: 'Test',
    requestDate: new Date('2026-01-01T12:00:00.000Z'),
    deadlineDate: new Date('2026-01-04T12:00:00.000Z'),
    exportUrl: 'https://urlfy.cc/export'
  },
  linkBanned: {
    firstName: 'Test',
    linkUrl: 'https://example.com/spam',
    shortCode: 'abc123',
    bannedReason: 'Spam content',
    bannedAt: new Date('2026-01-01T12:00:00.000Z'),
    appealUrl: 'https://urlfy.cc/appeal/abc123'
  },
  quotaWarning: {
    firstName: 'Test',
    currentUsage: 95,
    quotaLimit: 100,
    percentUsed: 95,
    upgradeUrl: 'https://urlfy.cc/upgrade'
  }
};

const previewTextSnippets: Record<AppLocale, Record<EmailTemplate, string>> = {
  en: {
    welcome: 'a separate verification email is on the way.',
    emailVerification: 'Confirm that you own this email address.',
    passwordReset: 'Use this secure link to choose a new password.',
    dataDeletionConfirmation:
      'Your deletion request is queued and being processed.',
    linkBanned: 'Review the reason for the block and the next steps.',
    quotaWarning: 'Your workspace is getting close to its limit.'
  },
  'pt-br': {
    welcome:
      'Seu dashboard está pronto, e um e-mail de verificação separado já foi enviado.',
    emailVerification: 'Confirme que este endereço de e-mail é seu.',
    passwordReset: 'Use este link seguro para escolher uma nova senha.',
    dataDeletionConfirmation:
      'Sua solicitação de exclusão foi registrada e está em processamento.',
    linkBanned: 'Revise o motivo do bloqueio e os próximos passos.',
    quotaWarning: 'Seu workspace está se aproximando do limite.'
  }
};

function expectSharedShell(locale: AppLocale, html: string) {
  if (locale === 'en') {
    expect(html).toContain('Account updates');
    expect(html).toContain('Short links with clear analytics');
    expect(html).toContain('You are receiving this message because');
    expect(html).toContain('Terms of Use');
    expect(html).toContain('Privacy Policy');
    expect(html).toContain('Help');
  } else {
    expect(html).toContain('Atualizações da conta');
    expect(html).toContain('Links curtos com analytics claros');
    expect(html).toContain('Você recebeu esta mensagem porque');
    expect(html).toContain('Termos de Uso');
    expect(html).toContain('Política de Privacidade');
    expect(html).toContain('Ajuda');
  }
}

describe('Email rendering', () => {
  describe('welcome email', () => {
    it('renders the English subject and onboarding copy', async () => {
      const result = await renderEmail({
        locale: 'en',
        template: 'welcome',
        payload: {
          firstName: 'Alice',
          email: 'alice@example.com'
        }
      });

      expect(result.subject).toBe('Welcome to urlfy.cc, Alice');
      expect(result.html).toContain('Hello, Alice,');
      expect(result.html).toContain('a separate verification email');
      expect(result.html).toContain('Open dashboard');
      expectSharedShell('en', result.html);
    });

    it('renders the Portuguese subject and onboarding copy', async () => {
      const result = await renderEmail({
        locale: 'pt-br',
        template: 'welcome',
        payload: {
          firstName: 'João',
          email: 'joao@example.com'
        }
      });

      expect(result.subject).toBe('Bem-vindo ao urlfy.cc, João');
      expect(result.html).toContain('Olá, João,');
      expect(result.html).toContain('e-mail de verificação separado');
      expect(result.html).toContain('Abrir dashboard');
      expectSharedShell('pt-br', result.html);
    });
  });

  describe('email verification', () => {
    it('renders the English verification subject, CTA, and fallback link', async () => {
      const result = await renderEmail({
        locale: 'en',
        template: 'emailVerification',
        payload: {
          firstName: 'Bob',
          verificationUrl: 'https://urlfy.cc/verify?token=abc',
          expiresInMinutes: 15
        }
      });

      expect(result.subject).toBe('Verify your email for urlfy.cc');
      expect(result.html).toContain('Verify your email address');
      expect(result.html).toContain('Verify email');
      expect(result.html).toContain('15 minutes');
      expect(result.html).toContain('https://urlfy.cc/verify?token=abc');
      expect(result.html).toContain('separate from your welcome email');
    });

    it('renders the Portuguese verification subject and CTA', async () => {
      const result = await renderEmail({
        locale: 'pt-br',
        template: 'emailVerification',
        payload: {
          firstName: 'Carlos',
          verificationUrl: 'https://urlfy.cc/verify?token=xyz',
          expiresInMinutes: 30
        }
      });

      expect(result.subject).toBe('Verifique seu e-mail no urlfy.cc');
      expect(result.html).toContain('Verifique seu e-mail');
      expect(result.html).toContain('Verificar e-mail');
      expect(result.html).toContain('https://urlfy.cc/verify?token=xyz');
    });
  });

  describe('password reset', () => {
    it('renders the English password reset copy and security tips', async () => {
      const result = await renderEmail({
        locale: 'en',
        template: 'passwordReset',
        payload: {
          firstName: 'Eve',
          resetUrl: 'https://urlfy.cc/reset?token=def',
          expiresInMinutes: 15
        }
      });

      expect(result.subject).toBe('Reset your password for urlfy.cc');
      expect(result.html).toContain('Choose a new password');
      expect(result.html).toContain('Security tips');
      expect(result.html).toContain('Never share your password');
    });

    it('renders the Portuguese password reset copy', async () => {
      const result = await renderEmail({
        locale: 'pt-br',
        template: 'passwordReset',
        payload: {
          firstName: 'Fernanda',
          resetUrl: 'https://urlfy.cc/reset?token=ghi',
          expiresInMinutes: 15
        }
      });

      expect(result.subject).toBe('Redefina sua senha do urlfy.cc');
      expect(result.html).toContain('Escolher nova senha');
      expect(result.html).toContain('Dicas de segurança');
    });
  });

  describe('data deletion confirmation', () => {
    it('renders the English deletion request details and export CTA', async () => {
      const result = await renderEmail({
        locale: 'en',
        template: 'dataDeletionConfirmation',
        payload: {
          firstName: 'Grace',
          requestDate: new Date('2026-01-28T12:00:00.000Z'),
          deadlineDate: new Date('2026-01-31T12:00:00.000Z'),
          exportUrl: 'https://urlfy.cc/export'
        }
      });

      expect(result.subject).toBe('We received your data deletion request');
      expect(result.html).toContain('Request details');
      expect(result.html).toContain('What happens next');
      expect(result.html).toContain('Export my data');
    });

    it('renders the Portuguese deletion request details', async () => {
      const result = await renderEmail({
        locale: 'pt-br',
        template: 'dataDeletionConfirmation',
        payload: {
          firstName: 'Henrique',
          requestDate: new Date('2026-01-28T12:00:00.000Z'),
          deadlineDate: new Date('2026-01-31T12:00:00.000Z')
        }
      });

      expect(result.subject).toBe(
        'Recebemos sua solicitação de exclusão de dados'
      );
      expect(result.html).toContain('Detalhes da solicitação');
      expect(result.html).toContain('O que acontece agora');
      expect(result.html).toContain('O que será excluído');
    });
  });

  describe('link banned notification', () => {
    it('renders the English blocked-link details and next steps', async () => {
      const result = await renderEmail({
        locale: 'en',
        template: 'linkBanned',
        payload: {
          firstName: 'Ivy',
          linkUrl: 'https://example.com/spam',
          shortCode: 'abc123',
          bannedReason: 'Spam content',
          bannedAt: new Date('2026-01-28T12:00:00.000Z'),
          appealUrl: 'https://urlfy.cc/appeal/abc123'
        }
      });

      expect(result.subject).toBe(
        'Action required: one of your links was blocked'
      );
      expect(result.html).toContain('Short Code');
      expect(result.html).toContain('What this means');
      expect(result.html).toContain(
        'Check the rule that applies to this destination'
      );
      expect(result.html).toContain('Contest Ban');
    });

    it('renders the Portuguese blocked-link details', async () => {
      const result = await renderEmail({
        locale: 'pt-br',
        template: 'linkBanned',
        payload: {
          firstName: 'Jorge',
          linkUrl: 'https://example.com/spam',
          shortCode: 'xyz789',
          bannedReason: 'Conteúdo spam',
          bannedAt: new Date('2026-01-28T12:00:00.000Z'),
          appealUrl: 'https://urlfy.cc/appeal/xyz789'
        }
      });

      expect(result.subject).toBe(
        'Ação necessária: um dos seus links foi bloqueado'
      );
      expect(result.html).toContain('Código Curto');
      expect(result.html).toContain('Próximos passos');
      expect(result.html).toContain(
        'Confira a regra que se aplica a este destino'
      );
      expect(result.html).toContain('Contestar Bloqueio');
    });
  });

  describe('quota warning', () => {
    it('renders the English quota warning, usage rows, and critical state', async () => {
      const result = await renderEmail({
        locale: 'en',
        template: 'quotaWarning',
        payload: {
          firstName: 'Kate',
          currentUsage: 95,
          quotaLimit: 100,
          percentUsed: 95,
          upgradeUrl: 'https://urlfy.cc/upgrade'
        }
      });

      expect(result.subject).toBe('You have used 95% of your link quota');
      expect(result.html).toContain('Current usage');
      expect(result.html).toContain('Plan limit');
      expect(result.html).toContain('95%');
      expect(result.html).toContain('5 links left');
      expect(result.html).toContain('View plans');
    });

    it('renders the Portuguese quota warning copy', async () => {
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

      expect(result.subject).toBe('Você já usou 90% da sua cota de links');
      expect(result.html).toContain('Uso atual');
      expect(result.html).toContain('Limite do plano');
      expect(result.html).toContain('Ver planos');
    });
  });

  describe('shared shell and locale coverage', () => {
    it('applies the shared shell to every template in every locale', async () => {
      const locales: AppLocale[] = ['en', 'pt-br'];
      const templates: EmailTemplate[] = [
        'welcome',
        'emailVerification',
        'passwordReset',
        'dataDeletionConfirmation',
        'linkBanned',
        'quotaWarning'
      ];

      for (const locale of locales) {
        for (const template of templates) {
          const result = await renderEmail({
            locale,
            template,
            payload: basePayloads[template]
          });

          expect(result.html).toContain('<!DOCTYPE html');
          expect(result.html).toContain('</html>');
          expect(result.subject).toBeTruthy();
          expect(result.html.length).toBeGreaterThan(800);
          expectSharedShell(locale, result.html);
        }
      }
    });

    it('includes the localized preview text in every template and locale', async () => {
      const locales: AppLocale[] = ['en', 'pt-br'];
      const templates: EmailTemplate[] = [
        'welcome',
        'emailVerification',
        'passwordReset',
        'dataDeletionConfirmation',
        'linkBanned',
        'quotaWarning'
      ];

      for (const locale of locales) {
        for (const template of templates) {
          const result = await renderEmail({
            locale,
            template,
            payload: basePayloads[template]
          });

          expect(result.html).toContain(previewTextSnippets[locale][template]);
        }
      }
    });

    it('keeps welcome and verification emails clearly differentiated', async () => {
      const welcome = await renderEmail({
        locale: 'en',
        template: 'welcome',
        payload: basePayloads.welcome
      });
      const verification = await renderEmail({
        locale: 'en',
        template: 'emailVerification',
        payload: basePayloads.emailVerification
      });

      expect(welcome.html).toContain('Open dashboard');
      expect(welcome.html).toContain('a separate verification email');
      expect(verification.html).toContain('Verify email');
      expect(verification.html).toContain('separate from your welcome email');
    });
  });
});
