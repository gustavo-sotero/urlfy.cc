/**
 * ═════════════════════════════════════════════════════════════════════
 * HELP & FAQ PAGE
 * ═════════════════════════════════════════════════════════════════════
 * Support page with frequently asked questions and help documentation.
 * ═════════════════════════════════════════════════════════════════════
 */

import { Mail } from 'lucide-react';
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
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Link } from '@/i18n/routing';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Help');
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
    robots: {
      index: true,
      follow: true
    }
  };
}

export default async function HelpPage(): Promise<JSX.Element> {
  const t = await getTranslations('Help');

  return (
    <div className="container mx-auto max-w-4xl px-4 py-16 scroll-smooth">
      <div className="space-y-8">
        <RevealSection>
          <div className="space-y-4 text-center">
            <h1 className="text-4xl font-bold tracking-tight">{t('title')}</h1>
            <p className="text-lg text-muted-foreground">{t('subtitle')}</p>
          </div>
        </RevealSection>

        {/* FAQ Section */}
        <RevealSection delay={200}>
          <section className="mt-12">
            <h2 className="mb-6 text-2xl font-semibold">{t('faqTitle')}</h2>

            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="item-1">
                <AccordionTrigger>{t('faq.q1.question')}</AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-2 text-muted-foreground">
                    <p>{t('faq.q1.intro')}</p>
                    <ol className="list-decimal pl-6 space-y-2">
                      <li>{t('faq.q1.steps.s1')}</li>
                      <li>{t('faq.q1.steps.s2')}</li>
                      <li>{t('faq.q1.steps.s3')}</li>
                      <li>{t('faq.q1.steps.s4')}</li>
                    </ol>
                    <p className="mt-4">{t('faq.q1.note')}</p>
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-2">
                <AccordionTrigger>{t('faq.q2.question')}</AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-2 text-muted-foreground">
                    <p>{t('faq.q2.content')}</p>
                    <p className="mt-2">{t('faq.q2.tip')}</p>
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-3">
                <AccordionTrigger>{t('faq.q3.question')}</AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-2 text-muted-foreground">
                    <p>{t('faq.q3.intro')}</p>
                    <ol className="list-decimal pl-6 space-y-2">
                      <li>{t('faq.q3.steps.s1')}</li>
                      <li>{t('faq.q3.steps.s2')}</li>
                      <li>{t('faq.q3.steps.s3')}</li>
                    </ol>
                    <p className="mt-4">{t('faq.q3.note')}</p>
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-4">
                <AccordionTrigger>{t('faq.q4.question')}</AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-2 text-muted-foreground">
                    <p>{t('faq.q4.content')}</p>
                    <p className="mt-2">{t('faq.q4.tip')}</p>
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-5">
                <AccordionTrigger>{t('faq.q5.question')}</AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-2 text-muted-foreground">
                    <p>{t('faq.q5.content')}</p>
                    <p className="mt-2">{t('faq.q5.note')}</p>
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-6">
                <AccordionTrigger>{t('faq.q6.question')}</AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-2 text-muted-foreground">
                    <p>{t('faq.q6.intro')}</p>
                    <ol className="list-decimal pl-6 space-y-2">
                      <li>{t('faq.q6.steps.s1')}</li>
                      <li>{t('faq.q6.steps.s2')}</li>
                      <li>{t('faq.q6.steps.s3')}</li>
                      <li>{t('faq.q6.steps.s4')}</li>
                    </ol>
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-7">
                <AccordionTrigger>{t('faq.q7.question')}</AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-2 text-muted-foreground">
                    <p>{t('faq.q7.intro')}</p>
                    <ul className="list-disc pl-6 space-y-2">
                      <li>{t('faq.q7.items.i1')}</li>
                      <li>{t('faq.q7.items.i2')}</li>
                      <li>{t('faq.q7.items.i3')}</li>
                      <li>{t('faq.q7.items.i4')}</li>
                    </ul>
                    <p className="mt-4">
                      {t('faq.q7.linkText')}{' '}
                      <Link
                        href="/privacy"
                        className="text-primary hover:underline"
                      >
                        {t('faq.q7.privacyLink')}
                      </Link>{' '}
                      {t('faq.q7.linkSuffix')}
                    </p>
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-8">
                <AccordionTrigger>{t('faq.q8.question')}</AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-2 text-muted-foreground">
                    <p className="text-sm text-muted-foreground">
                      <strong>{t('faq.q8.content')}</strong>
                    </p>
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-9">
                <AccordionTrigger>{t('faq.q9.question')}</AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-2 text-muted-foreground">
                    <p>{t('faq.q9.intro')}</p>
                    <ul className="list-disc pl-6 space-y-2">
                      <li>{t('faq.q9.items.i1')}</li>
                      <li>{t('faq.q9.items.i2')}</li>
                      <li>{t('faq.q9.items.i3')}</li>
                    </ul>
                    <p className="mt-4">{t('faq.q9.note')}</p>
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-10">
                <AccordionTrigger>{t('faq.q10.question')}</AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-2 text-muted-foreground">
                    <p>{t('faq.q10.content')}</p>
                    <p className="mt-2">{t('faq.q10.tip')}</p>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </section>
        </RevealSection>

        {/* Contact Section */}
        <RevealSection delay={400}>
          <section className="mt-16">
            <h2 className="mb-6 text-2xl font-semibold">
              {t('contactSection.title')}
            </h2>

            <div className="flex justify-center">
              <Card className="max-w-md w-full">
                <CardContent className="flex flex-col items-center gap-4 p-6 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                    <Mail className="h-6 w-6 text-primary" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="font-semibold">
                      {t('contactSection.cardTitle')}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {t('contactSection.cardDescription')}
                    </p>
                  </div>
                  <Button asChild variant="outline" className="w-full">
                    <Link href="/contact">
                      {t('contactSection.sendMessage')}
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            </div>
          </section>
        </RevealSection>
      </div>
    </div>
  );
}
