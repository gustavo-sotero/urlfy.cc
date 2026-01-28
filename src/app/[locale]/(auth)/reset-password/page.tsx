/**
 * ═════════════════════════════════════════════════════════════════════
 * RESET PASSWORD PAGE (Internationalized)
 * ═════════════════════════════════════════════════════════════════════
 * Password reset form with token validation.
 * Allows user to set new password.
 * Fully internationalized with next-intl.
 * ═════════════════════════════════════════════════════════════════════
 */

'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, CheckCircle2, Loader2 } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Suspense, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { AccessibleFormField } from '@/components/forms/accessible-form-field';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Link } from '@/i18n/routing';
import { authClient } from '@/lib/auth.client';

function ResetPasswordForm() {
  const t = useTranslations('Auth.resetPassword');
  const tErrors = useTranslations('Auth.errors');
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Define schema with translated messages
  const schema = z
    .object({
      newPassword: z.string().min(8, tErrors('passwordMin', { min: 8 })),
      confirmPassword: z.string()
    })
    .refine((data) => data.newPassword === data.confirmPassword, {
      message: tErrors('passwordsNoMatch'),
      path: ['confirmPassword']
    });

  type FormData = z.infer<typeof schema>;

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      newPassword: '',
      confirmPassword: ''
    }
  });

  const onSubmit = async (data: FormData) => {
    if (!token) {
      setError(t('errorTokenMissing'));
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await authClient.resetPassword({
        newPassword: data.newPassword,
        token
      });

      if (result.error) {
        // Handle specific error cases
        if (
          result.error.message?.includes('invalid') ||
          result.error.message?.includes('expired')
        ) {
          setError(t('errorTokenInvalid'));
        } else {
          setError(result.error.message || tErrors('tryAgain'));
        }
        return;
      }

      // Success
      setSuccess(true);
    } catch {
      setError(tErrors('tryAgain'));
    } finally {
      setIsLoading(false);
    }
  };

  // Show error if token is missing
  if (!token) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">{t('title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md bg-destructive/10 p-4" role="alert">
            <p className="text-sm text-destructive">{t('errorTokenMissing')}</p>
          </div>
          <Button asChild variant="outline" className="w-full">
            <Link href="/forgot-password">
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t('backToLogin')}
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">{t('title')}</CardTitle>
        <CardDescription>{t('subtitle')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {success ? (
          /* Success State */
          <div className="space-y-4">
            <div className="rounded-md bg-green-50 p-4 dark:bg-green-950">
              <div className="flex">
                <div className="shrink-0">
                  <CheckCircle2 className="h-5 w-5 text-green-400" />
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-green-800 dark:text-green-200">
                    {t('successTitle')}
                  </h3>
                  <p className="mt-2 text-sm text-green-700 dark:text-green-300">
                    {t('successMessage')}
                  </p>
                </div>
              </div>
            </div>

            <Button asChild className="w-full">
              <Link href="/login">
                <ArrowLeft className="mr-2 h-4 w-4" />
                {t('backToLogin')}
              </Link>
            </Button>
          </div>
        ) : (
          /* Form State */
          <>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <AccessibleFormField
                id="newPassword"
                label={t('newPassword')}
                required
                error={form.formState.errors.newPassword?.message}
                hint={t('passwordHint')}
              >
                <Input
                  id="newPassword"
                  type="password"
                  placeholder={t('placeholders.newPassword')}
                  {...form.register('newPassword')}
                  disabled={isLoading}
                  aria-invalid={!!form.formState.errors.newPassword}
                  autoFocus
                />
              </AccessibleFormField>

              <AccessibleFormField
                id="confirmPassword"
                label={t('confirmPassword')}
                required
                error={form.formState.errors.confirmPassword?.message}
              >
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder={t('placeholders.confirmPassword')}
                  {...form.register('confirmPassword')}
                  disabled={isLoading}
                  aria-invalid={!!form.formState.errors.confirmPassword}
                />
              </AccessibleFormField>

              {error && (
                <div
                  className="rounded-md bg-destructive/10 p-3 text-sm text-destructive"
                  role="alert"
                >
                  {error}
                </div>
              )}

              <div className="rounded-md bg-yellow-50 p-3 dark:bg-yellow-950">
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  ⏱️ {t('expiryNote')}
                </p>
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('resetting')}
                  </>
                ) : (
                  t('resetButton')
                )}
              </Button>
            </form>

            <Button asChild variant="ghost" className="w-full">
              <Link href="/login">
                <ArrowLeft className="mr-2 h-4 w-4" />
                {t('backToLogin')}
              </Link>
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <Card className="w-full max-w-md">
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
