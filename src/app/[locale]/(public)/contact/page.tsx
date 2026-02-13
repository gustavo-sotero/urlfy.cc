import { Github, Linkedin, MessageCircle } from 'lucide-react';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { ContactForm } from '@/components/forms/contact-form';
import { RevealSection } from '@/components/shared/reveal-section';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Contact');
  return {
    title: t('metaTitle'),
    description: t('metaDescription')
  };
}

export default async function ContactPage() {
  const t = await getTranslations('Contact');

  return (
    <div className="container mx-auto max-w-4xl px-4 py-12 scroll-smooth">
      {/* Header */}
      <RevealSection>
        <div className="mb-12 text-center">
          <h1 className="mb-4 text-4xl font-bold tracking-tight">
            {t('title')}
          </h1>
          <p className="text-lg text-muted-foreground">{t('subtitle')}</p>
        </div>
      </RevealSection>

      <RevealSection delay={200}>
        <div className="grid gap-8 lg:grid-cols-3">
          {/* Contact Form */}
          <div className="lg:col-span-2">
            <div className="rounded-lg border bg-card p-6 shadow-sm">
              <h2 className="mb-6 text-2xl font-semibold">
                {t('sendUsMessage')}
              </h2>
              <ContactForm />
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Social Links */}
            <div className="rounded-lg border bg-card p-6 shadow-sm">
              <h3 className="mb-4 font-semibold">{t('connectWithUs')}</h3>
              <div className="space-y-3">
                <a
                  href="https://github.com/yourusername/urlfy.cc"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 rounded-md p-2 transition-colors hover:bg-accent"
                >
                  <Github className="h-5 w-5" />
                  <span>GitHub</span>
                </a>
                <a
                  href="https://linkedin.com/in/yourprofile"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 rounded-md p-2 transition-colors hover:bg-accent"
                >
                  <Linkedin className="h-5 w-5" />
                  <span>LinkedIn</span>
                </a>
                <a
                  href="https://t.me/yourusername"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 rounded-md p-2 transition-colors hover:bg-accent"
                >
                  <MessageCircle className="h-5 w-5" />
                  <span>Telegram</span>
                </a>
              </div>
            </div>

            {/* FAQ Link */}
            <div className="rounded-lg border bg-card p-6 shadow-sm">
              <h3 className="mb-2 font-semibold">{t('quickLinks')}</h3>
              <div className="space-y-2">
                <a
                  href="/help"
                  className="block text-sm text-muted-foreground hover:text-foreground"
                >
                  {t('helpCenter')}
                </a>
                <a
                  href="/about"
                  className="block text-sm text-muted-foreground hover:text-foreground"
                >
                  {t('aboutUs')}
                </a>
                <a
                  href="/terms"
                  className="block text-sm text-muted-foreground hover:text-foreground"
                >
                  {t('termsOfService')}
                </a>
                <a
                  href="/privacy"
                  className="block text-sm text-muted-foreground hover:text-foreground"
                >
                  {t('privacyPolicy')}
                </a>
              </div>
            </div>

            {/* Response Time Notice */}
            <div className="rounded-lg border bg-muted/50 p-6">
              <p className="text-sm text-muted-foreground">
                {t('responseTime')}
              </p>
            </div>
          </div>
        </div>
      </RevealSection>
    </div>
  );
}
