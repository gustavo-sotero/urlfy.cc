// src/components/query-error.tsx

import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface QueryErrorProps {
  error: Error;
  onRetry?: () => void;
  title?: string;
  retryLabel?: string;
}

export function QueryError({
  error,
  onRetry,
  title,
  retryLabel
}: QueryErrorProps) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-4 rounded-lg border border-destructive/20 bg-destructive/5 p-8 text-center"
      role="alert"
    >
      <AlertCircle className="h-10 w-10 text-destructive" />
      <div className="space-y-1">
        <h3 className="font-semibold">
          {title ?? 'Error loading data / Erro ao carregar dados'}
        </h3>
        <p className="text-sm text-muted-foreground">{error.message}</p>
      </div>
      {onRetry && (
        <Button onClick={onRetry} variant="outline" size="sm">
          <RefreshCw className="mr-2 h-4 w-4" />
          {retryLabel ?? 'Try again / Tentar novamente'}
        </Button>
      )}
    </div>
  );
}
