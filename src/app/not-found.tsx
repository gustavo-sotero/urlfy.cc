/**
 * ═════════════════════════════════════════════════════════════════════
 * GLOBAL 404 PAGE (NOT FOUND)
 * ═════════════════════════════════════════════════════════════════════
 * Handles unknown routes gracefully with a branded error page.
 * Next.js automatically serves this when no matching route is found.
 * ═════════════════════════════════════════════════════════════════════
 */

import { FileQuestion } from 'lucide-react';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import Link from 'next/link';
import type { JSX } from 'react';
import { Button } from '@/components/ui/button';

const texts = {
  en: {
    title: 'Page not found',
    description:
      'The content you are looking for does not exist or has been moved.',
    home: 'Back to home',
    help: 'Help center',
    errorCode: 'Error code:'
  },
  'pt-br': {
    title: 'Página não encontrada',
    description: 'O conteúdo que você procura não existe ou foi movido.',
    home: 'Voltar para o início',
    help: 'Central de ajuda',
    errorCode: 'Código de erro:'
  }
} as const;

export const metadata: Metadata = {
  title: 'Page not found - urlfy.cc',
  description: 'The page you are looking for does not exist or has been moved.',
  robots: {
    index: false,
    follow: true
  }
};

export default async function NotFound(): Promise<JSX.Element> {
  const headersList = await headers();
  const url = headersList.get('x-url') || headersList.get('referer') || '';
  const locale = url.includes('/pt-br') ? 'pt-br' : 'en';
  const t = texts[locale];

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col items-center justify-center gap-6 px-4 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted">
        <FileQuestion className="h-10 w-10 text-muted-foreground" />
      </div>

      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
          {t.title}
        </h1>
        <p className="text-lg text-muted-foreground max-w-md">
          {t.description}
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
        <Button asChild size="lg">
          <Link href="/">{t.home}</Link>
        </Button>
        <Button asChild variant="outline" size="lg">
          <Link href="/help">{t.help}</Link>
        </Button>
      </div>

      <p className="mt-8 text-sm text-muted-foreground">
        {t.errorCode} <span className="font-mono">404</span>
      </p>
    </div>
  );
}
