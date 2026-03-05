import type { EmailMessages } from '../types';
import { EmailLayout } from './email-layout';

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

  return (
    <EmailLayout previewText={t.previewText} locale={locale}>
      <div>
        <h2
          style={{
            margin: '0 0 16px 0',
            fontSize: '24px',
            fontWeight: '600',
            color: '#dc2626',
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
            backgroundColor: '#fee2e2',
            border: '2px solid #ef4444',
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
                      color: '#7f1d1d',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}
                  >
                    Código Curto
                  </p>
                  <p
                    style={{
                      margin: 0,
                      fontSize: '15px',
                      color: '#991b1b',
                      fontFamily: 'monospace',
                      fontWeight: '600'
                    }}
                  >
                    urlfy.cc/{shortCode}
                  </p>
                </td>
              </tr>
              <tr>
                <td style={{ paddingBottom: '12px' }}>
                  <p
                    style={{
                      margin: '0 0 4px 0',
                      fontSize: '13px',
                      fontWeight: '600',
                      color: '#7f1d1d',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}
                  >
                    URL de Destino
                  </p>
                  <p
                    style={{
                      margin: 0,
                      fontSize: '14px',
                      color: '#991b1b',
                      wordBreak: 'break-all'
                    }}
                  >
                    {linkUrl}
                  </p>
                </td>
              </tr>
              <tr>
                <td style={{ paddingBottom: '12px' }}>
                  <p
                    style={{
                      margin: '0 0 4px 0',
                      fontSize: '13px',
                      fontWeight: '600',
                      color: '#7f1d1d',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}
                  >
                    Motivo
                  </p>
                  <p
                    style={{
                      margin: 0,
                      fontSize: '15px',
                      color: '#991b1b',
                      fontWeight: '600'
                    }}
                  >
                    {bannedReason}
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
                      color: '#7f1d1d',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}
                  >
                    Data do Bloqueio
                  </p>
                  <p
                    style={{
                      margin: 0,
                      fontSize: '15px',
                      color: '#991b1b'
                    }}
                  >
                    {formatDate(bannedAt)}
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
          O que isso significa:
        </h3>

        <table
          role="presentation"
          style={{ width: '100%', marginBottom: '24px' }}
        >
          <tbody>
            {[
              'O link não está mais acessível',
              'Visitantes verão uma página de erro',
              'As estatísticas foram preservadas',
              'Você pode contestar essa decisão'
            ].map((item) => (
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
                    <span style={{ color: '#6366f1', marginRight: '8px' }}>
                      •
                    </span>
                    {item}
                  </p>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div
          style={{
            backgroundColor: '#dbeafe',
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
              color: '#1e3a8a'
            }}
          >
            📋 Motivos comuns de bloqueio:
          </p>
          <ul
            style={{
              margin: 0,
              paddingLeft: '20px',
              color: '#1e40af'
            }}
          >
            <li style={{ marginBottom: '6px', fontSize: '14px' }}>
              Conteúdo malicioso ou phishing
            </li>
            <li style={{ marginBottom: '6px', fontSize: '14px' }}>
              Spam ou práticas abusivas
            </li>
            <li style={{ marginBottom: '6px', fontSize: '14px' }}>
              Violação de propriedade intelectual
            </li>
            <li style={{ fontSize: '14px' }}>Conteúdo ilegal ou inadequado</li>
          </ul>
        </div>

        <div style={{ textAlign: 'center', marginTop: '32px' }}>
          <a
            href={appealUrl}
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
            Contestar Bloqueio
          </a>
        </div>

        <p
          style={{
            marginTop: '32px',
            marginBottom: 0,
            fontSize: '14px',
            color: '#64748b',
            lineHeight: '1.6',
            textAlign: 'center'
          }}
        >
          Se você acredita que isso é um erro, nossa equipe está disponível para
          analisar seu caso.
        </p>
      </div>
    </EmailLayout>
  );
}
