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

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorPage({
  error,
  reset
}: ErrorPageProps): JSX.Element {
  useEffect(() => {
    // Log the error to console for development/debugging
    // In production, this could be sent to error tracking service (e.g., Sentry, SigNoz)
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
          Algo deu errado
        </h1>
        <p className="text-lg text-muted-foreground max-w-md">
          Ocorreu um erro inesperado. Nossa equipe foi notificada e está
          trabalhando para resolver o problema.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
        <Button onClick={reset} size="lg">
          Tentar novamente
        </Button>
        <Button asChild variant="outline" size="lg">
          <Link href="/">Voltar para o início</Link>
        </Button>
      </div>

      {error.digest && (
        <p className="mt-8 text-sm text-muted-foreground">
          ID do erro: <span className="font-mono">{error.digest}</span>
        </p>
      )}

      {process.env.NODE_ENV === 'development' && (
        <details className="mt-4 max-w-2xl text-left">
          <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground">
            Detalhes do erro (apenas em desenvolvimento)
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
