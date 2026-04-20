import type { EmailMessages } from '../types';
import {
  EmailBulletList,
  EmailButtonLink,
  EmailDataList,
  EmailHeading,
  EmailLayout,
  EmailPanel,
  EmailParagraph,
  EmailSubheading
} from './email-layout';

interface LinkBannedEmailProps {
  firstName: string;
  linkUrl: string;
  shortCode: string;
  bannedReason: string;
  bannedAt: Date;
  appealUrl: string;
  messages: EmailMessages['linkBanned'];
  locale?: string;
}

export function LinkBannedEmail({
  firstName,
  linkUrl,
  shortCode,
  bannedReason,
  bannedAt,
  appealUrl,
  messages: t,
  locale = 'en'
}: LinkBannedEmailProps) {
  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat(locale, {
      dateStyle: 'long',
      timeStyle: 'short'
    }).format(date);
  };

  const nextStepItems = [
    <span key="review-terms">
      <strong>{t.reviewTerms}.</strong> {t.reviewTermsDesc}
    </span>,
    <span key="appeal-review">
      <strong>{t.appeal}.</strong> {t.appealDesc}
    </span>,
    <span key="create-replacement">
      <strong>{t.createNew}.</strong> {t.createNewDesc}
    </span>
  ];

  return (
    <EmailLayout previewText={t.previewText} locale={locale}>
      <EmailHeading>{t.title}</EmailHeading>
      <EmailParagraph>
        {t.greeting.replace('{firstName}', firstName)}
      </EmailParagraph>
      <EmailParagraph>{t.message}</EmailParagraph>

      <EmailPanel tone="danger">
        <EmailDataList
          rows={[
            { label: t.shortCode, value: `urlfy.cc/${shortCode}` },
            { label: t.originalUrl, value: linkUrl },
            { label: t.reason, value: bannedReason },
            { label: t.bannedOn, value: formatDate(bannedAt) }
          ]}
          tone="danger"
        />
      </EmailPanel>

      <EmailSubheading>{t.implicationsHeader}</EmailSubheading>
      <EmailBulletList
        items={[t.implication1, t.implication2, t.implication3, t.implication4]}
        tone="danger"
      />

      <EmailSubheading>{t.whatYouCanDo}</EmailSubheading>
      <EmailBulletList items={nextStepItems} tone="accent" />

      <EmailPanel title={t.commonReasonsHeader} tone="neutral">
        <EmailBulletList
          items={[
            t.commonReason1,
            t.commonReason2,
            t.commonReason3,
            t.commonReason4
          ]}
          tone="muted"
        />
      </EmailPanel>

      <EmailButtonLink href={appealUrl}>{t.appealCta}</EmailButtonLink>
      <EmailParagraph subtle>{t.footer}</EmailParagraph>
    </EmailLayout>
  );
}
