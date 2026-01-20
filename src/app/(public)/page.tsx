/**
 * ═════════════════════════════════════════════════════════════════════
 * LANDING PAGE - Homepage
 * ═════════════════════════════════════════════════════════════════════
 * Main landing page with Hero, Features, Pricing, About, and CTA sections.
 * ═════════════════════════════════════════════════════════════════════
 */

import { BarChart3, Check, Shield, Zap } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import type { JSX } from 'react';
import { LinkForm } from '@/components/forms/link-form';
import { HeroActions } from '@/components/home/hero-actions';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from '@/components/ui/card';

export const metadata: Metadata = {
  title: 'urlfy.cc - Encurtador de URLs Rápido e Seguro',
  description:
    'Transforme URLs longas em links curtos e memoráveis. Com analytics detalhados, proteção por senha e conformidade LGPD.',
  openGraph: {
    title: 'urlfy.cc - Encurtador de URLs',
    description: 'Rápido, simples e poderoso',
    type: 'website'
  }
};

export default function LandingPage(): JSX.Element {
  return (
    <>
      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20">
        <div className="mx-auto max-w-4xl space-y-8 text-center">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border bg-muted px-4 py-2 text-sm">
              <Zap className="h-4 w-4 text-primary" />
              <span>Rápido, simples e poderoso</span>
            </div>
            <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
              Encurte seus links
              <br />
              <span className="text-primary">com inteligência</span>
            </h1>
            <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
              Transforme URLs longas em links curtos e memoráveis. Com analytics
              detalhados, proteção por senha e muito mais.
            </p>
          </div>

          {/* Link Form */}
          <div className="mx-auto max-w-2xl">
            <LinkForm variant="landing" />
          </div>

          <p className="text-sm text-muted-foreground">
            Gratuito e sem necessidade de cadastro
          </p>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="border-t bg-muted/30 py-20">
        <div className="container mx-auto px-4">
          <div className="mx-auto grid max-w-5xl gap-8 md:grid-cols-3">
            <div className="space-y-3 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <Zap className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold">Ultra Rápido</h3>
              <p className="text-sm text-muted-foreground">
                Redirecionamento em menos de 30ms com cache inteligente
              </p>
            </div>

            <div className="space-y-3 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <BarChart3 className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold">Analytics Completo</h3>
              <p className="text-sm text-muted-foreground">
                Veja de onde vêm seus cliques, dispositivos e muito mais
              </p>
            </div>

            <div className="space-y-3 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <Shield className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold">Seguro e Privado</h3>
              <p className="text-sm text-muted-foreground">
                Proteção por senha, expiração automática e conformidade LGPD
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="border-t py-20">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-5xl space-y-12">
            <div className="space-y-4 text-center">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Planos para todos
              </h2>
              <p className="text-lg text-muted-foreground">
                Escolha o plano ideal para suas necessidades
              </p>
            </div>

            <div className="grid gap-8 md:grid-cols-3">
              {/* Hobby Plan */}
              <Card>
                <CardHeader>
                  <CardTitle>Hobby</CardTitle>
                  <CardDescription>
                    Para uso pessoal e projetos pequenos
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="text-4xl font-bold">Grátis</div>
                    <p className="text-sm text-muted-foreground">
                      Sempre gratuito
                    </p>
                  </div>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span>100 links por mês</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span>Analytics básico</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span>Links expiráveis</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span>QR Codes</span>
                    </li>
                  </ul>
                </CardContent>
                <CardFooter>
                  <Button asChild variant="outline" className="w-full">
                    <Link href="/signup">Começar grátis</Link>
                  </Button>
                </CardFooter>
              </Card>

              {/* Creator Plan */}
              <Card className="border-primary">
                <CardHeader>
                  <div className="mb-2 inline-block rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
                    Popular
                  </div>
                  <CardTitle>Creator</CardTitle>
                  <CardDescription>
                    Para criadores de conteúdo e profissionais
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="text-4xl font-bold">
                      R$ 29<span className="text-lg font-normal">/mês</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Cobrança mensal
                    </p>
                  </div>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span>1.000 links por mês</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span>Analytics avançado</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span>Aliases customizados</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span>Proteção por senha</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span>Meta tags customizadas</span>
                    </li>
                  </ul>
                </CardContent>
                <CardFooter>
                  <Button asChild className="w-full">
                    <Link href="/signup">Começar agora</Link>
                  </Button>
                </CardFooter>
              </Card>

              {/* Business Plan */}
              <Card>
                <CardHeader>
                  <CardTitle>Business</CardTitle>
                  <CardDescription>Para equipes e empresas</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="text-4xl font-bold">
                      R$ 99<span className="text-lg font-normal">/mês</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Cobrança mensal
                    </p>
                  </div>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span>Links ilimitados</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span>API de integração</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span>Webhooks</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span>Múltiplos usuários</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span>Suporte prioritário</span>
                    </li>
                  </ul>
                </CardContent>
                <CardFooter>
                  <Button asChild variant="outline" className="w-full">
                    <Link href="/signup">Começar agora</Link>
                  </Button>
                </CardFooter>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="border-t bg-muted/30 py-20">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-3xl space-y-8 text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Nossa Missão
            </h2>
            <div className="space-y-4 text-lg text-muted-foreground">
              <p>
                O{' '}
                <span className="font-semibold text-foreground">urlfy.cc</span>{' '}
                nasceu com a missão de tornar a web mais simples e acessível.
                Acreditamos que compartilhar conteúdo online deve ser rápido,
                seguro e sem complicações.
              </p>
              <p>
                Combinamos tecnologia de ponta com design intuitivo para
                oferecer a melhor experiência em encurtamento de URLs. Seja você
                um criador de conteúdo, profissional de marketing ou apenas
                alguém que quer compartilhar um link, estamos aqui para ajudar.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t py-20">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-2xl space-y-6 text-center">
            <h2 className="text-3xl font-bold">Pronto para mais recursos?</h2>
            <p className="text-muted-foreground">
              Crie uma conta gratuita e tenha acesso a links personalizados,
              analytics detalhados e muito mais.
            </p>
            <HeroActions />
          </div>
        </div>
      </section>
    </>
  );
}
