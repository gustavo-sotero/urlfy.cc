// src/components/query-error.tsx

import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface QueryErrorProps {
  error: Error;
  onRetry?: () => void;
  title?: string;
}

export function QueryError({
  error,
  onRetry,
  title = "Erro ao carregar dados",
}: QueryErrorProps) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-4 rounded-lg border border-destructive/20 bg-destructive/5 p-8 text-center"
      role="alert"
    >
      <AlertCircle className="h-10 w-10 text-destructive" />
      <div className="space-y-1">
        <h3 className="font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground">{error.message}</p>
      </div>
      {onRetry && (
        <Button onClick={onRetry} variant="outline" size="sm">
          <RefreshCw className="mr-2 h-4 w-4" />
          Tentar novamente
        </Button>
      )}
    </div>
  );
}
