import type { EmailMessages } from '../types';
import {
  EmailButtonLink,
  EmailHeading,
  EmailLayout,
  EmailLinkBlock,
  EmailPanel,
  EmailParagraph
} from './email-layout';

interface EmailVerificationEmailProps {
  firstName: string;
  verificationUrl: string;
  expiresInMinutes?: number;
  messages: EmailMessages['emailVerification'];
  locale?: string;
}

export function EmailVerificationEmail({
  firstName,
  verificationUrl,
  expiresInMinutes = 30,
  messages: t,
  locale = 'en'
}: EmailVerificationEmailProps) {
  return (
    <EmailLayout previewText={t.previewText} locale={locale}>
      <EmailHeading>{t.title}</EmailHeading>
      <EmailParagraph>
        {t.greeting.replace('{firstName}', firstName)}
      </EmailParagraph>
      <EmailParagraph>{t.message}</EmailParagraph>

      <EmailPanel title={t.securityNotice} tone="info">
        <p style={{ margin: 0 }}>
          {t.expiresIn.replace('{minutes}', String(expiresInMinutes))}
        </p>
      </EmailPanel>

      <EmailButtonLink href={verificationUrl}>{t.ctaButton}</EmailButtonLink>

      <EmailLinkBlock
        label={`${t.cantClick} ${t.copyLink}`}
        url={verificationUrl}
      />

      <EmailPanel tone="warning">
        <p style={{ margin: 0 }}>{t.footer}</p>
      </EmailPanel>
    </EmailLayout>
  );
}
