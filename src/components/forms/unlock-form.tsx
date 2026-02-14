// src/components/forms/unlock-form.tsx
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Unlock } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { verifyLinkPassword } from '@/lib/api';

function createSchema(passwordMsg: string) {
  return z.object({
    password: z.string().min(1, passwordMsg)
  });
}

type FormData = z.infer<ReturnType<typeof createSchema>>;

interface Props {
  code: string;
}

export function UnlockForm({ code }: Props) {
  const t = useTranslations('Unlock');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const schema = createSchema(t('errors.passwordRequired'));

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      password: ''
    }
  });

  const onSubmit = async (data: FormData) => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await verifyLinkPassword(code, data.password);
      // Redirect to the link
      router.push(result.redirectUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.wrongPassword'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="password">{t('passwordLabel')}</Label>
        <Input
          id="password"
          type="password"
          {...form.register('password')}
          placeholder={t('passwordPlaceholder')}
          disabled={isLoading}
          aria-invalid={!!form.formState.errors.password || !!error}
          aria-describedby={
            form.formState.errors.password || error
              ? 'password-error'
              : undefined
          }
        />
        {form.formState.errors.password && (
          <p id="password-error" className="text-sm text-destructive">
            {form.formState.errors.password.message}
          </p>
        )}
        {error && (
          <p id="password-error" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </div>

      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {t('verifying')}
          </>
        ) : (
          <>
            <Unlock className="mr-2 h-4 w-4" />
            {t('unlock')}
          </>
        )}
      </Button>
    </form>
  );
}
