/**
 * ═════════════════════════════════════════════════════════════════════
 * TERMS OF SERVICE PAGE
 * ═════════════════════════════════════════════════════════════════════
 * Legal terms and conditions for using urlfy.cc services.
 * ═════════════════════════════════════════════════════════════════════
 */

import type { Metadata } from 'next';
import type { JSX } from 'react';
import { RevealSection } from '@/components/shared/reveal-section';

export const metadata: Metadata = {
  title: 'Termos de Uso - urlfy.cc',
  description: 'Termos e condições de uso do serviço urlfy.cc',
  robots: {
    index: true,
    follow: true
  }
};

export default function TermsPage(): JSX.Element {
  return (
    <div className="container mx-auto max-w-4xl px-4 py-16 scroll-smooth">
      <RevealSection>
        <article className="prose prose-slate dark:prose-invert max-w-none">
          <h1 className="text-4xl font-bold tracking-tight">Termos de Uso</h1>

          <p className="text-muted-foreground">
            Última atualização:{' '}
            {new Date().toLocaleDateString('pt-BR', {
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}
          </p>

          <section className="mt-8">
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              1. Aceitação dos Termos
            </h2>
            <p>
              Ao acessar e usar o urlfy.cc ("Serviço"), você concorda em estar
              vinculado a estes Termos de Uso. Se você não concordar com
              qualquer parte destes termos, não poderá usar nosso Serviço.
            </p>
            <div className="mt-4 p-4 bg-primary/5 border border-primary/20 rounded-lg">
              <p className="font-semibold text-foreground">
                ⚠️ Natureza do Serviço
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                O urlfy.cc é um{' '}
                <strong>
                  projeto pessoal de pesquisa e desenvolvimento e de
                  demonstração técnica
                </strong>
                , não um produto comercial. Este serviço é fornecido
                <strong> "AS IS"</strong> (como está) para fins de portfólio e
                aprendizado. Não há garantias de disponibilidade, persistência
                de dados ou SLA (Service Level Agreement).
              </p>
            </div>
          </section>

          <section className="mt-8">
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              2. Descrição do Serviço
            </h2>
            <p>
              O urlfy.cc é um serviço de encurtamento de URLs desenvolvido como
              projeto de portfólio que permite aos usuários transformar links
              longos em versões mais curtas e gerenciáveis. O Serviço inclui,
              mas não se limita a:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Criação de links encurtados</li>
              <li>Analytics e estatísticas de cliques</li>
              <li>Personalização de links (aliases customizados)</li>
              <li>Proteção por senha e expiração de links</li>
              <li>Geração de QR Codes</li>
            </ul>
            <p className="mt-4 text-sm text-muted-foreground">
              <strong>Importante:</strong> Este serviço pode ser descontinuado,
              modificado ou ter seus dados apagados a qualquer momento sem aviso
              prévio, visto que se trata de um ambiente de demonstração.
            </p>
          </section>

          <section className="mt-8">
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              3. Contas de Usuário
            </h2>
            <h3 className="text-xl font-semibold mt-6 mb-3">3.1 Registro</h3>
            <p>
              Para acessar determinados recursos, você pode precisar criar uma
              conta. Você concorda em fornecer informações precisas, atuais e
              completas durante o processo de registro.
            </p>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              3.2 Segurança da Conta
            </h3>
            <p>
              Você é responsável por manter a confidencialidade de sua senha e
              conta. Você concorda em nos notificar imediatamente sobre qualquer
              uso não autorizado de sua conta.
            </p>
          </section>

          <section className="mt-8">
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              4. Uso Aceitável
            </h2>
            <p>
              Este é um serviço de demonstração para fins educacionais. Você
              concorda em utilizá-lo de forma responsável e ética.
            </p>
            <p className="mt-4">Você concorda em NÃO usar o Serviço para:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                Criar links para conteúdo ilegal, malicioso, phishing ou spam
              </li>
              <li>Distribuir malware, vírus ou qualquer código prejudicial</li>
              <li>Violar direitos de propriedade intelectual de terceiros</li>
              <li>Assediar, abusar ou prejudicar outras pessoas</li>
              <li>
                Coletar informações pessoais de outros usuários sem
                consentimento
              </li>
              <li>Usar automação excessiva ou técnicas de scraping</li>
              <li>
                Sobrecarregar ou interferir com a infraestrutura do Serviço
              </li>
            </ul>
            <p className="mt-4 text-sm text-muted-foreground">
              <strong>Nota:</strong> Por se tratar de um projeto pessoal de
              pesquisa e desenvolvimento, o uso deve estar limitado a fins de
              teste e demonstração. Uso comercial intensivo não é recomendado.
            </p>
          </section>

          <section className="mt-8">
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              5. Conteúdo do Usuário
            </h2>
            <h3 className="text-xl font-semibold mt-6 mb-3">
              5.1 Responsabilidade
            </h3>
            <p>
              Você mantém a propriedade e é exclusivamente responsável por todos
              os links e conteúdos que criar através do Serviço.
            </p>

            <h3 className="text-xl font-semibold mt-6 mb-3">5.2 Licença</h3>
            <p>
              Ao criar um link, você nos concede uma licença mundial, não
              exclusiva e isenta de royalties para hospedar, armazenar,
              transferir e exibir esse link para fornecer o Serviço.
            </p>
          </section>

          <section className="mt-8">
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              6. Violação e Encerramento
            </h2>
            <p>
              Reservamo-nos o direito de suspender ou encerrar sua conta e
              acesso ao Serviço, sem aviso prévio, por violação destes Termos ou
              por qualquer outro motivo que consideremos apropriado.
            </p>
          </section>

          <section className="mt-8">
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              7. Limitação de Responsabilidade
            </h2>
            <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
              <p className="font-semibold text-foreground mb-2">
                Isenção de Garantias (Projeto pessoal de pesquisa e
                desenvolvimento)
              </p>
              <p>
                O Serviço é fornecido <strong>"COMO ESTÁ"</strong> e{' '}
                <strong>"CONFORME DISPONÍVEL"</strong> sem garantias de qualquer
                tipo, expressas ou implícitas, incluindo, mas não se limitando
                a:
              </p>
              <ul className="list-disc pl-6 space-y-2 mt-2">
                <li>
                  Disponibilidade contínua ou uptime (não há SLA definido)
                </li>
                <li>
                  Persistência de dados (backups podem não existir ou serem
                  incompletos)
                </li>
                <li>Correção de bugs ou manutenção regular</li>
                <li>Performance consistente</li>
                <li>Suporte técnico</li>
              </ul>
            </div>
            <p className="mt-4">
              Como este é um <strong>projeto de portfólio</strong>, não
              garantimos que o Serviço estará sempre disponível, ininterrupto ou
              livre de erros. Em nenhuma circunstância seremos responsáveis por
              danos indiretos, incidentais, consequentes ou perda de dados.
            </p>
            <p className="mt-4 text-sm text-muted-foreground">
              <strong>Recomendação:</strong> Não utilize este serviço para links
              críticos de negócio ou que requerem garantias de disponibilidade.
            </p>
          </section>

          <section className="mt-8">
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              8. Modificações dos Termos
            </h2>
            <p>
              Reservamo-nos o direito de modificar estes Termos a qualquer
              momento. Notificaremos os usuários sobre mudanças significativas
              através do Serviço ou por e-mail. O uso continuado do Serviço após
              tais modificações constitui aceitação dos novos Termos.
            </p>
          </section>

          <section className="mt-8">
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              9. Lei Aplicável
            </h2>
            <p>
              Estes Termos são regidos pelas leis do Brasil. Qualquer disputa
              relacionada a estes Termos será resolvida nos tribunais
              competentes do Brasil.
            </p>
          </section>

          <section className="mt-8">
            <h2 className="text-2xl font-semibold mt-8 mb-4">10. Contato</h2>
            <p>
              Para questões sobre estes Termos, entre em contato conosco através
              da nossa{' '}
              <a href="/contact" className="text-primary hover:underline">
                página de contato
              </a>
            </p>
          </section>
        </article>
      </RevealSection>
    </div>
  );
}
