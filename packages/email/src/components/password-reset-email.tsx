import type { EmailMessages } from '../types';
import {
  EmailBulletList,
  EmailButtonLink,
  EmailHeading,
  EmailLayout,
  EmailLinkBlock,
  EmailPanel,
  EmailParagraph
} from './email-layout';

interface PasswordResetEmailProps {
  firstName: string;
  resetUrl: string;
  expiresInMinutes?: number;
  messages: EmailMessages['passwordReset'];
  locale?: string;
}

export function PasswordResetEmail({
  firstName,
  resetUrl,
  expiresInMinutes = 15,
  messages: t,
  locale = 'en'
}: PasswordResetEmailProps) {
  return (
    <EmailLayout previewText={t.previewText} locale={locale}>
      <EmailHeading>{t.title}</EmailHeading>
      <EmailParagraph>
        {t.greeting.replace('{firstName}', firstName)}
      </EmailParagraph>
      <EmailParagraph>{t.message}</EmailParagraph>

      <EmailPanel tone="warning">
        <p style={{ margin: 0 }}>
          {t.expiresNotice.replace('{minutes}', String(expiresInMinutes))}
        </p>
      </EmailPanel>

      <EmailButtonLink href={resetUrl}>{t.ctaButton}</EmailButtonLink>

      <EmailLinkBlock label={t.copyLink} url={resetUrl} />

      <EmailPanel title={t.securityTips} tone="neutral">
        <EmailBulletList items={[t.tip1, t.tip2, t.tip3]} tone="muted" />
      </EmailPanel>

      <EmailPanel tone="danger">
        <p style={{ margin: 0 }}>{t.didntRequest}</p>
      </EmailPanel>
      <EmailParagraph subtle>{t.footer}</EmailParagraph>
    </EmailLayout>
  );
}
