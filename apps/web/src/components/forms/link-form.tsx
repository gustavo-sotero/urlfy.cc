// src/components/forms/link-form.tsx
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle, Check, Link as LinkIcon, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { CopyButton } from '@/components/shared/copy-button';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiClientError } from '@/lib/api/error';
import { reportActionError } from '@/lib/browser-logger';
import { useCreateLink } from '@/lib/hooks/use-links';

const ERROR_CODE_TO_MESSAGE_KEY = {
  SHORTENER_NOT_ALLOWED: 'urlBlockedShortener',
  URL_TOO_LONG: 'urlTooLong',
  URL_BLOCKED: 'urlBlocked',
  RATE_LIMITED: 'rateLimited',
  INVALID_URL: 'invalidUrl'
} as const;

export function LinkForm() {
  const t = useTranslations('LinkForm.guest');
  const [result, setResult] = useState<{ shortUrl: string } | null>(null);
  const createLink = useCreateLink();

  const schema = useMemo(
    () =>
      z.object({
        url: z.url(t('invalidUrl'))
      }),
    [t]
  );

  type FormData = z.infer<typeof schema>;

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      url: ''
    }
  });

  const onSubmit = async (data: FormData) => {
    try {
      const link = await createLink.mutateAsync(data);
      setResult({ shortUrl: link.shortUrl });
    } catch (error) {
      reportActionError(error, { action: 'create-link' });
      if (error instanceof ApiClientError) {
        const messageKey =
          (ERROR_CODE_TO_MESSAGE_KEY as Record<string, string>)[error.code] ??
          'serverError';
        form.setError('url', { message: t(messageKey) }, { shouldFocus: true });
      } else {
        form.setError('url', { message: t('serverError') });
      }
    }
  };

  const urlError = form.formState.errors.url?.message;

  if (result) {
    return (
      <div className="flex flex-col gap-4 rounded-lg border bg-card p-6">
        <div className="flex items-center gap-2 text-green-600">
          <Check className="h-5 w-5" />
          <span className="font-medium">{t('successMessage')}</span>
        </div>
        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
          <Input
            value={result.shortUrl}
            readOnly
            className="min-w-0 font-mono"
            data-testid="short-url"
            aria-label={t('shortUrlLabel')}
          />
          <CopyButton
            text={result.shortUrl}
            variant="default"
            size="default"
            className="w-full sm:w-auto"
            showLabel
          />
        </div>
        <Button
          variant="outline"
          className="w-full sm:w-auto"
          onClick={() => {
            setResult(null);
            form.reset();
          }}
        >
          {t('createAnother')}
        </Button>
      </div>
    );
  }

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      className="flex flex-col gap-2"
    >
      <Label htmlFor="guest-url">{t('label')}</Label>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input
          {...form.register('url')}
          id="guest-url"
          type="url"
          placeholder={t('placeholder')}
          className="h-12 min-w-0 flex-1"
          disabled={createLink.isPending}
          aria-invalid={!!urlError}
          aria-describedby={urlError ? 'guest-url-error' : undefined}
        />
        <Button
          type="submit"
          size="lg"
          disabled={createLink.isPending}
          className="h-12 w-full sm:w-auto"
        >
          {createLink.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t('creating')}
            </>
          ) : (
            <>
              <LinkIcon className="mr-2 h-4 w-4" />
              {t('shorten')}
            </>
          )}
        </Button>
      </div>
      {urlError && (
        <p
          id="guest-url-error"
          role="alert"
          className="flex items-center gap-1.5 text-sm font-medium text-destructive"
        >
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          {urlError}
        </p>
      )}
    </form>
  );
}
