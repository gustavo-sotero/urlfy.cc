/**
 * ═════════════════════════════════════════════════════════════════════
 * PROJECT PAGE - Technical Deep Dive (Internationalized)
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
import { getTranslations } from 'next-intl/server';
import type { JSX } from 'react';
import { RevealSection } from '@/components/shared/reveal-section';
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
import { Link } from '@/i18n/routing';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('ProjectPage');

  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
    openGraph: {
      title: t('ogTitle'),
      description: t('ogDescription'),
      type: 'website'
    }
  };
}

type TechBadge = {
  name: string;
  variant?: 'default' | 'secondary' | 'outline';
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

const TRADEOFF_IDS = [
  'typeSafety',
  'bunRuntime',
  'mvcPattern',
  'eventDriven',
  'monolith'
] as const;

export default async function ProjectPage(): Promise<JSX.Element> {
  const t = await getTranslations('ProjectPage');

  return (
    <div className="scroll-smooth">
      {/* Hero Section */}
      <RevealSection>
        <section className="container mx-auto px-4 py-20">
          <div className="mx-auto max-w-4xl space-y-8 text-center">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full border bg-muted px-4 py-2 text-sm">
                <Code2 className="h-4 w-4 text-primary" />
                <span>{t('hero.badge')}</span>
              </div>

              <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
                {t('hero.title')}
                <br />
                <span className="text-primary">{t('hero.subtitle')}</span>
              </h1>

              <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
                {t('hero.description')}
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
      </RevealSection>

      {/* Architecture Section */}
      <RevealSection delay={200}>
        <section className="border-t bg-muted/30 py-20">
          <div className="container mx-auto px-4">
            <div className="mx-auto max-w-5xl space-y-12">
              <div className="space-y-4 text-center">
                <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                  {t('architecture.title')}
                </h2>
                <p className="text-lg text-muted-foreground">
                  {t('architecture.subtitle')}
                </p>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                        <Layers className="h-5 w-5 text-primary" />
                      </div>
                      <CardTitle>{t('architecture.frontend.title')}</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm text-muted-foreground">
                    <p>
                      <strong className="text-foreground">App Router</strong>:{' '}
                      {t('architecture.frontend.appRouter')}
                    </p>
                    <p>
                      <strong className="text-foreground">Middleware</strong>:{' '}
                      {t('architecture.frontend.middleware')}
                    </p>
                    <p>
                      <strong className="text-foreground">Shadcn/UI</strong>:{' '}
                      {t('architecture.frontend.ui')}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                        <Zap className="h-5 w-5 text-primary" />
                      </div>
                      <CardTitle>{t('architecture.api.title')}</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm text-muted-foreground">
                    <p>
                      <strong className="text-foreground">Type-Safe</strong>:{' '}
                      {t('architecture.api.typeSafe')}
                    </p>
                    <p>
                      <strong className="text-foreground">Fast</strong>:{' '}
                      {t('architecture.api.fast')}
                    </p>
                    <p>
                      <strong className="text-foreground">OpenAPI</strong>:{' '}
                      {t('architecture.api.openapi')} <code>/api/docs</code>
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
                  {t('infrastructure.title')}
                </h2>
                <p className="text-lg text-muted-foreground">
                  {t('infrastructure.subtitle')}
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
                        <CardTitle>
                          {t('infrastructure.persistence.title')}
                        </CardTitle>
                        <CardDescription>
                          {t('infrastructure.persistence.subtitle')}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm text-muted-foreground">
                    <p>{t('infrastructure.persistence.feature1')}</p>
                    <p>{t('infrastructure.persistence.feature2')}</p>
                    <p>{t('infrastructure.persistence.feature3')}</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                        <Zap className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle>{t('infrastructure.cache.title')}</CardTitle>
                        <CardDescription>
                          {t('infrastructure.cache.subtitle')}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm text-muted-foreground">
                    <p>{t('infrastructure.cache.feature1')}</p>
                    <p>{t('infrastructure.cache.feature2')}</p>
                    <p>{t('infrastructure.cache.feature3')}</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                        <BarChart3 className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle>
                          {t('infrastructure.observability.title')}
                        </CardTitle>
                        <CardDescription>
                          {t('infrastructure.observability.subtitle')}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm text-muted-foreground">
                    <p>{t('infrastructure.observability.feature1')}</p>
                    <p>{t('infrastructure.observability.feature2')}</p>
                    <p>{t('infrastructure.observability.feature3')}</p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </section>
      </RevealSection>

      {/* Technical Decisions & Trade-offs */}
      <RevealSection delay={300}>
        <section className="border-t bg-muted/30 py-20">
          <div className="container mx-auto px-4">
            <div className="mx-auto max-w-5xl space-y-12">
              <div className="space-y-4 text-center">
                <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                  {t('tradeoffs.title')}
                </h2>
                <p className="text-lg text-muted-foreground">
                  {t('tradeoffs.subtitle')}
                </p>
              </div>

              <Accordion type="single" collapsible className="w-full">
                {TRADEOFF_IDS.map((id) => (
                  <AccordionItem key={id} value={id}>
                    <AccordionTrigger className="text-left">
                      <span className="font-semibold">
                        {t(`tradeoffs.decisions.${id}.title`)}
                      </span>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-4 pt-2 text-sm">
                      <div>
                        <h4 className="font-semibold text-foreground mb-1">
                          {t('tradeoffs.why')}
                        </h4>
                        <p className="text-muted-foreground">
                          {t(`tradeoffs.decisions.${id}.why`)}
                        </p>
                      </div>
                      <div>
                        <h4 className="font-semibold text-foreground mb-1">
                          {t('tradeoffs.impact')}
                        </h4>
                        <p className="text-muted-foreground">
                          {t(`tradeoffs.decisions.${id}.impact`)}
                        </p>
                      </div>
                      <div>
                        <h4 className="font-semibold text-foreground mb-1">
                          {t('tradeoffs.alternatives')}
                        </h4>
                        <p className="text-muted-foreground">
                          {t(`tradeoffs.decisions.${id}.alternatives`)}
                        </p>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          </div>
        </section>
      </RevealSection>

      {/* Business Impact (Simulated) */}
      <RevealSection delay={200}>
        <section className="border-t py-20">
          <div className="container mx-auto px-4">
            <div className="mx-auto max-w-5xl space-y-12">
              <div className="space-y-4 text-center">
                <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                  {t('metrics.title')}
                </h2>
                <p className="text-lg text-muted-foreground">
                  {t('metrics.subtitle')}
                </p>
              </div>

              <div className="grid gap-6 md:grid-cols-3">
                <Card className="text-center">
                  <CardHeader>
                    <CardTitle className="text-4xl font-bold text-primary">
                      {t('metrics.latency.value')}
                    </CardTitle>
                    <CardDescription>
                      {t('metrics.latency.label')}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      {t('metrics.latency.description')}
                    </p>
                  </CardContent>
                </Card>

                <Card className="text-center">
                  <CardHeader>
                    <CardTitle className="text-4xl font-bold text-primary">
                      {t('metrics.throughput.value')}
                    </CardTitle>
                    <CardDescription>
                      {t('metrics.throughput.label')}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      {t('metrics.throughput.description')}
                    </p>
                  </CardContent>
                </Card>

                <Card className="text-center">
                  <CardHeader>
                    <CardTitle className="text-4xl font-bold text-primary">
                      {t('metrics.availability.value')}
                    </CardTitle>
                    <CardDescription>
                      {t('metrics.availability.label')}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      {t('metrics.availability.description')}
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </section>
      </RevealSection>

      {/* Security & Compliance */}
      <RevealSection delay={300}>
        <section className="border-t bg-muted/30 py-20">
          <div className="container mx-auto px-4">
            <div className="mx-auto max-w-5xl space-y-8">
              <div className="space-y-4 text-center">
                <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                  {t('security.title')}
                </h2>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                        <Shield className="h-5 w-5 text-primary" />
                      </div>
                      <CardTitle>{t('security.protections.title')}</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <ul className="space-y-2 text-muted-foreground">
                      <li>✅ {t('security.protections.rateLimit')}</li>
                      <li>✅ {t('security.protections.headers')}</li>
                      <li>✅ {t('security.protections.csrf')}</li>
                      <li>✅ {t('security.protections.sanitization')}</li>
                      <li>✅ {t('security.protections.blacklist')}</li>
                    </ul>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                        <Shield className="h-5 w-5 text-primary" />
                      </div>
                      <CardTitle>{t('security.compliance.title')}</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <ul className="space-y-2 text-muted-foreground">
                      <li>✅ {t('security.compliance.anonymization')}</li>
                      <li>✅ {t('security.compliance.consent')}</li>
                      <li>✅ {t('security.compliance.export')}</li>
                      <li>✅ {t('security.compliance.forgotten')}</li>
                      <li>✅ {t('security.compliance.retention')}</li>
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
                  {t('author.title')}
                </h2>
                <div className="space-y-4">
                  <p className="text-lg text-muted-foreground">
                    <strong className="text-foreground">
                      {t('author.name')}
                    </strong>{' '}
                    - {t('author.role')}
                  </p>
                  <p className="text-muted-foreground">
                    {t('author.description')}
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
                    {t('author.portfolio')}
                  </a>
                </Button>
                <Button asChild variant="outline">
                  <a
                    href="https://github.com/gustavo-sotero/urlfy.cc"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Github className="mr-2 h-4 w-4" />
                    {t('author.github')}
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
              <h2 className="text-3xl font-bold">{t('cta.title')}</h2>
              <p className="text-muted-foreground">{t('cta.description')}</p>
              <div className="flex flex-wrap justify-center gap-4">
                <Button asChild variant="default">
                  <Link href="/api/docs">
                    <Code2 className="mr-2 h-4 w-4" />
                    {t('cta.apiDocs')}
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <a
                    href="https://github.com/gustavo-sotero/urlfy.cc"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Github className="mr-2 h-4 w-4" />
                    {t('cta.repository')}
                  </a>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </RevealSection>
    </div>
  );
}
