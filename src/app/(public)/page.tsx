/**
 * ═════════════════════════════════════════════════════════════════════
 * LANDING PAGE - Homepage
 * ═════════════════════════════════════════════════════════════════════
 * Main landing page with Hero, Features, About, and CTA sections.
 * Positioned as an educational/portfolio project.
 * ═════════════════════════════════════════════════════════════════════
 */

import { BarChart3, Github, Info, Rocket, Shield, Zap } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import type { JSX } from 'react';
import { LinkForm } from '@/components/forms/link-form';
import { HeroActions } from '@/components/home/hero-actions';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
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
      {/* Project Disclaimer */}
      <section className="border-b bg-muted/50 py-4">
        <div className="container mx-auto px-4">
          <Alert className="border-primary/50 bg-primary/5">
            <Info className="h-4 w-4 text-primary" />
            <AlertTitle>Projeto Educacional & Portfólio</AlertTitle>
            <AlertDescription>
              Este é um projeto de demonstração técnica e não um produto
              comercial. Desenvolvido para showcasing de habilidades em
              arquitetura de software e engenharia de performance.{' '}
              <Link href="/project" className="underline font-medium">
                Saiba mais sobre o projeto
              </Link>
            </AlertDescription>
          </Alert>
        </div>
      </section>

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

      {/* About Section */}
      <section id="about" className="border-t bg-muted/30 py-20">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-3xl space-y-8 text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Sobre o Projeto
            </h2>
            <div className="space-y-4 text-lg text-muted-foreground">
              <p>
                O{' '}
                <span className="font-semibold text-foreground">urlfy.cc</span>{' '}
                é um projeto de portfólio e estudo de caso sobre arquitetura de
                software moderna. Desenvolvido com foco em performance,
                type-safety e boas práticas de engenharia.
              </p>
              <p>
                Combinando tecnologias de ponta como{' '}
                <strong className="text-foreground">Bun</strong>,{' '}
                <strong className="text-foreground">Next.js</strong> e{' '}
                <strong className="text-foreground">ElysiaJS</strong>, este
                projeto demonstra competências técnicas em arquitetura
                full-stack, otimização de performance e infraestrutura
                containerizada.
              </p>
            </div>
            <div className="flex justify-center gap-4">
              <Button asChild>
                <Link href="/project">
                  <Rocket className="mr-2 h-4 w-4" />
                  Detalhes Técnicos
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Author/Developer Section */}
      <section className="border-t py-20">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-5xl">
            <div className="text-center space-y-4 mb-12">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Conheça o Desenvolvedor
              </h2>
            </div>
            <Card className="max-w-2xl mx-auto">
              <CardHeader className="text-center">
                <CardTitle className="text-2xl">Gustavo Sotero</CardTitle>
                <CardDescription>Full-Stack Developer</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <p className="text-center text-muted-foreground">
                  Desenvolvedor especializado em arquitetura de sistemas de alta
                  performance, TypeScript e infraestrutura moderna. Este projeto
                  representa uma demonstração prática de competências técnicas
                  em engenharia de software.
                </p>
                <div className="flex flex-wrap justify-center gap-4">
                  <Button asChild variant="default">
                    <a
                      href="https://gustavo-sotero.dev"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Rocket className="mr-2 h-4 w-4" />
                      Portfólio
                    </a>
                  </Button>
                  <Button asChild variant="outline">
                    <a
                      href="https://github.com/gustavo-sotero/urlfy.cc"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Github className="mr-2 h-4 w-4" />
                      GitHub
                    </a>
                  </Button>
                </div>
              </CardContent>
            </Card>
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
