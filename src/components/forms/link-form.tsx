// src/components/forms/link-form.tsx
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Check, Link as LinkIcon, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { CopyButton } from '@/components/shared/copy-button';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCreateLink } from '@/lib/hooks/use-links';

const schema = z.object({
  url: z.url('URL inválida')
});

type FormData = z.infer<typeof schema>;

interface Props {
  variant: 'landing' | 'dashboard';
}

export function LinkForm({ variant: _variant }: Props) {
  const [result, setResult] = useState<{ shortUrl: string } | null>(null);
  const createLink = useCreateLink();

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
      console.error('Failed to create link:', error);
    }
  };

  if (result) {
    return (
      <div className="flex flex-col gap-4 rounded-lg border bg-card p-6">
        <div className="flex items-center gap-2 text-green-600">
          <Check className="h-5 w-5" />
          <span className="font-medium">Link criado com sucesso!</span>
        </div>
        <div className="flex items-center gap-2">
          <Input
            value={result.shortUrl}
            readOnly
            className="font-mono"
            data-testid="short-url"
          />
          <CopyButton text={result.shortUrl} variant="default" size="default" />
        </div>
        <Button
          variant="outline"
          onClick={() => {
            setResult(null);
            form.reset();
          }}
        >
          Criar outro link
        </Button>
      </div>
    );
  }

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      className="flex flex-col gap-4 sm:flex-row"
    >
      <div className="flex-1">
        <Input
          {...form.register('url')}
          type="url"
          placeholder="Cole sua URL aqui..."
          className="h-12"
          disabled={createLink.isPending}
          aria-invalid={!!form.formState.errors.url}
          aria-describedby={form.formState.errors.url ? 'url-error' : undefined}
        />
        {form.formState.errors.url && (
          <p id="url-error" className="mt-1 text-sm text-destructive">
            {form.formState.errors.url.message}
          </p>
        )}
      </div>
      <Button
        type="submit"
        size="lg"
        disabled={createLink.isPending}
        className="h-12"
      >
        {createLink.isPending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Criando...
          </>
        ) : (
          <>
            <LinkIcon className="mr-2 h-4 w-4" />
            Encurtar
          </>
        )}
      </Button>
    </form>
  );
}
