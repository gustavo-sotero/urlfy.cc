// src/components/forms/accessible-form-field.tsx

import { AlertCircle } from 'lucide-react';
import {
  cloneElement,
  isValidElement,
  type ReactElement,
  type ReactNode
} from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface FormFieldProps {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children?: ReactNode;
}

interface AccessibleChildProps {
  id?: string;
  'aria-invalid'?: boolean;
  'aria-describedby'?: string;
  'aria-required'?: boolean;
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
  const describedBy = [hint ? hintId : null, error ? errorId : null]
    .filter(Boolean)
    .join(' ');
  const childElement = isValidElement(children)
    ? (children as ReactElement<AccessibleChildProps>)
    : null;
  const childProps = childElement?.props;
  const field = childElement
    ? cloneElement(childElement, {
        id: childProps?.id ?? id,
        'aria-invalid': error ? true : childProps?.['aria-invalid'],
        'aria-describedby': [describedBy, childProps?.['aria-describedby']]
          .filter(Boolean)
          .join(' '),
        'aria-required': required || childProps?.['aria-required']
      })
    : null;

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        {label}
        {required && (
          <span className="ml-1 text-destructive" aria-hidden="true">
            *
          </span>
        )}
      </Label>

      {hint && (
        <p id={hintId} className="text-sm text-muted-foreground">
          {hint}
        </p>
      )}

      {field || (
        <Input
          id={id}
          aria-invalid={!!error}
          aria-describedby={describedBy || undefined}
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
