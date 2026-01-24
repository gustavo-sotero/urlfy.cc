/**
 * ═════════════════════════════════════════════════════════════════════
 * PROJECT PAGE - Technical Deep Dive
 * ═════════════════════════════════════════════════════════════════════
 * Technical showcase page positioning urlfy.cc as a portfolio/educational
 * project rather than a commercial product.
 * ═════════════════════════════════════════════════════════════════════
 */

import {
  BarChart3,
  Code2,
  Database,
  Github,
  Layers,
  Rocket,
  Shield,
  Zap
} from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import type { JSX } from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';

export const metadata: Metadata = {
  title: 'Sobre o Projeto - urlfy.cc',
  description:
    'Uma jornada técnica sobre arquitetura, decisões e trade-offs no desenvolvimento de um encurtador de URLs moderno.',
  openGraph: {
    title: 'Por trás do código: urlfy.cc',
    description:
      'Arquitetura, decisões técnicas e trade-offs de um projeto full-stack moderno',
    type: 'website'
  }
};

type TechBadge = {
  name: string;
  variant?: 'default' | 'secondary' | 'outline';
};

type TradeOff = {
  id: string;
  decision: string;
  why: string;
  impact: string;
  alternatives: string;
};

const TECH_STACK: readonly TechBadge[] = [
  { name: 'Bun', variant: 'default' },
  { name: 'Next.js 16', variant: 'default' },
  { name: 'ElysiaJS', variant: 'default' },
  { name: 'PostgreSQL', variant: 'secondary' },
  { name: 'Redis', variant: 'secondary' },
  { name: 'Docker', variant: 'outline' },
  { name: 'TypeScript', variant: 'outline' },
  { name: 'Drizzle ORM', variant: 'outline' }
];

const TRADE_OFFS: readonly TradeOff[] = [
  {
    id: 'type-safety',
    decision: 'Type-Safety First (TypeScript Strict + Drizzle)',
    why: 'Capturar erros em tempo de build, não em produção. Melhor developer experience com autocompleção e refactoring seguro.',
    impact:
      'Reduz bugs em produção, mas aumenta tempo de desenvolvimento inicial e curva de aprendizado.',
    alternatives:
      'JavaScript puro seria mais rápido de prototipar, mas menos seguro e escalável.'
  },
  {
    id: 'bun-runtime',
    decision: 'Bun Runtime vs Node.js',
    why: 'APIs nativas para SQL, Redis e Password Hashing reduzem dependências externas. Performance superior em I/O.',
    impact:
      'Menos dependências (bcrypt, ioredis), mas ecossistema ainda em maturação. Menor community support.',
    alternatives:
      'Node.js teria melhor compatibilidade, mas mais overhead e dependências.'
  },
  {
    id: 'mvc-pattern',
    decision: 'Feature-Based MVC (Elysia Best Practices)',
    why: 'Separação clara de responsabilidades, facilita testes unitários e manutenção de longo prazo.',
    impact: 'Mais boilerplate inicial, mas código escalável e testável.',
    alternatives:
      'Next.js Route Handlers seria mais simples, mas perderia type-safety e validação runtime.'
  },
  {
    id: 'event-driven',
    decision: 'Event-Driven Analytics (Redis Streams)',
    why: 'Não bloquear o redirect com writes de analytics. Native Bun implementation para zero deps.',
    impact: 'Performance excelente e type-safe. Sem BullMQ/Redis externo.',
    alternatives: 'BullMQ adicionaria dependências desnecessárias (ioredis).'
  },
  {
    id: 'monolith',
    decision: 'Monolith Self-Hosted (Docker Compose)',
    why: 'Simplicidade operacional para um projeto de portfólio. Menor custo de infraestrutura.',
    impact:
      'Fácil de deployar e manter, mas escala vertical (vs. horizontal com microservices).',
    alternatives:
      'Microservices seria mais escalável, mas muito mais complexo e caro para um projeto educacional.'
  }
];

