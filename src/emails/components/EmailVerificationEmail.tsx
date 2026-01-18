import { EmailLayout } from './EmailLayout';

interface EmailVerificationEmailProps {
  firstName: string;
  verificationUrl: string;
  expiresInMinutes?: number;
}

export function EmailVerificationEmail({
  firstName,
  verificationUrl,
  expiresInMinutes = 30
}: EmailVerificationEmailProps) {
  return (
    <EmailLayout previewText="Confirme seu email para começar a usar o urlfy.cc">
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
          Confirme seu Email
        </h2>

        <p
          style={{
            margin: '0 0 24px 0',
            fontSize: '16px',
            color: '#475569',
            lineHeight: '1.6'
          }}
        >
          Olá, {firstName}! 👋
        </p>

        <p
          style={{
            margin: '0 0 24px 0',
            fontSize: '16px',
            color: '#475569',
            lineHeight: '1.6'
          }}
        >
          Estamos quase lá! Para começar a usar o{' '}
          <strong style={{ color: '#6366f1' }}>urlfy.cc</strong> e aproveitar
          todos os recursos, você precisa confirmar seu endereço de email.
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
            🔐 Segurança
          </p>
          <p
            style={{
              margin: 0,
              fontSize: '14px',
              color: '#1e40af',
              lineHeight: '1.5'
            }}
          >
            Este link expira em <strong>{expiresInMinutes} minutos</strong> e só
            pode ser usado uma vez.
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
            ✓ Confirmar Meu Email
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
            Ou copie e cole este link:
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

        <h3
          style={{
            margin: '32px 0 16px 0',
            fontSize: '18px',
            fontWeight: '600',
            color: '#1e293b'
          }}
        >
          Após confirmar, você poderá:
        </h3>

        <table
          role="presentation"
          style={{ width: '100%', marginBottom: '24px' }}
        >
          <tbody>
            {[
              {
                emoji: '🚀',
                title: 'Criar links ilimitados',
                description: 'Encurte quantos links precisar'
              },
              {
                emoji: '📊',
                title: 'Acessar analytics',
                description: 'Métricas detalhadas em tempo real'
              },
              {
                emoji: '🎨',
                title: 'Personalizar links',
                description: 'Aliases customizados e QR codes'
              },
              {
                emoji: '🔑',
                title: 'Gerar API keys',
                description: 'Integre com suas aplicações'
              }
            ].map((item, index) => (
              <tr key={index}>
                <td
                  style={{
                    width: '40px',
                    verticalAlign: 'top',
                    paddingBottom: '12px'
                  }}
                >
                  <span style={{ fontSize: '24px' }}>{item.emoji}</span>
                </td>
                <td style={{ verticalAlign: 'top', paddingBottom: '12px' }}>
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
            <strong>🤔 Não solicitou este email?</strong> Você pode ignorá-lo
            com segurança. Sua conta não será criada sem a confirmação.
          </p>
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
          Precisa de ajuda? Responda este email ou visite nossa{' '}
          <a
            href="https://urlfy.cc/help"
            style={{
              color: '#6366f1',
              textDecoration: 'none',
              fontWeight: '500'
            }}
          >
            central de ajuda
          </a>
          .
        </p>
      </div>
    </EmailLayout>
  );
}
