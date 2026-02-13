/**
 * ═════════════════════════════════════════════════════════════════════
 * PRIVACY POLICY PAGE
 * ═════════════════════════════════════════════════════════════════════
 * Privacy policy and data protection information for urlfy.cc.
 * LGPD/GDPR compliant disclosure.
 * ═════════════════════════════════════════════════════════════════════
 */

import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import type { JSX } from 'react';
import { RevealSection } from '@/components/shared/reveal-section';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Privacy');
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
    robots: {
      index: true,
      follow: true
    }
  };
}

export default async function PrivacyPage(): Promise<JSX.Element> {
  const t = await getTranslations('Privacy');
  const locale = await getLocale();
  const intlLocale = locale === 'pt-br' ? 'pt-BR' : locale;

  return (
    <div className="container mx-auto max-w-4xl px-4 py-16 scroll-smooth">
      <RevealSection>
        <article className="prose prose-slate dark:prose-invert max-w-none">
          <h1 className="text-4xl font-bold tracking-tight">{t('title')}</h1>

          <p className="text-muted-foreground">
            {t('lastUpdated')}:{' '}
            {new Date().toLocaleDateString(intlLocale, {
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}
          </p>

          {/* Section 1 - Introduction */}
          <section className="mt-8">
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              {t('sections.s1.title')}
            </h2>
            <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg mb-4">
              <p className="font-semibold text-foreground">
                {t('sections.s1.warningTitle')}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {t('sections.s1.warningContent')}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                <strong>{t('sections.s1.warningNote')}</strong>
              </p>
            </div>
            <p>{t('sections.s1.content')}</p>
          </section>

          {/* Section 2 - Data We Collect */}
          <section className="mt-8">
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              {t('sections.s2.title')}
            </h2>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              {t('sections.s2.sub1Title')}
            </h3>
            <p>{t('sections.s2.sub1Intro')}</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>{t('sections.s2.sub1Items.i1')}</li>
              <li>{t('sections.s2.sub1Items.i2')}</li>
              <li>{t('sections.s2.sub1Items.i3')}</li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              {t('sections.s2.sub2Title')}
            </h3>
            <p>{t('sections.s2.sub2Intro')}</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>{t('sections.s2.sub2Items.i1')}</li>
              <li>{t('sections.s2.sub2Items.i2')}</li>
              <li>{t('sections.s2.sub2Items.i3')}</li>
              <li>{t('sections.s2.sub2Items.i4')}</li>
              <li>{t('sections.s2.sub2Items.i5')}</li>
            </ul>
            <p className="mt-4">
              <strong className="text-foreground">
                {t('sections.s2.sub2Note')}
              </strong>
            </p>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              {t('sections.s2.sub3Title')}
            </h3>
            <p>{t('sections.s2.sub3Intro')}</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>{t('sections.s2.sub3Items.i1')}</li>
              <li>{t('sections.s2.sub3Items.i2')}</li>
              <li>{t('sections.s2.sub3Items.i3')}</li>
            </ul>
          </section>

          {/* Section 3 - How We Use Data */}
          <section className="mt-8">
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              {t('sections.s3.title')}
            </h2>
            <p>{t('sections.s3.intro')}</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>{t('sections.s3.items.i1')}</li>
              <li>{t('sections.s3.items.i2')}</li>
              <li>{t('sections.s3.items.i3')}</li>
              <li>{t('sections.s3.items.i4')}</li>
              <li>{t('sections.s3.items.i5')}</li>
              <li>{t('sections.s3.items.i6')}</li>
            </ul>
            <p className="mt-4 text-sm text-muted-foreground">
              <strong>{t('sections.s3.note')}</strong>
            </p>
          </section>

          {/* Section 4 - Legal Basis */}
          <section className="mt-8">
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              {t('sections.s4.title')}
            </h2>
            <p>{t('sections.s4.intro')}</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong>{t('sections.s4.items.i1Heading')}</strong>{' '}
                {t('sections.s4.items.i1')}
              </li>
              <li>
                <strong>{t('sections.s4.items.i2Heading')}</strong>{' '}
                {t('sections.s4.items.i2')}
              </li>
              <li>
                <strong>{t('sections.s4.items.i3Heading')}</strong>{' '}
                {t('sections.s4.items.i3')}
              </li>
              <li>
                <strong>{t('sections.s4.items.i4Heading')}</strong>{' '}
                {t('sections.s4.items.i4')}
              </li>
            </ul>
          </section>

          {/* Section 5 - Data Sharing */}
          <section className="mt-8">
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              {t('sections.s5.title')}
            </h2>
            <p>{t('sections.s5.intro')}</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong>{t('sections.s5.items.i1Heading')}</strong>{' '}
                {t('sections.s5.items.i1')}
              </li>
              <li>
                <strong>{t('sections.s5.items.i2Heading')}</strong>{' '}
                {t('sections.s5.items.i2')}
              </li>
            </ul>
          </section>

          {/* Section 6 - Data Retention */}
          <section className="mt-8">
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              {t('sections.s6.title')}
            </h2>
            <p>{t('sections.s6.intro')}</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong>{t('sections.s6.items.i1Heading')}</strong>{' '}
                {t('sections.s6.items.i1')}
              </li>
              <li>
                <strong>{t('sections.s6.items.i2Heading')}</strong>{' '}
                {t('sections.s6.items.i2')}
              </li>
              <li>
                <strong>{t('sections.s6.items.i3Heading')}</strong>{' '}
                {t('sections.s6.items.i3')}
              </li>
            </ul>
            <div className="mt-4 p-4 bg-primary/5 border border-primary/20 rounded-lg">
              <p className="font-semibold text-foreground text-sm">
                {t('sections.s6.warningTitle')}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {t('sections.s6.warningContent')}
              </p>
            </div>
          </section>

          {/* Section 7 - Your Rights */}
          <section className="mt-8">
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              {t('sections.s7.title')}
            </h2>
            <p>{t('sections.s7.intro')}</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong>{t('sections.s7.items.i1Heading')}</strong>{' '}
                {t('sections.s7.items.i1')}
              </li>
              <li>
                <strong>{t('sections.s7.items.i2Heading')}</strong>{' '}
                {t('sections.s7.items.i2')}
              </li>
              <li>
                <strong>{t('sections.s7.items.i3Heading')}</strong>{' '}
                {t('sections.s7.items.i3')}
              </li>
              <li>
                <strong>{t('sections.s7.items.i4Heading')}</strong>{' '}
                {t('sections.s7.items.i4')}
              </li>
              <li>
                <strong>{t('sections.s7.items.i5Heading')}</strong>{' '}
                {t('sections.s7.items.i5')}
              </li>
              <li>
                <strong>{t('sections.s7.items.i6Heading')}</strong>{' '}
                {t('sections.s7.items.i6')}
              </li>
            </ul>
            <p className="mt-4">
              {t('sections.s7.contactNote')}{' '}
              <a href="/contact" className="text-primary hover:underline">
                {t('sections.s7.contactLink')}
              </a>
              {t('sections.s7.contactSuffix')}
            </p>
          </section>

          {/* Section 8 - Security */}
          <section className="mt-8">
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              {t('sections.s8.title')}
            </h2>
            <p>{t('sections.s8.intro')}</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>{t('sections.s8.items.i1')}</li>
              <li>{t('sections.s8.items.i2')}</li>
              <li>{t('sections.s8.items.i3')}</li>
              <li>{t('sections.s8.items.i4')}</li>
              <li>{t('sections.s8.items.i5')}</li>
              <li>{t('sections.s8.items.i6')}</li>
            </ul>
          </section>

          {/* Section 9 - International Transfers */}
          <section className="mt-8">
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              {t('sections.s9.title')}
            </h2>
            <p>{t('sections.s9.content')}</p>
          </section>

          {/* Section 10 - Minors */}
          <section className="mt-8">
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              {t('sections.s10.title')}
            </h2>
            <p>{t('sections.s10.content')}</p>
          </section>

          {/* Section 11 - Policy Changes */}
          <section className="mt-8">
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              {t('sections.s11.title')}
            </h2>
            <p>{t('sections.s11.content')}</p>
          </section>

          {/* Section 12 - Contact */}
          <section className="mt-8">
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              {t('sections.s12.title')}
            </h2>
            <p>
              {t('sections.s12.content')}{' '}
              <a href="/contact" className="text-primary hover:underline">
                {t('sections.s12.contactLink')}
              </a>
              .
            </p>
          </section>

          {/* Section 13 - Supervisory Authority */}
          <section className="mt-8">
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              {t('sections.s13.title')}
            </h2>
            <p>{t('sections.s13.content')}</p>
          </section>
        </article>
      </RevealSection>
    </div>
  );
}
