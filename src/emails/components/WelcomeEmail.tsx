import { EmailLayout } from './EmailLayout';

interface WelcomeEmailProps {
  firstName: string;
  email: string;
}

export function WelcomeEmail({ firstName, email }: WelcomeEmailProps) {
  return (
    <EmailLayout previewText={`Bem-vindo ao urlfy.cc, ${firstName}! 🎉`}>
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
          Olá, {firstName}! 👋
        </h2>

        <p
          style={{
            margin: '0 0 24px 0',
            fontSize: '16px',
            color: '#475569',
            lineHeight: '1.6'
          }}
        >
          Bem-vindo ao <strong style={{ color: '#6366f1' }}>urlfy.cc</strong>!
          Estamos muito felizes em tê-lo conosco.
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
            Sua conta foi criada com sucesso
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
          O que você pode fazer agora:
        </h3>

        <table
          role="presentation"
          style={{ width: '100%', marginBottom: '24px' }}
        >
          <tbody>
            {[
              {
                emoji: '🔗',
                title: 'Encurtar URLs',
                description:
                  'Crie links curtos e personalizados para compartilhar'
              },
              {
                emoji: '📊',
                title: 'Analisar Métricas',
                description:
                  'Acompanhe cliques, localizações e dispositivos em tempo real'
              },
              {
                emoji: '🎨',
                title: 'Customizar Links',
                description:
                  'Adicione meta tags, QR codes e defina datas de expiração'
              }
            ].map((item, index) => (
              <tr key={index}>
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
            Acessar Dashboard
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
          Precisa de ajuda? Responda este email ou acesse nossa{' '}
          <a
            href="https://urlfy.cc/docs"
            style={{ color: '#6366f1', textDecoration: 'none' }}
          >
            documentação
          </a>
          .
        </p>
      </div>
    </EmailLayout>
  );
}
