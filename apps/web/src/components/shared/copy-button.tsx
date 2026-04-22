// src/components/shared/copy-button.tsx
'use client';

import { Check, Copy } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { reportActionError } from '@/lib/browser-logger';
import { cn } from '@/lib/utils';

interface CopyButtonProps {
  text: string;
  className?: string;
  variant?: 'default' | 'ghost' | 'outline';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  copiedLabel?: string;
  copyLabel?: string;
  showLabel?: boolean;
}

export function CopyButton({
  text,
  className,
  variant = 'ghost',
  size = 'icon',
  copiedLabel,
  copyLabel,
  showLabel = false
}: CopyButtonProps) {
  const t = useTranslations('Common');
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      reportActionError(error, {
        action: 'copy-to-clipboard'
      });
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleCopy}
      className={cn(className)}
      aria-label={
        copied ? (copiedLabel ?? t('copied')) : (copyLabel ?? t('copy'))
      }
    >
      {copied ? (
        <Check className="h-4 w-4 text-green-500" />
      ) : (
        <Copy className="h-4 w-4" />
      )}
      {showLabel && (
        <span className="sm:hidden">
          {copied ? (copiedLabel ?? t('copied')) : (copyLabel ?? t('copy'))}
        </span>
      )}
    </Button>
  );
}
