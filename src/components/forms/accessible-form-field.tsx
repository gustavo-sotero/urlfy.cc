// src/components/forms/accessible-form-field.tsx

import { AlertCircle } from 'lucide-react';
import type { ReactNode } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface FormFieldProps {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children?: ReactNode;
}

export function AccessibleFormField({
  id,
  label,
  error,
  hint,
  required,
  children
}: FormFieldProps) {
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        {label}
        {required && (
          <span className="ml-1 text-destructive" title="obrigatório">
            *
          </span>
        )}
      </Label>

      {hint && (
        <p id={hintId} className="text-sm text-muted-foreground">
          {hint}
        </p>
      )}

      {children || (
        <Input
          id={id}
          aria-invalid={!!error}
          aria-describedby={cn(error && errorId, hint && hintId)}
          aria-required={required}
        />
      )}

      {error && (
        <div
          id={errorId}
          className="flex items-center gap-2 text-sm text-destructive"
          role="alert"
        >
          <AlertCircle className="h-4 w-4" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
