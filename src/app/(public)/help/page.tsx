/**
 * ═════════════════════════════════════════════════════════════════════
 * HELP & FAQ PAGE
 * ═════════════════════════════════════════════════════════════════════
 * Support page with frequently asked questions and help documentation.
 * ═════════════════════════════════════════════════════════════════════
 */

import { Mail, MessageCircle } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import type { JSX } from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export const metadata: Metadata = {
  title: 'Ajuda e Suporte - urlfy.cc',
  description: 'Perguntas frequentes e documentação de ajuda do urlfy.cc',
  robots: {
    index: true,
    follow: true
  }
};

export default function HelpPage(): JSX.Element {
  return (
    <div className="container mx-auto max-w-4xl px-4 py-16">
      <div className="space-y-8">
        <div className="space-y-4 text-center">
          <h1 className="text-4xl font-bold tracking-tight">
            Como podemos ajudar?
          </h1>
          <p className="text-lg text-muted-foreground">
            Encontre respostas para as perguntas mais comuns sobre o urlfy.cc
          </p>
        </div>

        {/* FAQ Section */}
        <section className="mt-12">
          <h2 className="mb-6 text-2xl font-semibold">Perguntas Frequentes</h2>

          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="item-1">
              <AccordionTrigger>Como criar um link encurtado?</AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2 text-muted-foreground">
                  <p>Criar um link encurtado é muito simples:</p>
                  <ol className="list-decimal pl-6 space-y-2">
                    <li>
                      Cole sua URL longa no campo de entrada na página inicial
                    </li>
                    <li>Clique no botão "Encurtar"</li>
                    <li>Seu link curto será gerado instantaneamente</li>
                    <li>Copie e compartilhe onde quiser!</li>
                  </ol>
                  <p className="mt-4">
                    Não é necessário criar uma conta para usar o serviço básico.
                  </p>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-2">
              <AccordionTrigger>
                Posso personalizar meu link curto?
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2 text-muted-foreground">
                  <p>
                    Sim! Usuários com conta podem criar aliases customizados.
                    Por exemplo, em vez de{' '}
                    <code className="text-foreground">urlfy.cc/abc123</code>,
                    você pode criar{' '}
                    <code className="text-foreground">
                      urlfy.cc/minha-oferta
                    </code>
                    .
                  </p>
                  <p className="mt-2">
                    Para isso, basta criar uma conta gratuita e usar o campo
                    "Alias customizado" ao criar um link.
                  </p>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-3">
              <AccordionTrigger>
                Como acompanhar as estatísticas dos meus links?
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2 text-muted-foreground">
                  <p>
                    Para acessar analytics detalhados, você precisa estar
                    logado:
                  </p>
                  <ol className="list-decimal pl-6 space-y-2">
                    <li>Faça login na sua conta</li>
                    <li>Acesse o Dashboard</li>
                    <li>Clique em qualquer link para ver suas estatísticas</li>
                  </ol>
                  <p className="mt-4">
                    Você verá informações como número de cliques, países de
                    origem, dispositivos utilizados e muito mais.
                  </p>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-4">
              <AccordionTrigger>
                Posso proteger um link com senha?
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2 text-muted-foreground">
                  <p>
                    Sim, usuários com conta Creator ou Business podem adicionar
                    proteção por senha aos seus links. Quando alguém tentar
                    acessar o link, será solicitada a senha antes do
                    redirecionamento.
                  </p>
                  <p className="mt-2">
                    Isso é útil para compartilhar conteúdo sensível ou restrito
                    com grupos específicos de pessoas.
                  </p>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-5">
              <AccordionTrigger>Os links expiram?</AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2 text-muted-foreground">
                  <p>
                    Por padrão, links gratuitos não expiram. No entanto,
                    usuários com conta podem definir uma data de expiração
                    automática ou um limite de cliques.
                  </p>
                  <p className="mt-2">
                    Após a expiração, o link deixará de funcionar e mostrará uma
                    mensagem informando que expirou.
                  </p>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-6">
              <AccordionTrigger>
                Como gerar um QR Code do meu link?
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2 text-muted-foreground">
                  <p>
                    Todo link criado no urlfy.cc pode gerar um QR Code
                    automaticamente:
                  </p>
                  <ol className="list-decimal pl-6 space-y-2">
                    <li>Acesse o dashboard e clique no link desejado</li>
                    <li>Clique no botão "Gerar QR Code"</li>
                    <li>Escolha o formato (PNG ou SVG) e o tamanho</li>
                    <li>Faça o download e use onde quiser!</li>
                  </ol>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-7">
              <AccordionTrigger>Meus dados estão seguros?</AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2 text-muted-foreground">
                  <p>Sim! Levamos a segurança e privacidade muito a sério:</p>
                  <ul className="list-disc pl-6 space-y-2">
                    <li>Todas as conexões são criptografadas com TLS/SSL</li>
                    <li>Senhas são armazenadas com hash bcrypt</li>
                    <li>Endereços IP são anonimizados imediatamente</li>
                    <li>Somos 100% conformes com LGPD e GDPR</li>
                  </ul>
                  <p className="mt-4">
                    Leia nossa{' '}
                    <Link
                      href="/privacy"
                      className="text-primary hover:underline"
                    >
                      Política de Privacidade
                    </Link>{' '}
                    para mais detalhes.
                  </p>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-8">
              <AccordionTrigger>
                Qual a diferença entre os planos?
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2 text-muted-foreground">
                  <p>Oferecemos três planos:</p>
                  <ul className="list-disc pl-6 space-y-2">
                    <li>
                      <strong className="text-foreground">
                        Hobby (Grátis):
                      </strong>{' '}
                      Até 100 links/mês com analytics básico
                    </li>
                    <li>
                      <strong className="text-foreground">
                        Creator (R$ 29/mês):
                      </strong>{' '}
                      1.000 links/mês, analytics avançado, aliases customizados,
                      proteção por senha
                    </li>
                    <li>
                      <strong className="text-foreground">
                        Business (R$ 99/mês):
                      </strong>{' '}
                      Links ilimitados, API, webhooks, múltiplos usuários
                    </li>
                  </ul>
                  <p className="mt-4">
                    Veja todos os detalhes na{' '}
                    <Link
                      href="/#pricing"
                      className="text-primary hover:underline"
                    >
                      página de preços
                    </Link>
                    .
                  </p>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-9">
              <AccordionTrigger>Posso deletar meus dados?</AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2 text-muted-foreground">
                  <p>
                    Sim, você tem controle total sobre seus dados. Você pode:
                  </p>
                  <ul className="list-disc pl-6 space-y-2">
                    <li>Deletar links individuais a qualquer momento</li>
                    <li>Exportar todos os seus dados em formato JSON</li>
                    <li>
                      Solicitar a exclusão completa da conta e dados associados
                    </li>
                  </ul>
                  <p className="mt-4">
                    Processamos solicitações de exclusão em até 72 horas,
                    conforme a LGPD.
                  </p>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-10">
              <AccordionTrigger>
                Existe uma API para integração?
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2 text-muted-foreground">
                  <p>
                    Sim! Usuários do plano Business têm acesso à nossa API REST
                    completa, permitindo criar, gerenciar e analisar links
                    programaticamente.
                  </p>
                  <p className="mt-2">
                    A documentação da API está disponível em{' '}
                    <code className="text-foreground">api.urlfy.cc/docs</code>{' '}
                    após a criação da sua chave de API no dashboard.
                  </p>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </section>

        {/* Contact Section */}
        <section className="mt-16">
          <h2 className="mb-6 text-2xl font-semibold">
            Ainda precisa de ajuda?
          </h2>

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardContent className="flex flex-col items-center gap-4 p-6 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <Mail className="h-6 w-6 text-primary" />
                </div>
                <div className="space-y-2">
                  <h3 className="font-semibold">Email de Suporte</h3>
                  <p className="text-sm text-muted-foreground">
                    Entre em contato por email e responderemos em até 24 horas.
                  </p>
                </div>
                <Button asChild variant="outline" className="w-full">
                  <a href="mailto:support@urlfy.cc">Enviar email</a>
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="flex flex-col items-center gap-4 p-6 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <MessageCircle className="h-6 w-6 text-primary" />
                </div>
                <div className="space-y-2">
                  <h3 className="font-semibold">Chat ao Vivo</h3>
                  <p className="text-sm text-muted-foreground">
                    Disponível para usuários Business das 9h às 18h (UTC-3).
                  </p>
                </div>
                <Button asChild variant="outline" className="w-full">
                  <Link href="/dashboard">Acessar Dashboard</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </section>
      </div>
    </div>
  );
}
