/**
 * ═════════════════════════════════════════════════════════════════════
 * FORGOT PASSWORD PAGE (Internationalized)
 * ═════════════════════════════════════════════════════════════════════
 * Password reset request form.
 * Sends reset link via email.
 * Fully internationalized with next-intl.
 * ═════════════════════════════════════════════════════════════════════
 */

'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Loader2, Mail } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
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

export default function ForgotPasswordPage() {
  const t = useTranslations('Auth.forgotPassword');
  const tErrors = useTranslations('Auth.errors');

  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Define schema with translated messages
  const schema = z.object({
    email: z.string().email(tErrors('invalidEmail'))
  });

  type FormData = z.infer<typeof schema>;

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: ''
    }
  });

  const onSubmit = async (data: FormData) => {
    setIsLoading(true);
    setError(null);
    setSuccess(false);

    try {
      // Get the current origin and locale for redirect URL
      const origin = window.location.origin;
      const locale = window.location.pathname.split('/')[1] || 'en';

      const result = await authClient.requestPasswordReset({
        email: data.email,
        redirectTo: `${origin}/${locale}/reset-password`
      });

      if (result.error) {
        // Don't reveal if email exists or not (security best practice)
        // Show success message anyway
        setSuccess(true);
      } else {
        setSuccess(true);
      }
    } catch {
      // Even on error, show success to prevent email enumeration
      setSuccess(true);
    } finally {
      setIsLoading(false);
    }
  };

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
                  <Mail className="h-5 w-5 text-green-400" />
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

            <div className="rounded-md bg-yellow-50 p-3 dark:bg-yellow-950">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                ⏱️ {t('expiryNote')}
              </p>
            </div>

            <Button asChild variant="outline" className="w-full">
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
                id="email"
                label={t('email')}
                required
                error={form.formState.errors.email?.message}
              >
                <Input
                  id="email"
                  type="email"
                  placeholder={t('placeholders.email')}
                  {...form.register('email')}
                  disabled={isLoading}
                  aria-invalid={!!form.formState.errors.email}
                  autoFocus
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

              <div className="rounded-md bg-muted p-3">
                <p className="text-sm text-muted-foreground">
                  ⏱️ {t('expiryNote')}
                </p>
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('sending')}
                  </>
                ) : (
                  <>
                    <Mail className="mr-2 h-4 w-4" />
                    {t('sendButton')}
                  </>
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