export default function ProjectPage(): JSX.Element {
  return (
    <>
      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20">
        <div className="mx-auto max-w-4xl space-y-8 text-center">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border bg-muted px-4 py-2 text-sm">
              <Code2 className="h-4 w-4 text-primary" />
              <span>Projeto de Portfólio & Educacional</span>
            </div>

            <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
              Por trás do código
              <br />
              <span className="text-primary">urlfy.cc</span>
            </h1>

            <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
              Uma jornada técnica sobre arquitetura, decisões e trade-offs no
              desenvolvimento de um encurtador de URLs moderno e de alta
              performance.
            </p>
          </div>

          {/* Tech Stack Badges */}
          <div className="flex flex-wrap justify-center gap-2">
            {TECH_STACK.map((tech) => (
              <Badge key={tech.name} variant={tech.variant}>
                {tech.name}
              </Badge>
            ))}
          </div>
        </div>
      </section>

      {/* Architecture Section */}
      <section className="border-t bg-muted/30 py-20">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-5xl space-y-12">
            <div className="space-y-4 text-center">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Arquitetura Híbrida
              </h2>
              <p className="text-lg text-muted-foreground">
                Next.js para UI + ElysiaJS para API = Type-Safety End-to-End
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <Layers className="h-5 w-5 text-primary" />
                    </div>
                    <CardTitle>Frontend (Next.js 16)</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-muted-foreground">
                  <p>
                    <strong className="text-foreground">App Router</strong>:
                    Server Components para SEO e performance
                  </p>
                  <p>
                    <strong className="text-foreground">Middleware</strong>:
                    Middleware para redirecionamento de links
                  </p>
                  <p>
                    <strong className="text-foreground">Shadcn/UI</strong>:
                    Design system acessível e consistente
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <Zap className="h-5 w-5 text-primary" />
                    </div>
                    <CardTitle>API (ElysiaJS + Bun)</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-muted-foreground">
                  <p>
                    <strong className="text-foreground">Type-Safe</strong>:
                    TypeBox para validação runtime com inferência de tipos
                  </p>
                  <p>
                    <strong className="text-foreground">Fast</strong>: Bun
                    Native APIs (SQL, Redis, Password)
                  </p>
                  <p>
                    <strong className="text-foreground">OpenAPI</strong>:
                    Documentação automática em <code>/api/docs</code>
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Infrastructure & Stack */}
      <section className="border-t py-20">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-5xl space-y-12">
            <div className="space-y-4 text-center">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Infraestrutura & Stack
              </h2>
              <p className="text-lg text-muted-foreground">
                100% containerizado, self-hosted e pronto para produção
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <Database className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle>Persistência</CardTitle>
                      <CardDescription>
                        PostgreSQL 16 + Drizzle ORM
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-muted-foreground">
                  <p>Particionamento mensal de eventos</p>
                  <p>Type-safe queries com Drizzle</p>
                  <p>Migrações versionadas</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <Zap className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle>Cache</CardTitle>
                      <CardDescription>Redis 7 (Bun Native)</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-muted-foreground">
                  <p>Hot-path caching para redirects</p>
                  <p>Rate limiting (Sliding Window)</p>
                  <p>Cache negativo para códigos inválidos</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <BarChart3 className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle>Observabilidade</CardTitle>
                      <CardDescription>SigNoz + OpenTelemetry</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-muted-foreground">
                  <p>Traces distribuídos</p>
                  <p>Métricas de performance (SLOs)</p>
                  <p>Logs estruturados</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Technical Decisions & Trade-offs */}
      <section className="border-t bg-muted/30 py-20">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-5xl space-y-12">
            <div className="space-y-4 text-center">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Decisões Técnicas & Trade-offs
              </h2>
              <p className="text-lg text-muted-foreground">
                Escolhas arquiteturais, motivações e alternativas consideradas
              </p>
            </div>

            <Accordion type="single" collapsible className="w-full">
              {TRADE_OFFS.map((tradeoff) => (
                <AccordionItem key={tradeoff.id} value={tradeoff.id}>
                  <AccordionTrigger className="text-left">
                    <span className="font-semibold">{tradeoff.decision}</span>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-4 pt-2 text-sm">
                    <div>
                      <h4 className="font-semibold text-foreground mb-1">
                        Por quê?
                      </h4>
                      <p className="text-muted-foreground">{tradeoff.why}</p>
                    </div>
                    <div>
                      <h4 className="font-semibold text-foreground mb-1">
                        Impacto
                      </h4>
                      <p className="text-muted-foreground">{tradeoff.impact}</p>
                    </div>
                    <div>
                      <h4 className="font-semibold text-foreground mb-1">
                        Alternativas Consideradas
                      </h4>
                      <p className="text-muted-foreground">
                        {tradeoff.alternatives}
                      </p>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>
      </section>

      {/* Business Impact (Simulated) */}
      <section className="border-t py-20">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-5xl space-y-12">
            <div className="space-y-4 text-center">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Impacto Técnico (Simulado)
              </h2>
              <p className="text-lg text-muted-foreground">
                Métricas e SLOs para demonstração de engenharia
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              <Card className="text-center">
                <CardHeader>
                  <CardTitle className="text-4xl font-bold text-primary">
                    &lt; 30ms
                  </CardTitle>
                  <CardDescription>Latência P50 de Redirect</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Cache Redis + Middleware Edge
                  </p>
                </CardContent>
              </Card>

              <Card className="text-center">
                <CardHeader>
                  <CardTitle className="text-4xl font-bold text-primary">
                    10K+
                  </CardTitle>
                  <CardDescription>Requisições/segundo</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Bun Runtime + APIs Nativas
                  </p>
                </CardContent>
              </Card>

              <Card className="text-center">
                <CardHeader>
                  <CardTitle className="text-4xl font-bold text-primary">
                    99.9%
                  </CardTitle>
                  <CardDescription>Availability Target</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Health Checks + Circuit Breaker
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Security & Compliance */}
      <section className="border-t bg-muted/30 py-20">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-5xl space-y-8">
            <div className="space-y-4 text-center">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Segurança & Compliance
              </h2>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <Shield className="h-5 w-5 text-primary" />
                    </div>
                    <CardTitle>Proteções Implementadas</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <ul className="space-y-2 text-muted-foreground">
                    <li>✅ Rate Limiting (Sliding Window)</li>
                    <li>✅ Headers de Segurança (CSP, HSTS)</li>
                    <li>✅ CSRF Protection</li>
                    <li>✅ Input Sanitization (DOMPurify)</li>
                    <li>✅ Blacklist de URLs maliciosas</li>
                  </ul>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <Shield className="h-5 w-5 text-primary" />
                    </div>
                    <CardTitle>Compliance LGPD/GDPR</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <ul className="space-y-2 text-muted-foreground">
                    <li>✅ Anonimização de IPs (SHA-256)</li>
                    <li>✅ Consentimento explícito</li>
                    <li>✅ Exportação de dados</li>
                    <li>✅ Right to be forgotten (72h)</li>
                    <li>✅ Data retention (90 dias)</li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Author Section */}
      <section className="border-t py-20">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-3xl space-y-8 text-center">
            <div className="space-y-4">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Sobre o Desenvolvedor
              </h2>
              <div className="space-y-4">
                <p className="text-lg text-muted-foreground">
                  <strong className="text-foreground">Gustavo Sotero</strong> -
                  Full-Stack Developer
                </p>
                <p className="text-muted-foreground">
                  Este projeto foi desenvolvido como demonstração de habilidades
                  técnicas em arquitetura de software, performance engineering e
                  boas práticas de desenvolvimento. Não se trata de um produto
                  comercial, mas sim de um estudo de caso e portfólio.
                </p>
              </div>
            </div>

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
                  Ver no GitHub
                </a>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Call to Action */}
      <section className="border-t bg-muted/30 py-20">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-2xl space-y-6 text-center">
            <h2 className="text-3xl font-bold">Explore a Documentação</h2>
            <p className="text-muted-foreground">
              Mergulhe nos detalhes técnicos através da documentação completa da
              API e código-fonte no GitHub.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Button asChild variant="default">
                <Link href="/api/docs">
                  <Code2 className="mr-2 h-4 w-4" />
                  API Documentation
                </Link>
              </Button>
              <Button asChild variant="outline">
                <a
                  href="https://github.com/gustavo-sotero/urlfy.cc"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Github className="mr-2 h-4 w-4" />
                  Repositório
                </a>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
