/**
 * ═════════════════════════════════════════════════════════════════════
 * PRIVACY POLICY PAGE
 * ═════════════════════════════════════════════════════════════════════
 * Privacy policy and data protection information for urlfy.cc.
 * LGPD/GDPR compliant disclosure.
 * ═════════════════════════════════════════════════════════════════════
 */

import { RevealSection } from '@/components/shared/reveal-section';
import type { Metadata } from 'next';
import type { JSX } from 'react';

export const metadata: Metadata = {
  title: 'Política de Privacidade - urlfy.cc',
  description:
    'Política de privacidade e proteção de dados do urlfy.cc - LGPD compliant',
  robots: {
    index: true,
    follow: true
  }
};

export default function PrivacyPage(): JSX.Element {
  return (
    <div className="container mx-auto max-w-4xl px-4 py-16 scroll-smooth">
      <RevealSection>
        <article className="prose prose-slate dark:prose-invert max-w-none">
          <h1 className="text-4xl font-bold tracking-tight">
            Política de Privacidade
          </h1>

          <p className="text-muted-foreground">
            Última atualização:{' '}
            {new Date().toLocaleDateString('pt-BR', {
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}
          </p>

          <section className="mt-8">
            <h2 className="text-2xl font-semibold mt-8 mb-4">1. Introdução</h2>
            <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg mb-4">
              <p className="font-semibold text-foreground">
                📚 Contexto: Projeto pessoal de pesquisa e desenvolvimento
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                O urlfy.cc é um{' '}
                <strong>projeto de portfólio e demonstração técnica</strong>,
                não um produto comercial. Os dados coletados são utilizados
                exclusivamente para demonstração das funcionalidades de
                analytics e para aprendizado sobre compliance (LGPD/GDPR).
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                <strong>Importante:</strong> Por se tratar de um ambiente de
                demonstração, dados podem ser periodicamente apagados ou
                modificados sem aviso prévio. Não recomendamos o uso deste
                serviço para links críticos de negócio.
              </p>
            </div>
            <p>
              O urlfy.cc ("nós", "nosso" ou "Serviço") respeita sua privacidade
              e está comprometido em proteger seus dados pessoais. Esta Política
              de Privacidade explica como coletamos, usamos, armazenamos e
              protegemos suas informações em conformidade com a Lei Geral de
              Proteção de Dados (LGPD) e regulamentações internacionais como
              GDPR.
            </p>
          </section>

          <section className="mt-8">
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              2. Dados que Coletamos
            </h2>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              2.1 Informações de Conta
            </h3>
            <p>Quando você cria uma conta, coletamos:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Nome e endereço de e-mail</li>
              <li>Senha (armazenada com criptografia bcrypt)</li>
              <li>Informações de perfil OAuth (se usar login social)</li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              2.2 Dados de Analytics
            </h3>
            <p>Para fornecer estatísticas sobre seus links, coletamos:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                Endereço IP (anonimizado através de hash SHA-256 imediato)
              </li>
              <li>País e cidade (através de geolocalização offline)</li>
              <li>Navegador, sistema operacional e tipo de dispositivo</li>
              <li>URL de referência (origem do clique)</li>
              <li>Timestamp do acesso</li>
            </ul>
            <p className="mt-4">
              <strong className="text-foreground">Importante:</strong> Nunca
              armazenamos seu endereço IP em texto claro. Ele é convertido em um
              hash irreversível imediatamente após a coleta.
            </p>

            <h3 className="text-xl font-semibold mt-6 mb-3">2.3 Cookies</h3>
            <p>Utilizamos cookies para:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Manter sua sessão ativa (cookies essenciais)</li>
              <li>Lembrar suas preferências de tema</li>
              <li>Proteger contra CSRF (cookies de segurança)</li>
            </ul>
          </section>

          <section className="mt-8">
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              3. Como Usamos Seus Dados
            </h2>
            <p>Utilizamos seus dados para:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Fornecer e manter o Serviço</li>
              <li>Gerar estatísticas e analytics sobre seus links</li>
              <li>Autenticar e gerenciar sua conta</li>
              <li>Enviar notificações importantes sobre o Serviço</li>
              <li>Detectar e prevenir fraudes e abusos</li>
              <li>Cumprir obrigações legais</li>
            </ul>
            <p className="mt-4 text-sm text-muted-foreground">
              <strong>Contexto de Pesquisa:</strong> Os dados coletados também
              são utilizados para demonstrar competências técnicas em
              implementação de sistemas de analytics com privacidade (IP
              hashing, anonimização, LGPD compliance).
            </p>
          </section>

          <section className="mt-8">
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              4. Base Legal (LGPD)
            </h2>
            <p>Processamos seus dados com base em:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong>Consentimento:</strong> Quando você cria uma conta ou
                aceita cookies
              </li>
              <li>
                <strong>Execução de contrato:</strong> Para fornecer o Serviço
                solicitado
              </li>
              <li>
                <strong>Legítimo interesse:</strong> Para segurança, prevenção
                de fraude e melhorias do Serviço
              </li>
              <li>
                <strong>Obrigação legal:</strong> Quando exigido por lei
              </li>
            </ul>
          </section>

          <section className="mt-8">
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              5. Compartilhamento de Dados
            </h2>
            <p>
              Não vendemos seus dados pessoais. Podemos compartilhar dados
              apenas com:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong>Provedores de serviço:</strong> Empresas que nos ajudam
                a operar o Serviço (hospedagem, email)
              </li>
              <li>
                <strong>Autoridades legais:</strong> Quando exigido por lei ou
                para proteger direitos legais
              </li>
            </ul>
          </section>

          <section className="mt-8">
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              6. Retenção de Dados
            </h2>
            <p>Mantemos seus dados pelo seguinte período:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong>Dados de conta:</strong> Enquanto sua conta estiver
                ativa
              </li>
              <li>
                <strong>Analytics brutos:</strong> 90 dias (depois apenas dados
                agregados)
              </li>
              <li>
                <strong>Backups:</strong> Até 30 dias após exclusão
              </li>
            </ul>
            <div className="mt-4 p-4 bg-primary/5 border border-primary/20 rounded-lg">
              <p className="font-semibold text-foreground text-sm">
                ⚠️ Aviso: Ambiente de Demonstração
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Como este é um projeto pessoal de pesquisa e desenvolvimento,
                dados podem ser apagados periodicamente (incluindo antes dos
                períodos descritos acima) para demonstrações, testes ou
                manutenção. Recomendamos não armazenar links críticos ou dados
                importantes neste serviço.
              </p>
            </div>
          </section>

          <section className="mt-8">
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              7. Seus Direitos (LGPD/GDPR)
            </h2>
            <p>Você tem o direito de:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong>Acesso:</strong> Solicitar uma cópia de todos os seus
                dados
              </li>
              <li>
                <strong>Retificação:</strong> Corrigir dados incorretos ou
                incompletos
              </li>
              <li>
                <strong>Exclusão:</strong> Solicitar a remoção de seus dados
              </li>
              <li>
                <strong>Portabilidade:</strong> Receber seus dados em formato
                estruturado
              </li>
              <li>
                <strong>Revogação de consentimento:</strong> Retirar
                consentimento a qualquer momento
              </li>
              <li>
                <strong>Oposição:</strong> Opor-se ao processamento de seus
                dados
              </li>
            </ul>
            <p className="mt-4">
              Para exercer esses direitos, acesse as configurações da sua conta
              ou entre em contato através da{' '}
              <a href="/contact" className="text-primary hover:underline">
                nossa página de contato
              </a>
              . Responderemos em até 72 horas conforme exigido pela LGPD.
            </p>
          </section>

          <section className="mt-8">
            <h2 className="text-2xl font-semibold mt-8 mb-4">8. Segurança</h2>
            <p>
              Implementamos medidas técnicas e organizacionais para proteger
              seus dados:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Criptografia TLS/SSL em todas as conexões</li>
              <li>Senhas armazenadas com bcrypt (hashing seguro)</li>
              <li>Anonimização imediata de endereços IP</li>
              <li>Backups criptografados</li>
              <li>Controles de acesso rigorosos</li>
              <li>Monitoramento contínuo de segurança</li>
            </ul>
          </section>

          <section className="mt-8">
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              9. Transferências Internacionais
            </h2>
            <p>
              Seus dados são armazenados em servidores localizados no Brasil.
              Caso seja necessário transferir dados internacionalmente,
              garantimos proteções adequadas conforme exigido pela LGPD.
            </p>
          </section>

          <section className="mt-8">
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              10. Menores de Idade
            </h2>
            <p>
              O Serviço não é direcionado a menores de 18 anos. Não coletamos
              intencionalmente dados de menores. Se tomarmos conhecimento de
              tais dados, os excluiremos imediatamente.
            </p>
          </section>

          <section className="mt-8">
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              11. Alterações nesta Política
            </h2>
            <p>
              Podemos atualizar esta Política periodicamente. Notificaremos
              sobre mudanças significativas através do Serviço ou por e-mail.
              Recomendamos revisar esta Política regularmente.
            </p>
          </section>

          <section className="mt-8">
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              12. Contato e DPO
            </h2>
            <p>
              Para questões sobre privacidade ou para exercer seus direitos,
              entre em contato através da{' '}
              <a href="/contact" className="text-primary hover:underline">
                nossa página de contato
              </a>
              .
            </p>
          </section>

          <section className="mt-8">
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              13. Autoridade de Supervisão
            </h2>
            <p>
              Se não estivermos satisfeitos com nossa resposta, você tem o
              direito de apresentar uma reclamação à Autoridade Nacional de
              Proteção de Dados (ANPD) no Brasil.
            </p>
          </section>
        </article>
      </RevealSection>
    </div>
  );
}
