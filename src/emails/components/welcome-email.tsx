import type { EmailMessages } from '../types';
import { EmailLayout } from './email-layout';

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
  const brandedSegments = t.welcomeMessage.split(/(urlfy\.cc)/g);
  const segmentOccurrences = new Map<string, number>();

  const featureItems = [
    {
      emoji: '🔗',
      title: t.createLinks,
      description: t.createLinksDesc
    },
    {
      emoji: '🎨',
      title: t.customizeUrls,
      description: t.customizeUrlsDesc
    },
    {
      emoji: '📊',
      title: t.trackAnalytics,
      description: t.trackAnalyticsDesc
    }
  ];

  return (
    <EmailLayout
      previewText={t.previewText.replace('{firstName}', firstName)}
      locale={locale}
    >
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
          {t.greeting.replace('{firstName}', firstName)}
        </h2>

        <p
          style={{
            margin: '0 0 24px 0',
            fontSize: '16px',
            color: '#475569',
            lineHeight: '1.6'
          }}
        >
          {brandedSegments.map((segment) => {
            const occurrence = (segmentOccurrences.get(segment) ?? 0) + 1;
            segmentOccurrences.set(segment, occurrence);
            const key = `${segment}-${occurrence}`;

            if (segment === 'urlfy.cc') {
              return (
                <strong key={key} style={{ color: '#6366f1' }}>
                  {segment}
                </strong>
              );
            }

            return <span key={key}>{segment}</span>;
          })}
        </p>

        <div
          style={{
            backgroundColor: '#f1f5f9',
            borderLeft: '4px solid #6366f1',
            padding: '20px',
            borderRadius: '8px',
            marginBottom: '24px'
          }}
        >
          <p
            style={{
              margin: '0 0 12px 0',
              fontSize: '14px',
              fontWeight: '600',
              color: '#334155',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}
          >
            {t.accountCreated}
          </p>
          <p
            style={{
              margin: 0,
              fontSize: '16px',
              color: '#475569',
              fontFamily: 'monospace'
            }}
          >
            {email}
          </p>
        </div>

        <h3
          style={{
            margin: '0 0 16px 0',
            fontSize: '18px',
            fontWeight: '600',
            color: '#1e293b'
          }}
        >
          {t.whatYouCanDo}
        </h3>

        <table
          role="presentation"
          style={{ width: '100%', marginBottom: '24px' }}
        >
          <tbody>
            {featureItems.map((item) => (
              <tr key={item.title}>
                <td
                  style={{
                    width: '40px',
                    verticalAlign: 'top',
                    paddingBottom: '16px'
                  }}
                >
                  <span style={{ fontSize: '24px' }}>{item.emoji}</span>
                </td>
                <td style={{ verticalAlign: 'top', paddingBottom: '16px' }}>
                  <p
                    style={{
                      margin: '0 0 4px 0',
                      fontSize: '15px',
                      fontWeight: '600',
                      color: '#334155'
                    }}
                  >
                    {item.title}
                  </p>
                  <p
                    style={{
                      margin: 0,
                      fontSize: '14px',
                      color: '#64748b',
                      lineHeight: '1.5'
                    }}
                  >
                    {item.description}
                  </p>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ textAlign: 'center', marginTop: '32px' }}>
          <a
            href="https://urlfy.cc/dashboard"
            style={{
              display: 'inline-block',
              padding: '14px 32px',
              backgroundColor: '#6366f1',
              color: '#ffffff',
              textDecoration: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: '600',
              boxShadow: '0 4px 6px rgba(99, 102, 241, 0.25)'
            }}
          >
            {t.getStarted}
          </a>
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
          {t.needHelp}{' '}
          <a
            href="https://urlfy.cc/support"
            style={{ color: '#6366f1', textDecoration: 'none' }}
          >
            {t.contactSupport}
          </a>
          .
        </p>
      </div>
    </EmailLayout>
  );
}
