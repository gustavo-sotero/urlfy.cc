import { Head } from '@react-email/components';
import * as React from 'react';

interface EmailLayoutProps {
  children: React.ReactNode;
  previewText?: string;
  locale?: string;
}

type EmailTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';
type EmailBulletTone = 'accent' | 'danger' | 'muted';

export const emailTheme = {
  colors: {
    canvas: '#f3f4f6',
    surface: '#ffffff',
    surfaceMuted: '#f8fafc',
    border: '#e5e7eb',
    borderStrong: '#cbd5e1',
    text: '#111827',
    textSecondary: '#374151',
    textMuted: '#6b7280',
    textOnDark: '#f8fafc',
    textOnDarkMuted: '#cbd5e1',
    primary: '#111827',
    accent: '#2563eb',
    accentSoft: '#dbeafe',
    info: '#1d4ed8',
    infoSoft: '#eff6ff',
    success: '#15803d',
    successSoft: '#f0fdf4',
    warning: '#c2410c',
    warningSoft: '#fff7ed',
    danger: '#b91c1c',
    dangerSoft: '#fef2f2'
  },
  fonts: {
    sans: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
    mono: 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace'
  },
  radius: {
    card: '24px',
    panel: '18px',
    pill: '999px',
    button: '12px'
  },
  shadow: '0 24px 60px rgba(15, 23, 42, 0.08)'
} as const;

const layoutMessages = {
  en: {
    kicker: 'Account updates',
    subtitle: 'Short links with clear analytics',
    footerLead:
      'You are receiving this message because you have an account or an active request at urlfy.cc.',
    copyright: `© ${new Date().getFullYear()} urlfy.cc. All rights reserved.`,
    terms: 'Terms of Use',
    privacy: 'Privacy Policy',
    help: 'Help'
  },
  'pt-br': {
    kicker: 'Atualizações da conta',
    subtitle: 'Links curtos com analytics claros',
    footerLead:
      'Você recebeu esta mensagem porque tem uma conta ou uma solicitação ativa no urlfy.cc.',
    copyright: `© ${new Date().getFullYear()} urlfy.cc. Todos os direitos reservados.`,
    terms: 'Termos de Uso',
    privacy: 'Política de Privacidade',
    help: 'Ajuda'
  }
} as const;

const toneStyles: Record<
  EmailTone,
  {
    panel: React.CSSProperties;
    label: React.CSSProperties;
    text: React.CSSProperties;
    markerColor: string;
  }
> = {
  neutral: {
    panel: {
      backgroundColor: emailTheme.colors.surfaceMuted,
      border: `1px solid ${emailTheme.colors.border}`
    },
    label: {
      color: emailTheme.colors.text,
      fontWeight: 700
    },
    text: {
      color: emailTheme.colors.textSecondary
    },
    markerColor: emailTheme.colors.primary
  },
  info: {
    panel: {
      backgroundColor: emailTheme.colors.infoSoft,
      border: `1px solid #bfdbfe`
    },
    label: {
      color: emailTheme.colors.info,
      fontWeight: 700
    },
    text: {
      color: '#1e40af'
    },
    markerColor: emailTheme.colors.info
  },
  success: {
    panel: {
      backgroundColor: emailTheme.colors.successSoft,
      border: '1px solid #86efac'
    },
    label: {
      color: emailTheme.colors.success,
      fontWeight: 700
    },
    text: {
      color: '#166534'
    },
    markerColor: emailTheme.colors.success
  },
  warning: {
    panel: {
      backgroundColor: emailTheme.colors.warningSoft,
      border: '1px solid #fdba74'
    },
    label: {
      color: emailTheme.colors.warning,
      fontWeight: 700
    },
    text: {
      color: '#9a3412'
    },
    markerColor: emailTheme.colors.warning
  },
  danger: {
    panel: {
      backgroundColor: emailTheme.colors.dangerSoft,
      border: '1px solid #fca5a5'
    },
    label: {
      color: emailTheme.colors.danger,
      fontWeight: 700
    },
    text: {
      color: '#991b1b'
    },
    markerColor: emailTheme.colors.danger
  }
};

