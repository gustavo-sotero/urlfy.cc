import type { EmailMessages } from '../types';
import { EmailLayout } from './email-layout';

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
  return (
    <EmailLayout previewText={t.previewText} locale={locale}>
      <div>
        <h2
          style={{
            margin: '0 0 16px 0',
            fontSize: '24px',
            fontWeight: '600',
            color: '#f59e0b',
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

        {/* Progress Bar */}
        <div
          style={{
            backgroundColor: '#f1f5f9',
            borderRadius: '12px',
            padding: '24px',
            marginBottom: '24px'
          }}
        >
          <div style={{ marginBottom: '16px' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '8px'
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#334155'
                }}
              >
                Uso Atual
              </p>
              <p
                style={{
                  margin: 0,
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#6366f1'
                }}
              >
                {currentUsage} / {quotaLimit} links
              </p>
            </div>

            {/* Progress Bar */}
            <div
              style={{
                width: '100%',
                height: '12px',
                backgroundColor: '#e2e8f0',
                borderRadius: '999px',
                overflow: 'hidden'
              }}
            >
              <div
                style={{
                  width: `${Math.min(percentUsed, 100)}%`,
                  height: '100%',
                  backgroundColor: percentUsed >= 90 ? '#ef4444' : '#f59e0b',
                  transition: 'width 0.3s ease'
                }}
              />
            </div>
          </div>

          <p
            style={{
              margin: 0,
              fontSize: '24px',
              fontWeight: '700',
              color: percentUsed >= 90 ? '#dc2626' : '#f59e0b',
              textAlign: 'center'
            }}
          >
            {percentUsed.toFixed(1)}%
          </p>
        </div>

        <div
          style={{
            backgroundColor: percentUsed >= 90 ? '#fee2e2' : '#fef3c7',
            border: `2px solid ${percentUsed >= 90 ? '#ef4444' : '#f59e0b'}`,
            borderRadius: '8px',
            padding: '20px',
            marginBottom: '24px'
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: '15px',
              color: percentUsed >= 90 ? '#7f1d1d' : '#78350f',
              lineHeight: '1.6'
            }}
          >
            {percentUsed >= 90 ? (
              <>
                <strong>🚨 Atenção!</strong> Você tem apenas{' '}
                <strong>{quotaLimit - currentUsage} links</strong> restantes.
                Após atingir o limite, não será possível criar novos links.
              </>
            ) : (
              <>
                <strong>💡 Aviso:</strong> Você está se aproximando do seu
                limite. Considere fazer upgrade para continuar criando links sem
                interrupções.
              </>
            )}
          </p>
        </div>

        <h3
          style={{
            margin: '24px 0 16px 0',
            fontSize: '18px',
            fontWeight: '600',
            color: '#1e293b'
          }}
        >
          Opções disponíveis:
        </h3>

        <table
          role="presentation"
          style={{ width: '100%', marginBottom: '24px' }}
        >
          <tbody>
            <tr>
              <td
                style={{
                  backgroundColor: '#f8fafc',
                  borderRadius: '8px',
                  padding: '16px',
                  marginBottom: '12px'
                }}
              >
                <p
                  style={{
                    margin: '0 0 8px 0',
                    fontSize: '16px',
                    fontWeight: '600',
                    color: '#1e293b'
                  }}
                >
                  🗑️ Limpar links antigos
                </p>
                <p
                  style={{
                    margin: 0,
                    fontSize: '14px',
                    color: '#64748b',
                    lineHeight: '1.5'
                  }}
                >
                  Delete links inativos ou expirados para liberar espaço
                </p>
              </td>
            </tr>
            <tr>
              <td style={{ height: '12px' }} />
            </tr>
            <tr>
              <td
                style={{
                  backgroundColor: '#ede9fe',
                  borderRadius: '8px',
                  padding: '16px',
                  border: '2px solid #8b5cf6'
                }}
              >
                <p
                  style={{
                    margin: '0 0 8px 0',
                    fontSize: '16px',
                    fontWeight: '600',
                    color: '#5b21b6'
                  }}
                >
                  🚀 Fazer Upgrade
                </p>
                <p
                  style={{
                    margin: 0,
                    fontSize: '14px',
                    color: '#6d28d9',
                    lineHeight: '1.5'
                  }}
                >
                  Desbloqueie mais links + recursos premium
                </p>
              </td>
            </tr>
          </tbody>
        </table>

        <div style={{ textAlign: 'center', marginTop: '32px' }}>
          <a
            href={upgradeUrl}
            style={{
              display: 'inline-block',
              padding: '14px 32px',
              background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
              color: '#ffffff',
              textDecoration: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: '600',
              boxShadow: '0 4px 6px rgba(99, 102, 241, 0.25)'
            }}
          >
            Ver Planos
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
          Precisa de ajuda? Nosso suporte está disponível 24/7.
        </p>
      </div>
    </EmailLayout>
  );
}
