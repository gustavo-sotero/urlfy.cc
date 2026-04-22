/**
 * ═════════════════════════════════════════════════════════════════════
 * LANDING PAGE - Homepage
 * ═════════════════════════════════════════════════════════════════════
 * Main landing page with Hero, Features, Mission, and CTA sections.
 * Positioned as a real product project with portfolio and research framing.
 * ═════════════════════════════════════════════════════════════════════
 */

import { BarChart3, Github, Info, Rocket, Shield, Zap } from 'lucide-react';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import type { JSX } from 'react';
import { LinkForm } from '@/components/forms/link-form';
import { HeroActions } from '@/components/home/hero-actions';
import { RevealSection } from '@/components/shared/reveal-section';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
  const t = await getTranslations('Hero');

  return {
    title: `urlfy.cc - ${t('title')}`,
    description: t('description'),
    openGraph: {
      title: `urlfy.cc - ${t('title')}`,
      description: t('subtitle'),
      type: 'website'
    }
  };
}

export default async function LandingPage(): Promise<JSX.Element> {
  const tHero = await getTranslations('Hero');
  const tFeatures = await getTranslations('Features');
  const tLinkForm = await getTranslations('LinkForm');
  return (
    <div>
      {/* Project Disclaimer */}
      <RevealSection>
        <section className="border-b bg-muted/50 py-4">
          <div className="container mx-auto px-4">
            <Alert className="border-primary/50 bg-primary/5">
              <Info className="h-4 w-4 text-primary" />
              <AlertTitle>{tHero('projectDisclaimer')}</AlertTitle>
              <AlertDescription>
                {tHero('projectDescription')}{' '}
                <Link href="/project" className="underline font-medium">
                  {tHero('ctaSecondary')}
                </Link>
              </AlertDescription>
            </Alert>
          </div>
        </section>
      </RevealSection>

      {/* Hero Section */}
      <RevealSection delay={200}>
        <section className="container mx-auto px-4 py-20">
          <div className="mx-auto max-w-4xl space-y-8 text-center">
            <div className="space-y-4">
              <div className="inline-flex max-w-full flex-wrap items-center justify-center gap-2 rounded-full border bg-muted px-4 py-2 text-sm">
                <Zap className="h-4 w-4 text-primary" />
                <span>{tHero('subtitle')}</span>
              </div>
              <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
                {tHero('title')}
              </h1>
              <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
                {tHero('description')}
              </p>
            </div>

            {/* Link Form */}
            <div className="mx-auto max-w-2xl">
              <LinkForm />
            </div>

            <p className="text-sm text-muted-foreground">
              {tLinkForm('guest.freeNoSignup')}
            </p>
          </div>
        </section>
      </RevealSection>

      {/* Features */}
      <RevealSection delay={400}>
        <section id="features" className="border-t bg-muted/30 py-20">
          <div className="container mx-auto px-4">
            <div className="mx-auto grid max-w-5xl gap-8 md:grid-cols-3">
              <div className="space-y-3 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <Zap className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold">{tFeatures('fast.title')}</h3>
                <p className="text-sm text-muted-foreground">
                  {tFeatures('fast.description')}
                </p>
              </div>

              <div className="space-y-3 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <BarChart3 className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold">
                  {tFeatures('analytics.title')}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {tFeatures('analytics.description')}
                </p>
              </div>

              <div className="space-y-3 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <Shield className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold">{tFeatures('security.title')}</h3>
                <p className="text-sm text-muted-foreground">
                  {tFeatures('security.description')}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Mission Section */}
        <section id="mission" className="border-t bg-muted/30 py-20">
          <div className="container mx-auto px-4">
            <div className="mx-auto max-w-3xl space-y-8 text-center">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                {tHero('mission.title')}
              </h2>
              <div className="space-y-4 text-lg text-muted-foreground">
                <p>
                  <span className="font-semibold text-foreground">
                    urlfy.cc
                  </span>{' '}
                  {tHero('mission.p1')}
                </p>
                <p>{tHero('mission.p2')}</p>
              </div>
            </div>
          </div>
        </section>

        {/* Project Section */}
        <section className="border-t bg-muted/30 py-20">
          <div className="container mx-auto px-4">
            <div className="mx-auto max-w-3xl space-y-8 text-center">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                {tHero('projectNotes.title')}
              </h2>
              <div className="space-y-4 text-lg text-muted-foreground">
                <p>
                  <span className="font-semibold text-foreground">
                    urlfy.cc
                  </span>{' '}
                  {tHero('projectNotes.p1')}
                </p>
                <p>{tHero('projectNotes.p2')}</p>
              </div>
              <div className="flex justify-center gap-4">
                <Button asChild>
                  <Link href="/project">
                    <Rocket className="mr-2 h-4 w-4" />
                    {tHero('projectNotes.technicalDetails')}
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </RevealSection>

      {/* Author/Developer Section */}
      <RevealSection delay={400}>
        <section className="border-t py-20">
          <div className="container mx-auto px-4">
            <div className="mx-auto max-w-5xl">
              <div className="text-center space-y-4 mb-12">
                <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                  {tHero('developer.title')}
                </h2>
              </div>
              <Card className="max-w-2xl mx-auto">
                <CardHeader className="text-center">
                  <CardTitle className="text-2xl">
                    {tHero('developer.name')}
                  </CardTitle>
                  <CardDescription>{tHero('developer.role')}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <p className="text-center text-muted-foreground">
                    {tHero('developer.description')}
                  </p>
                  <div className="flex flex-wrap justify-center gap-4">
                    <Button asChild variant="default">
                      <a
                        href="https://gustavo-sotero.dev"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Rocket className="mr-2 h-4 w-4" />
                        {tHero('developer.portfolio')}
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
      </RevealSection>

      {/* CTA */}
      <RevealSection delay={200}>
        <section className="border-t py-20">
          <div className="container mx-auto px-4">
            <div className="mx-auto max-w-2xl space-y-6 text-center">
              <h2 className="text-3xl font-bold">{tHero('cta.title')}</h2>
              <p className="text-muted-foreground">
                {tHero('cta.description')}
              </p>
              <HeroActions />
            </div>
          </div>
        </section>
      </RevealSection>
    </div>
  );
}
