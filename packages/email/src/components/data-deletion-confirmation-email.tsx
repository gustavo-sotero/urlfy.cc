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

interface DataDeletionConfirmationEmailProps {
  firstName: string;
  requestDate: Date;
  deadlineDate: Date;
  exportUrl?: string;
  messages: EmailMessages['dataDeletionConfirmation'];
  locale?: string;
}

export function DataDeletionConfirmationEmail({
  firstName,
  requestDate,
  deadlineDate,
  exportUrl,
  messages: t,
  locale = 'en'
}: DataDeletionConfirmationEmailProps) {
  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat(locale, {
      dateStyle: 'long',
      timeStyle: 'short'
    }).format(date);
  };

  const deletionItems = [
    t.deletionItem1,
    t.deletionItem2,
    t.deletionItem3,
    t.deletionItem4,
    t.deletionItem5
  ];

  const nextStepItems = [t.step1, t.step2, t.step3];

  return (
    <EmailLayout previewText={t.previewText} locale={locale}>
      <EmailHeading>{t.title}</EmailHeading>
      <EmailParagraph>
        {t.greeting.replace('{firstName}', firstName)}
      </EmailParagraph>
      <EmailParagraph>{t.message}</EmailParagraph>

      <EmailPanel title={t.requestDetails} tone="info">
        <EmailDataList
          rows={[
            { label: t.requestedOn, value: formatDate(requestDate) },
            { label: t.deadline, value: formatDate(deadlineDate) }
          ]}
          tone="info"
        />
      </EmailPanel>

      <EmailSubheading>{t.whatHappensNext}</EmailSubheading>
      <EmailBulletList items={nextStepItems} tone="accent" />

      <EmailSubheading>{t.deletionHeader}</EmailSubheading>
      <EmailBulletList items={deletionItems} tone="danger" />

      {exportUrl ? (
        <EmailPanel title={t.exportPrompt} tone="success">
          <EmailParagraph subtle>{t.exportDesc}</EmailParagraph>
          <EmailButtonLink href={exportUrl} align="left">
            {t.exportData}
          </EmailButtonLink>
        </EmailPanel>
      ) : null}

      <EmailPanel tone="warning">
        <p style={{ margin: 0 }}>{t.warningNote}</p>
      </EmailPanel>
      <EmailParagraph subtle>{t.footer}</EmailParagraph>
    </EmailLayout>
  );
}
