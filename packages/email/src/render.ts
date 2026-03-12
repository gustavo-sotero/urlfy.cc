/**
 * Email Rendering Service with i18n Support
 * Handles rendering of email templates with localized content
 */

import { render } from '@react-email/render';
import {
  DataDeletionConfirmationEmail,
  EmailVerificationEmail,
  LinkBannedEmail,
  PasswordResetEmail,
  QuotaWarningEmail,
  WelcomeEmail
} from './components';
import { Emails as enEmails } from './messages/en';
import { Emails as ptEmails } from './messages/pt-br';
import type {
  AppLocale,
  EmailPayloadByTemplate,
  EmailTemplate,
  RenderEmailInput,
  RenderEmailResult
} from './types';

function getMessages(locale: AppLocale) {
  return locale === 'pt-br' ? ptEmails : enEmails;
}

function interpolate(
  template: string,
  data: Record<string, string | number>
): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    return String(data[key] ?? `{${key}}`);
  });
}

export async function renderEmail<T extends EmailTemplate>(
  input: RenderEmailInput<T>
): Promise<RenderEmailResult> {
  const { locale, template, payload } = input;
  const emailMessages = getMessages(locale);

  let subject: string;
  let reactElement: React.ReactElement;

  switch (template) {
    case 'welcome': {
      const p = payload as EmailPayloadByTemplate['welcome'];
      const t = emailMessages.welcome;

      subject = interpolate(t.subject, { firstName: p.firstName });
      reactElement = WelcomeEmail({
        ...p,
        messages: t,
        locale
      });
      break;
    }

    case 'emailVerification': {
      const p = payload as EmailPayloadByTemplate['emailVerification'];
      const t = emailMessages.emailVerification;

      subject = t.subject;
      reactElement = EmailVerificationEmail({
        ...p,
        messages: t,
        locale
      });
      break;
    }

    case 'passwordReset': {
      const p = payload as EmailPayloadByTemplate['passwordReset'];
      const t = emailMessages.passwordReset;

      subject = t.subject;
      reactElement = PasswordResetEmail({
        ...p,
        messages: t,
        locale
      });
      break;
    }

    case 'dataDeletionConfirmation': {
      const p = payload as EmailPayloadByTemplate['dataDeletionConfirmation'];
      const t = emailMessages.dataDeletionConfirmation;

      subject = t.subject;
      reactElement = DataDeletionConfirmationEmail({
        ...p,
        messages: t,
        locale
      });
      break;
    }

    case 'linkBanned': {
      const p = payload as EmailPayloadByTemplate['linkBanned'];
      const t = emailMessages.linkBanned;

      subject = t.subject;
      reactElement = LinkBannedEmail({
        ...p,
        messages: t,
        locale
      });
      break;
    }

    case 'quotaWarning': {
      const p = payload as EmailPayloadByTemplate['quotaWarning'];
      const t = emailMessages.quotaWarning;

      subject = interpolate(t.subject, { percent: p.percentUsed.toFixed(0) });
      reactElement = QuotaWarningEmail({
        ...p,
        messages: t,
        locale
      });
      break;
    }

    default:
      throw new Error(`Unknown email template: ${template}`);
  }

  const html = await render(reactElement);

  return {
    subject,
    html
  };
}
