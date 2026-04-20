import type { EmailMessages } from '../types';
import {
  EmailBulletList,
  EmailButtonLink,
  EmailDataList,
  EmailHeading,
  EmailLayout,
  EmailPanel,
  EmailParagraph,
  EmailSubheading,
  emailTheme
} from './email-layout';

interface WelcomeEmailProps {
  firstName: string;
  email: string;
  messages: EmailMessages['welcome'];
  locale?: string;
}

export function WelcomeEmail({
  firstName,
  email,
  messages: t,
  locale = 'en'
}: WelcomeEmailProps) {
  const featureItems = [
    <span key="create-links">
      <strong style={{ color: emailTheme.colors.text }}>
        {t.createLinks}.
      </strong>{' '}
      {t.createLinksDesc}
    </span>,
    <span key="customize-urls">
      <strong style={{ color: emailTheme.colors.text }}>
        {t.customizeUrls}.
      </strong>{' '}
      {t.customizeUrlsDesc}
    </span>,
    <span key="track-analytics">
      <strong style={{ color: emailTheme.colors.text }}>
        {t.trackAnalytics}.
      </strong>{' '}
      {t.trackAnalyticsDesc}
    </span>
  ];

  return (
    <EmailLayout
      previewText={t.previewText.replace('{firstName}', firstName)}
      locale={locale}
    >
      <EmailHeading>
        {t.greeting.replace('{firstName}', firstName)}
      </EmailHeading>
      <EmailParagraph>{t.welcomeMessage}</EmailParagraph>

      <EmailPanel title={t.accountCreated} tone="neutral">
        <EmailDataList
          rows={[
            {
              label: t.yourEmail,
              value: (
                <span style={{ fontFamily: emailTheme.fonts.mono }}>
                  {email}
                </span>
              )
            }
          ]}
        />
      </EmailPanel>

      <EmailSubheading>{t.whatYouCanDo}</EmailSubheading>
      <EmailBulletList items={featureItems} tone="accent" />

      <EmailButtonLink href="https://urlfy.cc/dashboard">
        {t.getStarted}
      </EmailButtonLink>

      <EmailParagraph subtle>
        {t.needHelp}{' '}
        <a
          href="https://urlfy.cc/help"
          style={{ color: emailTheme.colors.accent, textDecoration: 'none' }}
        >
          {t.contactSupport}
        </a>
        .
      </EmailParagraph>
      <EmailParagraph subtle>{t.footer}</EmailParagraph>
    </EmailLayout>
  );
}
