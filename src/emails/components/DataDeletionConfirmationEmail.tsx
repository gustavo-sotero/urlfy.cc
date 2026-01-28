import type { EmailMessages } from '../types';
import { EmailLayout } from './EmailLayout';

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
                    Data da Solicitação
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
                    Prazo de Conclusão
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
          O que será excluído:
        </h3>

        <table
          role="presentation"
          style={{ width: '100%', marginBottom: '24px' }}
        >
          <tbody>
            {[
              'Todos os links encurtados criados',
              'Histórico de analytics e métricas',
              'Dados de autenticação e perfil',
              'Configurações e preferências',
              'API Keys e tokens de acesso'
            ].map((item, index) => (
              <tr key={index}>
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
                      ✗
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
              💾 Deseja fazer backup dos seus dados?
            </p>
            <p
              style={{
                margin: '0 0 16px 0',
                fontSize: '14px',
                color: '#166534',
                lineHeight: '1.5'
              }}
            >
              Você pode exportar uma cópia completa dos seus dados antes da
              exclusão:
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
              Exportar Meus Dados
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
            <strong>⚠️ Atenção:</strong> Esta ação é{' '}
            <strong>irreversível</strong>. Após a conclusão, não será possível
            recuperar nenhum dado. Se mudou de ideia, responda este email dentro
            do prazo.
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
          Se você não solicitou essa exclusão ou tem dúvidas, entre em contato
          conosco imediatamente através do suporte.
        </p>
      </div>
    </EmailLayout>
  );
}
