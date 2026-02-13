/**
 * ═════════════════════════════════════════════════════════════════════
 * GLOBAL 404 PAGE (NOT FOUND)
 * ═════════════════════════════════════════════════════════════════════
 * Handles unknown routes gracefully with a branded error page.
 * Next.js automatically serves this when no matching route is found.
 * ═════════════════════════════════════════════════════════════════════
 */

import { Button } from '@/components/ui/button';
import { FileQuestion } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import type { JSX } from 'react';

export const metadata: Metadata = {
  title: 'Page not found - urlfy.cc',
  description: 'The page you are looking for does not exist or has been moved.',
  robots: {
    index: false,
    follow: true
  }
};

export default function NotFound(): JSX.Element {
  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col items-center justify-center gap-6 px-4 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted">
        <FileQuestion className="h-10 w-10 text-muted-foreground" />
      </div>

      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
          Page not found
        </h1>
        <p className="text-muted-foreground">Página não encontrada</p>
        <p className="text-lg text-muted-foreground max-w-md">
          The content you are looking for does not exist or has been moved. / O
          conteúdo que você procura não existe ou foi movido.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
        <Button asChild size="lg">
          <Link href="/">Back to home / Voltar para o início</Link>
        </Button>
        <Button asChild variant="outline" size="lg">
          <Link href="/help">Help center / Central de ajuda</Link>
        </Button>
      </div>

      <p className="mt-8 text-sm text-muted-foreground">
        Error code / Código de erro: <span className="font-mono">404</span>
      </p>
    </div>
  );
}
