/**
 * ═════════════════════════════════════════════════════════════════════
 * PROJECT PAGE - Technical Deep Dive (Internationalized)
 * ═════════════════════════════════════════════════════════════════════
 * Technical showcase page for urlfy.cc — a production-grade URL shortener
 * that also serves as a portfolio and applied-research platform.
 * ═════════════════════════════════════════════════════════════════════
 */

import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import type { JSX } from 'react';
import { RevealSection } from '@/components/shared/reveal-section';
import {
  ArchitectureSection,
  HeroSection,
  MetricsSection,
  SecurityAuthorCtaSection,
  TradeoffsSection
} from './_components';

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

export default async function ProjectPage(): Promise<JSX.Element> {
  const t = await getTranslations('ProjectPage');

  return (
    <div className="scroll-smooth">
      <RevealSection>
        <HeroSection t={t} />
      </RevealSection>

      <RevealSection delay={200}>
        <ArchitectureSection t={t} />
      </RevealSection>

      <RevealSection delay={300}>
        <TradeoffsSection t={t} />
      </RevealSection>

      <RevealSection delay={200}>
        <MetricsSection t={t} />
      </RevealSection>

      <RevealSection delay={300}>
        <SecurityAuthorCtaSection t={t} />
      </RevealSection>
    </div>
  );
}
