import type { EmailMessages } from '../types';
import { EmailLayout } from './email-layout';

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

  return (
    <EmailLayout previewText={t.previewText} locale={locale}>
      <div>
        <h2
          style={{
            margin: '0 0 16px 0',
            fontSize: '24px',
            fontWeight: '600',
            color: '#1e293b',
            lineHeight: '1.3'
          }}
        >
          {t.title}
        </h2>

        <p
          style={{
            margin: '0 0 24px 0',
            fontSize: '16px',
            color: '#475569',
            lineHeight: '1.6'
          }}
        >
          {t.greeting.replace('{firstName}', firstName)}
        </p>

        <p
          style={{
            margin: '0 0 24px 0',
            fontSize: '16px',
            color: '#475569',
            lineHeight: '1.6'
          }}
        >
          {t.message}
        </p>

        <div
          style={{
            backgroundColor: '#dbeafe',
            border: '1px solid #3b82f6',
            borderRadius: '8px',
            padding: '20px',
            marginBottom: '24px'
          }}
        >
          <table role="presentation" style={{ width: '100%' }}>
            <tbody>
              <tr>
                <td style={{ paddingBottom: '12px' }}>
                  <p
                    style={{
                      margin: '0 0 4px 0',
                      fontSize: '13px',
                      fontWeight: '600',
                      color: '#1e40af',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}
                  >
                    {t.requestedOn}
                  </p>
                  <p
                    style={{
                      margin: 0,
                      fontSize: '15px',
                      color: '#1e40af'
                    }}
                  >
                    {formatDate(requestDate)}
                  </p>
                </td>
              </tr>
              <tr>
                <td>
                  <p
                    style={{
                      margin: '0 0 4px 0',
                      fontSize: '13px',
                      fontWeight: '600',
                      color: '#1e40af',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}
                  >
                    {t.deadline}
                  </p>
                  <p
                    style={{
                      margin: 0,
                      fontSize: '15px',
                      color: '#1e40af'
                    }}
                  >
                    {formatDate(deadlineDate)}
                  </p>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <h3
          style={{
            margin: '24px 0 16px 0',
            fontSize: '18px',
            fontWeight: '600',
            color: '#1e293b'
          }}
        >
          {t.deletionHeader}
        </h3>

        <table
          role="presentation"
          style={{ width: '100%', marginBottom: '24px' }}
        >
          <tbody>
            {deletionItems.map((item) => (
              <tr key={item}>
                <td style={{ paddingBottom: '8px' }}>
                  <p
                    style={{
                      margin: 0,
                      fontSize: '15px',
                      color: '#475569',
                      lineHeight: '1.5'
                    }}
                  >
                    <span style={{ color: '#ef4444', marginRight: '8px' }}>
                      âœ—
                    </span>
                    {item}
                  </p>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {exportUrl && (
          <div
            style={{
              backgroundColor: '#f0fdf4',
              border: '1px solid #22c55e',
              borderRadius: '8px',
              padding: '20px',
              marginBottom: '24px'
            }}
          >
            <p
              style={{
                margin: '0 0 12px 0',
                fontSize: '15px',
                fontWeight: '600',
                color: '#15803d'
              }}
            >
              {t.exportPrompt}
            </p>
            <p
              style={{
                margin: '0 0 16px 0',
                fontSize: '14px',
                color: '#166534',
                lineHeight: '1.5'
              }}
            >
              {t.exportDesc}
            </p>
            <a
              href={exportUrl}
              style={{
                display: 'inline-block',
                padding: '10px 20px',
                backgroundColor: '#22c55e',
                color: '#ffffff',
                textDecoration: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: '600'
              }}
            >
              {t.exportData}
            </a>
          </div>
        )}

        <div
          style={{
            marginTop: '32px',
            padding: '16px',
            backgroundColor: '#fef3c7',
            borderLeft: '4px solid #f59e0b',
            borderRadius: '8px'
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: '14px',
              color: '#78350f',
              lineHeight: '1.5'
            }}
          >
            {t.warningNote}
          </p>
        </div>

        <p
          style={{
            marginTop: '32px',
            marginBottom: 0,
            fontSize: '14px',
            color: '#64748b',
            lineHeight: '1.6'
          }}
        >
          {t.footer}
        </p>
      </div>
    </EmailLayout>
  );
}
