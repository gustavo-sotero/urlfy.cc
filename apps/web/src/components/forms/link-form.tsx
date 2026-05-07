// src/components/forms/link-form.tsx
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Check, Link as LinkIcon, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { AccessibleFormField } from '@/components/forms/accessible-form-field';
import { CopyButton } from '@/components/shared/copy-button';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { reportActionError } from '@/lib/browser-logger';
import { useCreateLink } from '@/lib/hooks/use-links';

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
    }
  };

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
      className="flex flex-col gap-4 sm:flex-row"
    >
      <div className="min-w-0 flex-1">
        <AccessibleFormField
          id="guest-url"
          label={t('label')}
          error={form.formState.errors.url?.message}
        >
          <Input
            {...form.register('url')}
            type="url"
            placeholder={t('placeholder')}
            className="h-12"
            disabled={createLink.isPending}
          />
        </AccessibleFormField>
      </div>
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
    </form>
  );
}
