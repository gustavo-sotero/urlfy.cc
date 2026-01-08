// src/components/ui/accessible-button.tsx

import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { type ButtonHTMLAttributes, forwardRef, type ReactNode } from 'react';

interface AccessibleButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  isLoading?: boolean;
  loadingText?: string;
  children: ReactNode;
  variant?:
    | 'default'
    | 'destructive'
    | 'outline'
    | 'ghost'
    | 'secondary'
    | 'link';
}

export const AccessibleButton = forwardRef<
  HTMLButtonElement,
  AccessibleButtonProps
>(({ isLoading, loadingText, children, disabled, ...props }, ref) => {
  return (
    <Button
      ref={ref}
      disabled={disabled || isLoading}
      aria-busy={isLoading}
      aria-disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
          <span>{loadingText || 'Carregando...'}</span>
        </>
      ) : (
        children
      )}
    </Button>
  );
});

AccessibleButton.displayName = 'AccessibleButton';
