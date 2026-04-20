import type { EmailMessages } from '../types';
import {
  EmailBulletList,
  EmailButtonLink,
  EmailDataList,
  EmailHeading,
  EmailLayout,
  EmailPanel,
  EmailParagraph,
  EmailProgressBar,
  EmailSubheading
} from './email-layout';

interface QuotaWarningEmailProps {
  firstName: string;
  currentUsage: number;
  quotaLimit: number;
  percentUsed: number;
  upgradeUrl: string;
  messages: EmailMessages['quotaWarning'];
  locale?: string;
}

export function QuotaWarningEmail({
  firstName,
  currentUsage,
  quotaLimit,
  percentUsed,
  upgradeUrl,
  messages: t,
  locale = 'en'
}: QuotaWarningEmailProps) {
  const remaining = quotaLimit - currentUsage;
  const isCritical = percentUsed >= 90;
  const roundedPercent = percentUsed.toFixed(0);

  return (
    <EmailLayout previewText={t.previewText} locale={locale}>
      <EmailHeading>{t.title}</EmailHeading>
      <EmailParagraph>
        {t.greeting.replace('{firstName}', firstName)}
      </EmailParagraph>
      <EmailParagraph>{t.message}</EmailParagraph>

      <EmailPanel tone="neutral">
        <EmailDataList
          rows={[
            { label: t.currentUsage, value: `${currentUsage}` },
            { label: t.quotaLimit, value: `${quotaLimit}` },
            { label: t.percentUsed, value: `${roundedPercent}%` }
          ]}
        />
        <EmailProgressBar
          value={percentUsed}
          tone={isCritical ? 'danger' : 'warning'}
        />
      </EmailPanel>

      <EmailPanel tone={isCritical ? 'danger' : 'warning'}>
        <p style={{ margin: 0 }}>
          {isCritical
            ? t.warningCritical.replace('{remaining}', String(remaining))
            : t.warningNear}
        </p>
      </EmailPanel>

      <EmailSubheading>{t.whatYouCanDo}</EmailSubheading>
      <EmailBulletList
        items={[
          <span key="manage-links">
            <strong>{t.manageLinks}.</strong> {t.manageLinksDesc}
          </span>,
          <span key="upgrade-plan">
            <strong>{t.upgrade}.</strong> {t.upgradeDesc}
          </span>
        ]}
        tone="accent"
      />

      <EmailButtonLink href={upgradeUrl}>{t.upgradeCta}</EmailButtonLink>
      <EmailParagraph subtle>{t.footer}</EmailParagraph>
    </EmailLayout>
  );
}
