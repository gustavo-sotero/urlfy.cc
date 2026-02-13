'use client';

/**
 * ═════════════════════════════════════════════════════════════════════
 * ROOT ERROR BOUNDARY
 * ═════════════════════════════════════════════════════════════════════
 * Client-side error boundary that catches runtime errors in Route Handlers
 * or Server Components below the root layout.
 * ═════════════════════════════════════════════════════════════════════
 */

import { AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { type JSX, useEffect } from 'react';
import { Button } from '@/components/ui/button';

const texts = {
  en: {
    title: 'Something went wrong',
    description:
      'An unexpected error occurred. Our team has been notified and is working to fix it.',
    retry: 'Try again',
    home: 'Back to home',
    errorId: 'Error ID:',
    details: 'Error details (development only)'
  },
  'pt-br': {
    title: 'Algo deu errado',
    description:
      'Ocorreu um erro inesperado. Nossa equipe foi notificada e está trabalhando para resolver o problema.',
    retry: 'Tentar novamente',
    home: 'Voltar para o início',
    errorId: 'ID do erro:',
    details: 'Detalhes do erro (apenas em desenvolvimento)'
  }
} as const;

function getLocaleFromPath(): 'en' | 'pt-br' {
  if (typeof window === 'undefined') return 'en';
  return window.location.pathname.startsWith('/pt-br') ? 'pt-br' : 'en';
}

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorPage({
  error,
  reset
}: ErrorPageProps): JSX.Element {
  const t = texts[getLocaleFromPath()];

  useEffect(() => {
    console.error('Root error boundary caught:', {
      message: error.message,
      digest: error.digest,
      stack: error.stack
    });
  }, [error]);

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col items-center justify-center gap-6 px-4 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-destructive/10">
        <AlertTriangle className="h-10 w-10 text-destructive" />
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
        <Button onClick={reset} size="lg">
          {t.retry}
        </Button>
        <Button asChild variant="outline" size="lg">
          <Link href="/">{t.home}</Link>
        </Button>
      </div>

      {error.digest && (
        <p className="mt-8 text-sm text-muted-foreground">
          {t.errorId} <span className="font-mono">{error.digest}</span>
        </p>
      )}

      {process.env.NODE_ENV === 'development' && (
        <details className="mt-4 max-w-2xl text-left">
          <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground">
            {t.details}
          </summary>
          <pre className="mt-2 overflow-auto rounded-lg bg-muted p-4 text-xs">
            <code>{error.message}</code>
            {error.stack && (
              <>
                {'\n\n'}
                <code className="text-muted-foreground">{error.stack}</code>
              </>
            )}
          </pre>
        </details>
      )}
    </div>
  );
}