const bulletToneColors: Record<EmailBulletTone, string> = {
  accent: emailTheme.colors.accent,
  danger: emailTheme.colors.danger,
  muted: emailTheme.colors.primary
};

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
          backgroundColor: emailTheme.colors.canvas,
          fontFamily: emailTheme.fonts.sans
        }}
      >
        {previewText ? (
          <div
            style={{
              display: 'none',
              maxHeight: 0,
              overflow: 'hidden',
              fontSize: '1px',
              lineHeight: '1px',
              color: emailTheme.colors.canvas
            }}
          >
            {previewText}
          </div>
        ) : null}

        <table
          role="presentation"
          style={{
            width: '100%',
            backgroundColor: emailTheme.colors.canvas,
            padding: '40px 16px'
          }}
        >
          <tbody>
            <tr>
              <td align="center">
                <table
                  role="presentation"
                  style={{
                    width: '100%',
                    maxWidth: '600px',
                    backgroundColor: emailTheme.colors.surface,
                    borderRadius: emailTheme.radius.card,
                    overflow: 'hidden',
                    border: `1px solid ${emailTheme.colors.border}`,
                    boxShadow: emailTheme.shadow
                  }}
                >
                  <tbody>
                    <tr>
                      <td
                        style={{
                          height: '6px',
                          backgroundColor: emailTheme.colors.accent,
                          fontSize: 0,
                          lineHeight: 0
                        }}
                      />
                    </tr>
                    <tr>
                      <td
                        style={{
                          backgroundColor: emailTheme.colors.primary,
                          padding: '32px 32px 28px',
                          textAlign: 'left'
                        }}
                      >
                        <p
                          style={{
                            margin: '0 0 12px 0',
                            fontSize: '11px',
                            lineHeight: '1',
                            letterSpacing: '0.16em',
                            textTransform: 'uppercase',
                            color: emailTheme.colors.textOnDarkMuted,
                            fontWeight: 700
                          }}
                        >
                          {lm.kicker}
                        </p>
                        <h1
                          style={{
                            margin: '0 0 8px 0',
                            fontSize: '32px',
                            lineHeight: '1.1',
                            letterSpacing: '-0.03em',
                            color: emailTheme.colors.textOnDark,
                            fontWeight: 800
                          }}
                        >
                          urlfy.cc
                        </h1>
                        <p
                          style={{
                            margin: 0,
                            fontSize: '15px',
                            lineHeight: '1.6',
                            color: emailTheme.colors.textOnDarkMuted
                          }}
                        >
                          {lm.subtitle}
                        </p>
                      </td>
                    </tr>
                    <tr>
                      <td style={{ padding: '32px' }}>{children}</td>
                    </tr>
                    <tr>
                      <td
                        style={{
                          padding: '24px 32px 32px',
                          backgroundColor: emailTheme.colors.surfaceMuted,
                          borderTop: `1px solid ${emailTheme.colors.border}`
                        }}
                      >
                        <p
                          style={{
                            margin: '0 0 12px 0',
                            fontSize: '13px',
                            lineHeight: '1.6',
                            color: emailTheme.colors.textMuted
                          }}
                        >
                          {lm.footerLead}
                        </p>
                        <p
                          style={{
                            margin: '0 0 12px 0',
                            fontSize: '13px',
                            lineHeight: '1.6'
                          }}
                        >
                          <a
                            href="https://urlfy.cc/terms"
                            style={{
                              color: emailTheme.colors.accent,
                              textDecoration: 'none',
                              marginRight: '16px'
                            }}
                          >
                            {lm.terms}
                          </a>
                          <a
                            href="https://urlfy.cc/privacy"
                            style={{
                              color: emailTheme.colors.accent,
                              textDecoration: 'none',
                              marginRight: '16px'
                            }}
                          >
                            {lm.privacy}
                          </a>
                          <a
                            href="https://urlfy.cc/help"
                            style={{
                              color: emailTheme.colors.accent,
                              textDecoration: 'none'
                            }}
                          >
                            {lm.help}
                          </a>
                        </p>
                        <p
                          style={{
                            margin: 0,
                            fontSize: '12px',
                            lineHeight: '1.5',
                            color: emailTheme.colors.textMuted
                          }}
                        >
                          {lm.copyright}
                        </p>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>
      </body>
    </html>
  );
}

export function EmailHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2
      style={{
        margin: '0 0 16px 0',
        fontSize: '30px',
        lineHeight: '1.2',
        letterSpacing: '-0.03em',
        color: emailTheme.colors.text,
        fontWeight: 800
      }}
    >
      {children}
    </h2>
  );
}

export function EmailSubheading({ children }: { children: React.ReactNode }) {
  return (
    <h3
      style={{
        margin: '28px 0 12px 0',
        fontSize: '18px',
        lineHeight: '1.4',
        color: emailTheme.colors.text,
        fontWeight: 700
      }}
    >
      {children}
    </h3>
  );
}

export function EmailParagraph({
  children,
  subtle = false,
  mono = false,
  center = false
}: {
  children: React.ReactNode;
  subtle?: boolean;
  mono?: boolean;
  center?: boolean;
}) {
  return (
    <p
      style={{
        margin: '0 0 16px 0',
        fontSize: '16px',
        lineHeight: '1.7',
        color: subtle
          ? emailTheme.colors.textMuted
          : emailTheme.colors.textSecondary,
        textAlign: center ? 'center' : 'left',
        fontFamily: mono ? emailTheme.fonts.mono : emailTheme.fonts.sans
      }}
    >
      {children}
    </p>
  );
}

export function EmailButtonLink({
  href,
  children,
  align = 'center'
}: {
  href: string;
  children: React.ReactNode;
  align?: 'left' | 'center';
}) {
  return (
    <div style={{ margin: '28px 0', textAlign: align }}>
      <a
        href={href}
        style={{
          display: 'inline-block',
          padding: '14px 24px',
          backgroundColor: emailTheme.colors.primary,
          color: emailTheme.colors.textOnDark,
          textDecoration: 'none',
          borderRadius: emailTheme.radius.button,
          fontSize: '15px',
          lineHeight: '1',
          fontWeight: 700,
          boxShadow: '0 10px 24px rgba(17, 24, 39, 0.18)'
        }}
      >
        {children}
      </a>
    </div>
  );
}

