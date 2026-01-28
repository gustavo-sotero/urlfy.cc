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
import Link from 'next/link';
import type { JSX } from 'react';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'Página não encontrada - urlfy.cc',
  description: 'A página que você procura não existe ou foi movida.',
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
          Página não encontrada
        </h1>
        <p className="text-lg text-muted-foreground max-w-md">
          O conteúdo que você procura não existe ou foi movido.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
        <Button asChild size="lg">
          <Link href="/">Voltar para o início</Link>
        </Button>
        <Button asChild variant="outline" size="lg">
          <Link href="/help">Central de ajuda</Link>
        </Button>
      </div>

      <p className="mt-8 text-sm text-muted-foreground">
        Código de erro: <span className="font-mono">404</span>
      </p>
    </div>
  );
}
