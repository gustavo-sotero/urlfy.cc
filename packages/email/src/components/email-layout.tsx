import { Head } from '@react-email/components';
import type * as React from 'react';

interface EmailLayoutProps {
  children: React.ReactNode;
  previewText?: string;
  locale?: string;
}

const layoutMessages = {
  en: {
    subtitle: 'Professional Link Shortener',
    copyright: `© ${new Date().getFullYear()} urlfy.cc – All rights reserved`,
    terms: 'Terms of Use',
    privacy: 'Privacy Policy',
    unsubscribe: "Don't want to receive these emails?",
    unsubscribeLink: 'Unsubscribe'
  },
  'pt-br': {
    subtitle: 'Encurtador de Links Profissional',
    copyright: `© ${new Date().getFullYear()} urlfy.cc – Todos os direitos reservados`,
    terms: 'Termos de Uso',
    privacy: 'Privacidade',
    unsubscribe: 'Não deseja mais receber esses emails?',
    unsubscribeLink: 'Cancelar inscrição'
  }
} as const;

export function EmailLayout({
  children,
  previewText,
  locale = 'en'
}: EmailLayoutProps) {
  const langCode = locale === 'pt-br' ? 'pt-BR' : 'en';
  const lm =
    layoutMessages[locale as keyof typeof layoutMessages] ?? layoutMessages.en;

  return (
    <html lang={langCode}>
      <Head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta name="x-apple-disable-message-reformatting" />
        <title>{previewText || 'urlfy.cc'}</title>
      </Head>
      <body
        style={{
          margin: 0,
          padding: 0,
          backgroundColor: '#f8fafc',
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
        }}
      >
        {/* Preview Text (visible in inbox) */}
        {previewText && (
          <div
            style={{
              display: 'none',
              maxHeight: 0,
              overflow: 'hidden',
              fontSize: '1px',
              lineHeight: '1px',
              color: '#f8fafc'
            }}
          >
            {previewText}
          </div>
        )}

        {/* Main Container */}
        <table
          role="presentation"
          style={{
            width: '100%',
            backgroundColor: '#f8fafc',
            padding: '40px 20px'
          }}
        >
          <tbody>
            <tr>
              <td align="center">
                {/* Email Card */}
                <table
                  role="presentation"
                  style={{
                    maxWidth: '600px',
                    width: '100%',
                    backgroundColor: '#ffffff',
                    borderRadius: '12px',
                    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)',
                    overflow: 'hidden'
                  }}
                >
                  <tbody>
                    {/* Header */}
                    <tr>
                      <td
                        style={{
                          background:
                            'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                          padding: '40px 30px',
                          textAlign: 'center'
                        }}
                      >
                        <h1
                          style={{
                            margin: 0,
                            fontSize: '32px',
                            fontWeight: 'bold',
                            color: '#ffffff',
                            letterSpacing: '-0.5px'
                          }}
                        >
                          urlfy.cc
                        </h1>
                        <p
                          style={{
                            margin: '8px 0 0 0',
                            fontSize: '14px',
                            color: '#e0e7ff',
                            fontWeight: 500
                          }}
                        >
                          {lm.subtitle}
                        </p>
                      </td>
                    </tr>

                    {/* Content */}
                    <tr>
                      <td style={{ padding: '40px 30px' }}>{children}</td>
                    </tr>

                    {/* Footer */}
                    <tr>
                      <td
                        style={{
                          padding: '30px',
                          backgroundColor: '#f8fafc',
                          borderTop: '1px solid #e2e8f0',
                          textAlign: 'center'
                        }}
                      >
                        <p
                          style={{
                            margin: '0 0 12px 0',
                            fontSize: '14px',
                            color: '#64748b',
                            lineHeight: '1.6'
                          }}
                        >
                          {lm.copyright}
                        </p>
                        <p
                          style={{
                            margin: 0,
                            fontSize: '12px',
                            color: '#94a3b8'
                          }}
                        >
                          <a
                            href="https://urlfy.cc/terms"
                            style={{
                              color: '#6366f1',
                              textDecoration: 'none',
                              marginRight: '16px'
                            }}
                          >
                            {lm.terms}
                          </a>
                          <a
                            href="https://urlfy.cc/privacy"
                            style={{
                              color: '#6366f1',
                              textDecoration: 'none'
                            }}
                          >
                            {lm.privacy}
                          </a>
                        </p>
                      </td>
                    </tr>
                  </tbody>
                </table>

                {/* Unsubscribe */}
                <p
                  style={{
                    marginTop: '20px',
                    fontSize: '12px',
                    color: '#94a3b8',
                    textAlign: 'center'
                  }}
                >
                  {lm.unsubscribe}{' '}
                  <a
                    href="https://urlfy.cc/unsubscribe"
                    style={{
                      color: '#6366f1',
                      textDecoration: 'underline'
                    }}
                  >
                    {lm.unsubscribeLink}
                  </a>
                </p>
              </td>
            </tr>
          </tbody>
        </table>
      </body>
    </html>
  );
}
