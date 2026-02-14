import type { EmailMessages } from '../types';
import { EmailLayout } from './email-layout';

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
            backgroundColor: '#fef3c7',
            border: '1px solid #fbbf24',
            borderRadius: '8px',
            padding: '16px',
            marginBottom: '24px'
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: '14px',
              color: '#92400e',
              lineHeight: '1.5'
            }}
          >
            {t.expiresNotice.replace('{minutes}', String(expiresInMinutes))}
          </p>
        </div>

        <div style={{ textAlign: 'center', margin: '32px 0' }}>
          <a
            href={resetUrl}
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
            {t.ctaButton}
          </a>
        </div>

        <div
          style={{
            backgroundColor: '#f8fafc',
            borderRadius: '8px',
            padding: '20px',
            marginTop: '24px'
          }}
        >
          <p
            style={{
              margin: '0 0 12px 0',
              fontSize: '13px',
              fontWeight: '600',
              color: '#475569',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}
          >
            {t.copyLink}
          </p>
          <p
            style={{
              margin: 0,
              fontSize: '13px',
              color: '#6366f1',
              wordBreak: 'break-all',
              fontFamily: 'monospace',
              backgroundColor: '#ffffff',
              padding: '12px',
              borderRadius: '6px',
              border: '1px solid #e2e8f0'
            }}
          >
            {resetUrl}
          </p>
        </div>

        <div
          style={{
            marginTop: '32px',
            padding: '16px',
            backgroundColor: '#fee2e2',
            borderLeft: '4px solid #ef4444',
            borderRadius: '8px'
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: '14px',
              color: '#7f1d1d',
              lineHeight: '1.5'
            }}
          >
            {t.didntRequest}
          </p>
        </div>
      </div>
    </EmailLayout>
  );
}
