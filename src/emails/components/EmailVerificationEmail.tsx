import type { EmailMessages } from '../types';
import { EmailLayout } from './EmailLayout';

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
          {t.message.split('urlfy.cc').map((part, i, arr) => (
            <span key={i}>
              {part}
              {i < arr.length - 1 && (
                <strong style={{ color: '#6366f1' }}>urlfy.cc</strong>
              )}
            </span>
          ))}
        </p>

        <div
          style={{
            backgroundColor: '#eff6ff',
            border: '2px solid #3b82f6',
            borderRadius: '8px',
            padding: '20px',
            marginBottom: '24px',
            textAlign: 'center'
          }}
        >
          <p
            style={{
              margin: '0 0 8px 0',
              fontSize: '14px',
              fontWeight: '600',
              color: '#1e40af',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}
          >
            {t.securityNotice}
          </p>
          <p
            style={{
              margin: 0,
              fontSize: '14px',
              color: '#1e40af',
              lineHeight: '1.5'
            }}
          >
            {t.expiresIn.replace('{minutes}', String(expiresInMinutes))}
          </p>
        </div>

        <div style={{ textAlign: 'center', margin: '32px 0' }}>
          <a
            href={verificationUrl}
            style={{
              display: 'inline-block',
              padding: '16px 40px',
              background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
              color: '#ffffff',
              textDecoration: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: '600',
              boxShadow: '0 4px 6px rgba(99, 102, 241, 0.25)',
              transition: 'transform 0.2s'
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
            {t.cantClick}
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
            {verificationUrl}
          </p>
        </div>

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
            {t.footer}
          </p>
        </div>
      </div>
    </EmailLayout>
  );
}