export function EmailPanel({
  title,
  tone = 'neutral',
  children
}: {
  title?: string;
  tone?: EmailTone;
  children: React.ReactNode;
}) {
  const toneStyle = toneStyles[tone];

  return (
    <div
      style={{
        ...toneStyle.panel,
        borderRadius: emailTheme.radius.panel,
        padding: '18px 20px',
        margin: '20px 0'
      }}
    >
      {title ? (
        <p
          style={{
            ...toneStyle.label,
            margin: '0 0 10px 0',
            fontSize: '12px',
            lineHeight: '1.4',
            textTransform: 'uppercase',
            letterSpacing: '0.12em'
          }}
        >
          {title}
        </p>
      ) : null}
      <div
        style={{
          ...toneStyle.text,
          fontSize: '14px',
          lineHeight: '1.7'
        }}
      >
        {children}
      </div>
    </div>
  );
}

export function EmailDataList({
  rows,
  tone = 'neutral'
}: {
  rows: Array<{
    label: string;
    value: React.ReactNode;
  }>;
  tone?: EmailTone;
}) {
  const toneStyle = toneStyles[tone];

  return (
    <table
      role="presentation"
      style={{ width: '100%', borderCollapse: 'collapse' }}
    >
      <tbody>
        {rows.map((row, index) => (
          <tr key={row.label}>
            <td
              style={{
                paddingBottom: index === rows.length - 1 ? '0' : '14px',
                verticalAlign: 'top'
              }}
            >
              <p
                style={{
                  ...toneStyle.label,
                  margin: '0 0 4px 0',
                  fontSize: '12px',
                  lineHeight: '1.4',
                  textTransform: 'uppercase',
                  letterSpacing: '0.12em'
                }}
              >
                {row.label}
              </p>
              <div
                style={{
                  ...toneStyle.text,
                  fontSize: '14px',
                  lineHeight: '1.6'
                }}
              >
                {row.value}
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function EmailLinkBlock({ label, url }: { label: string; url: string }) {
  return (
    <div
      style={{
        margin: '20px 0',
        padding: '18px 20px',
        borderRadius: emailTheme.radius.panel,
        backgroundColor: emailTheme.colors.surfaceMuted,
        border: `1px solid ${emailTheme.colors.border}`
      }}
    >
      <p
        style={{
          margin: '0 0 10px 0',
          fontSize: '12px',
          lineHeight: '1.4',
          textTransform: 'uppercase',
          letterSpacing: '0.12em',
          color: emailTheme.colors.text,
          fontWeight: 700
        }}
      >
        {label}
      </p>
      <p
        style={{
          margin: 0,
          color: emailTheme.colors.accent,
          wordBreak: 'break-all',
          fontFamily: emailTheme.fonts.mono,
          fontSize: '13px',
          lineHeight: '1.7'
        }}
      >
        {url}
      </p>
    </div>
  );
}

export function EmailBulletList({
  items,
  tone = 'accent'
}: {
  items: React.ReactNode[];
  tone?: EmailBulletTone;
}) {
  const markerColor = bulletToneColors[tone];

  return (
    <table
      role="presentation"
      style={{
        width: '100%',
        borderCollapse: 'collapse',
        marginBottom: '20px'
      }}
    >
      <tbody>
        {items.map((item, index) => (
          <tr
            key={
              React.isValidElement(item) && item.key != null
                ? String(item.key)
                : String(item)
            }
          >
            <td
              style={{
                width: '18px',
                verticalAlign: 'top',
                paddingTop: '7px',
                paddingBottom: index === items.length - 1 ? 0 : '10px'
              }}
            >
              <span
                style={{
                  display: 'block',
                  width: '8px',
                  height: '8px',
                  borderRadius: emailTheme.radius.pill,
                  backgroundColor: markerColor
                }}
              />
            </td>
            <td
              style={{
                paddingBottom: index === items.length - 1 ? 0 : '10px',
                fontSize: '15px',
                lineHeight: '1.7',
                color: emailTheme.colors.textSecondary
              }}
            >
              {item}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function EmailProgressBar({
  value,
  tone = 'warning'
}: {
  value: number;
  tone?: 'warning' | 'danger';
}) {
  const normalizedValue = Math.max(0, Math.min(value, 100));
  const fillColor =
    tone === 'danger' ? emailTheme.colors.danger : emailTheme.colors.warning;

  return (
    <div
      style={{
        width: '100%',
        height: '10px',
        backgroundColor: '#e5e7eb',
        borderRadius: emailTheme.radius.pill,
        overflow: 'hidden',
        margin: '16px 0 0 0'
      }}
    >
      <div
        style={{
          width: `${normalizedValue}%`,
          height: '100%',
          backgroundColor: fillColor,
          borderRadius: emailTheme.radius.pill
        }}
      />
    </div>
  );
}
