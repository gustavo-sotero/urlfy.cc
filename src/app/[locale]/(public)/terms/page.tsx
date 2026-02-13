/**
 * ═════════════════════════════════════════════════════════════════════
 * TERMS OF SERVICE PAGE
 * ═════════════════════════════════════════════════════════════════════
 * Legal terms and conditions for using urlfy.cc services.
 * ═════════════════════════════════════════════════════════════════════
 */

import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import type { JSX } from 'react';
import { RevealSection } from '@/components/shared/reveal-section';
import { Link } from '@/i18n/routing';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Terms');
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
    robots: {
      index: true,
      follow: true
    }
  };
}

export default async function TermsPage(): Promise<JSX.Element> {
  const t = await getTranslations('Terms');
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

          <section className="mt-8">
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              {t('sections.s1.title')}
            </h2>
            <p>{t('sections.s1.content')}</p>
            <div className="mt-4 p-4 bg-primary/5 border border-primary/20 rounded-lg">
              <p className="font-semibold text-foreground">
                {t('sections.s1.warningTitle')}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {t('sections.s1.warningContent')}
              </p>
            </div>
          </section>

          <section className="mt-8">
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              {t('sections.s2.title')}
            </h2>
            <p>{t('sections.s2.content')}</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>{t('sections.s2.items.i1')}</li>
              <li>{t('sections.s2.items.i2')}</li>
              <li>{t('sections.s2.items.i3')}</li>
              <li>{t('sections.s2.items.i4')}</li>
              <li>{t('sections.s2.items.i5')}</li>
            </ul>
            <p className="mt-4 text-sm text-muted-foreground">
              <strong>{t('sections.s2.disclaimer')}</strong>
            </p>
          </section>

          <section className="mt-8">
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              {t('sections.s3.title')}
            </h2>
            <h3 className="text-xl font-semibold mt-6 mb-3">
              {t('sections.s3.sub1Title')}
            </h3>
            <p>{t('sections.s3.sub1Content')}</p>
            <h3 className="text-xl font-semibold mt-6 mb-3">
              {t('sections.s3.sub2Title')}
            </h3>
            <p>{t('sections.s3.sub2Content')}</p>
          </section>

          <section className="mt-8">
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              {t('sections.s4.title')}
            </h2>
            <p>{t('sections.s4.content')}</p>
            <p className="mt-4">{t('sections.s4.prohibitedIntro')}</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>{t('sections.s4.items.i1')}</li>
              <li>{t('sections.s4.items.i2')}</li>
              <li>{t('sections.s4.items.i3')}</li>
              <li>{t('sections.s4.items.i4')}</li>
              <li>{t('sections.s4.items.i5')}</li>
              <li>{t('sections.s4.items.i6')}</li>
              <li>{t('sections.s4.items.i7')}</li>
            </ul>
            <p className="mt-4 text-sm text-muted-foreground">
              <strong>{t('sections.s4.note')}</strong>
            </p>
          </section>

          <section className="mt-8">
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              {t('sections.s5.title')}
            </h2>
            <h3 className="text-xl font-semibold mt-6 mb-3">
              {t('sections.s5.sub1Title')}
            </h3>
            <p>{t('sections.s5.sub1Content')}</p>
            <h3 className="text-xl font-semibold mt-6 mb-3">
              {t('sections.s5.sub2Title')}
            </h3>
            <p>{t('sections.s5.sub2Content')}</p>
          </section>

          <section className="mt-8">
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              {t('sections.s6.title')}
            </h2>
            <p>{t('sections.s6.content')}</p>
          </section>

          <section className="mt-8">
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              {t('sections.s7.title')}
            </h2>
            <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
              <p className="font-semibold text-foreground mb-2">
                {t('sections.s7.warningTitle')}
              </p>
              <p>{t('sections.s7.warningContent')}</p>
              <ul className="list-disc pl-6 space-y-2 mt-2">
                <li>{t('sections.s7.items.i1')}</li>
                <li>{t('sections.s7.items.i2')}</li>
                <li>{t('sections.s7.items.i3')}</li>
                <li>{t('sections.s7.items.i4')}</li>
                <li>{t('sections.s7.items.i5')}</li>
              </ul>
            </div>
            <p className="mt-4">{t('sections.s7.content2')}</p>
            <p className="mt-4 text-sm text-muted-foreground">
              <strong>{t('sections.s7.recommendation')}</strong>
            </p>
          </section>

          <section className="mt-8">
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              {t('sections.s8.title')}
            </h2>
            <p>{t('sections.s8.content')}</p>
          </section>

          <section className="mt-8">
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              {t('sections.s9.title')}
            </h2>
            <p>{t('sections.s9.content')}</p>
          </section>

          <section className="mt-8">
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              {t('sections.s10.title')}
            </h2>
            <p>
              {t('sections.s10.content')}{' '}
              <Link href="/contact" className="text-primary hover:underline">
                {t('sections.s10.contactLink')}
              </Link>
            </p>
          </section>
        </article>
      </RevealSection>
    </div>
  );
}
